import type { HardwareSettings } from '@/lib/settings'
import {
  confirmatCount,
  fastenerLine,
  hingesForDoorHeight,
  SCREW_4X16,
  SCREW_4X20,
  SCREW_4X30,
  SCREWS_4X16_PER_HINGE,
  SCREWS_4X20_PER_HINGE,
} from './hardware'
import { doorCutSize } from './materials'
import type { CabinetGeneratorResult, GeneratedPanel } from './types'
import { formatMm } from '@/lib/utils'

export type CabinetPlace = 'left' | 'right' | 'above' | 'below'

/** A cabinet already in the project, set against the one being drawn. */
export interface AttachedCabinet {
  cabinetId: string
  place: CabinetPlace
  /** Fasten the two boxes with 4×30 screws. */
  joinScrews: boolean
  /** One door across both, when one sits above the other. */
  spanDoor: boolean
}

export interface CabinetSize {
  w: number
  /** Carcass height, without the legs. */
  h: number
  d: number
  feet: number
}

export interface DrawFrame {
  ox: number
  top: number
  w: number
  /** Carcass height. Legs hang below this. */
  h: number
  feet: number
  vbW: number
  vbH: number
}

const PLACES: CabinetPlace[] = ['left', 'right', 'above', 'below']

/** A drawing of several cabinets. It has no parts and no price of its own. */
export const COMBINATION_TYPE = 'combination'

export interface CombinationMember {
  cabinetId: string
  place: CabinetPlace | 'host'
  joinScrews: boolean
  spanDoor: boolean
}

export function isCombinationType(typeId: string): boolean {
  return typeId === COMBINATION_TYPE
}

export function parseCombination(raw: unknown): { hostId: string; members: CombinationMember[] } | null {
  if (!raw || typeof raw !== 'object') return null
  const params = raw as Record<string, unknown>
  const hostId = typeof params.hostId === 'string' ? params.hostId : ''
  if (!hostId || !Array.isArray(params.members)) return null
  const members: CombinationMember[] = []
  for (const item of params.members) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.cabinetId !== 'string' || row.cabinetId === '') continue
    const place =
      row.place === 'host' || PLACES.includes(row.place as CabinetPlace)
        ? (row.place as CombinationMember['place'])
        : 'right'
    members.push({
      cabinetId: row.cabinetId,
      place,
      joinScrews: row.joinScrews === true,
      spanDoor: row.spanDoor === true,
    })
  }
  if (members.length === 0) return null
  return { hostId, members }
}

export function combinationReferences(params: Record<string, unknown>, cabinetId: string): boolean {
  const parsed = parseCombination(params)
  if (!parsed) return false
  return parsed.hostId === cabinetId || parsed.members.some((member) => member.cabinetId === cabinetId)
}

/**
 * The outline is drawn centered on the edge, and the cabinet on top is painted last.
 * This keeps the facing edges apart by the stroke, so they meet and neither covers the other.
 */
export const EDGE_MEET_MM = 1

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function parseAttached(raw: unknown): AttachedCabinet | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (typeof row.cabinetId !== 'string' || row.cabinetId === '') return null
  const place = PLACES.includes(row.place as CabinetPlace) ? (row.place as CabinetPlace) : 'right'
  return {
    cabinetId: row.cabinetId,
    place,
    joinScrews: row.joinScrews === true,
    spanDoor: row.spanDoor === true,
  }
}

/** One saved cabinet, or a list. Older projects stored a single object. */
export function parseAttachedList(raw: unknown): AttachedCabinet[] {
  if (Array.isArray(raw)) {
    const seen = new Set<string>()
    const rows: AttachedCabinet[] = []
    for (const item of raw) {
      const row = parseAttached(item)
      if (!row || seen.has(row.cabinetId)) continue
      seen.add(row.cabinetId)
      rows.push(row)
    }
    return rows
  }
  const one = parseAttached(raw)
  return one ? [one] : []
}

/** The first cabinet on a side sits against the one being drawn. The next ones continue outward. */
export function attachmentTouchesHost(rows: { place: CabinetPlace }[], index: number): boolean {
  const place = rows[index]?.place
  if (!place) return false
  return rows.findIndex((row) => row.place === place) === index
}

export function isStacked(place: CabinetPlace): boolean {
  return place === 'above' || place === 'below'
}

/** Outer box. A kitchen base reports the carcass and the legs separately, so two boxes can sit carcass to carcass. */
export function cabinetOuterSize(typeId: string, params: Record<string, unknown>): CabinetSize {
  const w = num(params.width, 600)
  const h = num(params.height, 720)
  const d = num(params.depth, 560)
  if (typeId === 'kitchen-base') {
    return { w, h, d, feet: num(params.legHeight, 100) }
  }
  return { w, h, d, feet: 0 }
}

export interface GroupSpot {
  x: number
  y: number
  hideFeet: boolean
}

/**
 * The edge that faces the other cabinet sits on that cabinet's edge.
 * Above: the new box's bottom, legs included, rests on the top of the one under it.
 * Below: the new box's top starts at the bottom of the one above it, legs included.
 * The shared line stays apart by the outline, so one edge does not cover the other.
 * Left and right: the facing sides touch, and the feet share one floor.
 */
export function arrangeMany(
  host: CabinetSize,
  guests: { size: CabinetSize; place: CabinetPlace }[],
): { host: GroupSpot; guests: GroupSpot[] } {
  const tagged = guests.map((guest, index) => ({ ...guest, index }))
  const lefts = tagged.filter((guest) => guest.place === 'left')
  const rights = tagged.filter((guest) => guest.place === 'right')
  const aboves = tagged.filter((guest) => guest.place === 'above')
  const belows = tagged.filter((guest) => guest.place === 'below')
  const floor = Math.max(
    host.h + host.feet,
    ...lefts.map((guest) => guest.size.h + guest.size.feet),
    ...rights.map((guest) => guest.size.h + guest.size.feet),
  )
  const spots: GroupSpot[] = guests.map(() => ({ x: 0, y: 0, hideFeet: false }))
  let x = 0
  for (const guest of [...lefts].reverse()) {
    spots[guest.index] = { x, y: floor - (guest.size.h + guest.size.feet), hideFeet: false }
    x += guest.size.w
  }
  const hostSpot: GroupSpot = { x, y: floor - (host.h + host.feet), hideFeet: false }
  x += host.w
  for (const guest of rights) {
    spots[guest.index] = { x, y: floor - (guest.size.h + guest.size.feet), hideFeet: false }
    x += guest.size.w
  }
  let seat = hostSpot.y
  for (const guest of aboves) {
    const y = seat - guest.size.h - guest.size.feet - EDGE_MEET_MM
    spots[guest.index] = { x: hostSpot.x, y, hideFeet: false }
    seat = y
  }
  let belowTop = hostSpot.y + host.h + host.feet + EDGE_MEET_MM
  for (const guest of belows) {
    spots[guest.index] = { x: hostSpot.x, y: belowTop, hideFeet: false }
    belowTop += guest.size.h + guest.size.feet + EDGE_MEET_MM
  }
  return { host: hostSpot, guests: spots }
}

/** Where each drawing sits in the shared picture, after the padding is pulled back. */
export function stageBoxes(spots: { x: number; y: number; frame: DrawFrame }[]) {
  const placed = spots.map((spot) => ({
    left: spot.x - spot.frame.ox,
    top: spot.y - spot.frame.top,
    frame: spot.frame,
  }))
  const minL = Math.min(...placed.map((box) => box.left))
  const minT = Math.min(...placed.map((box) => box.top))
  const maxR = Math.max(...placed.map((box) => box.left + box.frame.vbW))
  const maxB = Math.max(...placed.map((box) => box.top + box.frame.vbH))
  const ox = -minL
  const oy = -minT
  return {
    boxes: placed.map((box) => ({ left: box.left + ox, top: box.top + oy })),
    width: maxR - minL,
    height: maxB - minT,
    originX: ox,
    originY: oy,
  }
}

export function joinScrewCount(place: CabinetPlace, host: CabinetSize, guest: CabinetSize): number {
  const span = place === 'left' || place === 'right' ? Math.min(host.h + host.feet, guest.h + guest.feet) : Math.min(host.w, guest.w)
  return Math.max(2, confirmatCount(span))
}

/** One overlay door covering both boxes. Width follows the narrower one. */
export function spanDoorPanel(host: CabinetSize, guest: CabinetSize, place: CabinetPlace = 'below'): GeneratedPanel {
  const openingW = Math.min(host.w, guest.w)
  const between = place === 'above' ? guest.feet + EDGE_MEET_MM : place === 'below' ? host.feet + EDGE_MEET_MM : 0
  const openingH = host.h + guest.h + between
  const cut = doorCutSize(openingW, openingH, 1)
  return {
    role: 'door',
    name: 'Врата на двата шкафа',
    width: Math.round(cut.width * 10) / 10,
    height: Math.round(cut.height * 10) / 10,
    quantity: 1,
    canRotate: false,
    edges: { top: true, bottom: true, left: true, right: true, thickness: 'mm2' },
    note: `Една врата върху двата шкафа. Отвор ${formatMm(openingW)} × ${formatMm(openingH)} мм. Кант 2 мм от четирите страни.`,
  }
}

export function withAttachments(
  result: CabinetGeneratorResult,
  attached: AttachedCabinet[],
  host: CabinetSize,
  guests: CabinetSize[],
  hardwareSettings: HardwareSettings,
): CabinetGeneratorResult {
  const hardware = [...result.hardware]
  const panels = [...result.panels]
  const notes = [...result.notes]
  let screws = 0
  attached.forEach((row, index) => {
    const guest = guests[index]
    if (!guest) return
    if (row.joinScrews) {
      const count = joinScrewCount(row.place, host, guest)
      screws += count
      notes.push(`Винтчета 4×30: ${count} бр. — хващат този шкаф с добавения до него.`)
    }
    if (row.spanDoor && isStacked(row.place) && attachmentTouchesHost(attached, index)) {
      const door = spanDoorPanel(host, guest, row.place)
      panels.push(door)
      const hinges = hingesForDoorHeight(door.height)
      hardware.push(
        fastenerLine(
          { ...SCREW_4X16, packPriceEur: hardwareSettings.smallScrew1000PackEur },
          hinges * SCREWS_4X16_PER_HINGE,
          'Панти на общата врата',
        ),
      )
      hardware.push(
        fastenerLine(
          { ...SCREW_4X20, packPriceEur: hardwareSettings.smallScrew1000PackEur },
          hinges * SCREWS_4X20_PER_HINGE,
          'Панти на общата врата',
        ),
      )
      notes.push(
        `Една врата на двата шкафа: рязане ${formatMm(door.height)} × ${formatMm(door.width)} мм. Панти: ${hinges} бр.`,
      )
    }
  })
  if (screws > 0) {
    hardware.push(
      fastenerLine(
        { ...SCREW_4X30, packPriceEur: hardwareSettings.smallScrew1000PackEur },
        screws,
        'Между шкафовете',
      ),
    )
  }
  return { ...result, hardware, panels, notes }
}
