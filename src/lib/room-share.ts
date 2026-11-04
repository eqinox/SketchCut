import { parseBoardFinishes, type BoardFinish } from '@/lib/board-finishes'
import { isCombinationType } from '@/lib/cabinets/compose'
import { loadPublicShare, savePublicShare } from '@/lib/firebase'
import { parseRoomPlan, type RoomPlan } from '@/lib/room'
import { generateId } from '@/lib/utils'
import type { CabinetInstance } from '@/types'

export type SharedCabinet = {
  id: string
  typeId: string
  name: string
  params: Record<string, unknown>
}

export type RoomShare = {
  room: RoomPlan
  cabinets: SharedCabinet[]
  finishes: BoardFinish[]
}

const SHARE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BYTES = 900_000

export function shareIdFromLocation(): string | null {
  const match = /^#view=([0-9a-f-]{36})$/i.exec(window.location.hash)
  return match && SHARE_ID.test(match[1]) ? match[1] : null
}

export function shareUrl(id: string): string {
  return `${window.location.origin}${window.location.pathname}#view=${id}`
}

export function buildRoomShare(room: RoomPlan, cabinets: CabinetInstance[], finishes: BoardFinish[]): RoomShare {
  const placed = new Set(room.pieces.map((piece) => piece.cabinetId))
  const kept = cabinets.filter((cabinet) => placed.has(cabinet.id) && !isCombinationType(cabinet.typeId))
  const finishIds = new Set<string>()
  for (const cabinet of kept) {
    for (const key of ['carcassFinishId', 'frontFinishId', 'backFinishId']) {
      const id = cabinet.params[key]
      if (typeof id === 'string') finishIds.add(id)
    }
  }
  return {
    room: parseRoomPlan(room),
    cabinets: kept.map((cabinet) => ({
      id: cabinet.id,
      typeId: cabinet.typeId,
      name: cabinet.name,
      params: JSON.parse(JSON.stringify(cabinet.params)) as Record<string, unknown>,
    })),
    finishes: parseBoardFinishes(finishes.filter((finish) => finishIds.has(finish.id))),
  }
}

function withoutPhotos(share: RoomShare): RoomShare {
  return {
    ...share,
    finishes: share.finishes.map((finish) => ({
      id: finish.id,
      name: finish.name,
      color: finish.color,
      sheetPriceEur: finish.sheetPriceEur,
    })),
  }
}

function encodedBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

export async function publishRoomShare(
  ownerId: string,
  share: RoomShare,
): Promise<{ id: string; url: string; droppedPhotos: boolean }> {
  if (share.cabinets.length === 0) throw new Error('Няма мебел за линка.')
  let body = share
  let droppedPhotos = false
  if (encodedBytes(body) > MAX_BYTES) {
    body = withoutPhotos(share)
    droppedPhotos = true
  }
  if (encodedBytes(body) > 1_000_000) {
    throw new Error('Стаята е твърде голяма за един линк.')
  }
  const id = generateId()
  await savePublicShare(ownerId, id, {
    ownerId,
    room: body.room,
    cabinets: body.cabinets,
    finishes: body.finishes,
    createdAt: Date.now(),
  })
  return { id, url: shareUrl(id), droppedPhotos }
}

function parseCabinets(raw: unknown): SharedCabinet[] {
  if (!Array.isArray(raw)) return []
  const out: SharedCabinet[] = []
  for (const item of raw.slice(0, 40)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || typeof row.typeId !== 'string') continue
    if (!row.params || typeof row.params !== 'object' || Array.isArray(row.params)) continue
    out.push({
      id: row.id.slice(0, 80),
      typeId: row.typeId.slice(0, 40),
      name: typeof row.name === 'string' && row.name.trim() ? row.name.trim().slice(0, 80) : 'Шкаф',
      params: row.params as Record<string, unknown>,
    })
  }
  return out
}

export function parseRoomShare(raw: unknown): RoomShare | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const cabinets = parseCabinets(row.cabinets)
  if (cabinets.length === 0) return null
  return {
    room: parseRoomPlan(row.room),
    cabinets,
    finishes: parseBoardFinishes(row.finishes),
  }
}

export function asCabinetInstances(share: RoomShare): CabinetInstance[] {
  return share.cabinets.map((cabinet) => ({
    id: cabinet.id,
    typeId: cabinet.typeId,
    name: cabinet.name,
    quantity: 1,
    params: cabinet.params,
    partIds: [],
  }))
}

export async function fetchRoomShare(id: string): Promise<RoomShare | null> {
  if (!SHARE_ID.test(id)) return null
  const raw = await loadPublicShare(id)
  if (!raw) return null
  return parseRoomShare(raw)
}
