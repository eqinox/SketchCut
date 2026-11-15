/** Openings cut into the room walls. Sizes are millimetres. */

export type RoomWall = 'front' | 'back' | 'left' | 'right'
export type RoomOpeningKind = 'window' | 'door' | 'niche'

export interface RoomOpening {
  id: string
  kind: RoomOpeningKind
  wall: RoomWall
  /** From the left wall on the front and back, from the front wall on the sides. */
  along: number
  /** Width along the wall. */
  span: number
  /** Bottom of the opening above the floor. A door sits on the floor. */
  sill: number
  height: number
  /** How far a niche goes out into the wall. */
  depth: number
  /** Face colour. Missing means the usual colour for this kind. */
  color?: string
}

export interface RoomBox {
  width: number
  depth: number
  height: number
}

const WALLS: RoomWall[] = ['front', 'back', 'left', 'right']
const KINDS: RoomOpeningKind[] = ['window', 'door', 'niche']

export function wallLength(room: Pick<RoomBox, 'width' | 'depth'>, wall: RoomWall): number {
  return wall === 'front' || wall === 'back' ? room.width : room.depth
}

export function wallAlongLabel(wall: RoomWall): string {
  return wall === 'front' || wall === 'back' ? 'От лявата стена' : 'От предната стена'
}

export function wallFarLabel(wall: RoomWall): string {
  return wall === 'front' || wall === 'back' ? 'От дясната стена' : 'От задната стена'
}

/** Gap from the opening to the far end of its wall. */
export function openingFar(room: Pick<RoomBox, 'width' | 'depth'>, opening: Pick<RoomOpening, 'wall' | 'along' | 'span'>): number {
  return wallLength(room, opening.wall) - opening.along - opening.span
}

/** `along` that leaves `far` millimetres to the far end of the wall. */
export function alongForFar(room: Pick<RoomBox, 'width' | 'depth'>, opening: Pick<RoomOpening, 'wall' | 'span'>, far: number): number {
  return wallLength(room, opening.wall) - opening.span - far
}

export const WALL_NAME: Record<RoomWall, string> = {
  front: 'Предна стена',
  back: 'Задна стена',
  left: 'Лява стена',
  right: 'Дясна стена',
}

export const OPENING_NAME: Record<RoomOpeningKind, string> = {
  window: 'Прозорец',
  door: 'Врата',
  niche: 'Ниша',
}

export const OPENING_COLOR: Record<RoomOpeningKind, string> = {
  window: '#bae6fd',
  door: '#fed7aa',
  niche: '#e2e8f0',
}

export const OPENING_SWATCHES = [
  { name: 'Стъкло', color: '#bae6fd' },
  { name: 'Бяло', color: '#f7f5f2' },
  { name: 'Дъб', color: '#c4a574' },
  { name: 'Дърво', color: '#fed7aa' },
  { name: 'Сиво', color: '#e2e8f0' },
  { name: 'Тъмно', color: '#44403c' },
]

const HEX = /^#[0-9a-fA-F]{6}$/

export function openingColor(opening: { kind: RoomOpeningKind; color?: string }): string {
  const color = opening.color?.trim() ?? ''
  return HEX.test(color) ? color.toLowerCase() : OPENING_COLOR[opening.kind]
}

/** A new opening on the front wall, shifted along if that spot is already taken. */
export function draftOpening(room: RoomBox, kind: RoomOpeningKind, existing: RoomOpening[]): RoomOpening {
  const span = kind === 'door' ? 900 : kind === 'niche' ? 800 : 1400
  const height = kind === 'door' ? 2100 : kind === 'niche' ? 600 : 1400
  const sill = kind === 'door' ? 0 : kind === 'niche' ? 1100 : 900
  const wall: RoomWall = 'front'
  const length = wallLength(room, wall)
  const width = Math.min(span, Math.max(120, length - 80))
  let along = Math.max(0, Math.round((length - width) / 2))
  const taken = (start: number) =>
    existing.some(
      (item) => item.wall === wall && start < item.along + item.span - 20 && start + width > item.along + 20,
    )
  if (taken(along)) {
    for (let step = 0; step <= Math.max(0, length - width); step += 100) {
      if (!taken(step)) {
        along = step
        break
      }
    }
  }
  return clampOpening(room, {
    id: '',
    kind,
    wall,
    along,
    span: width,
    height,
    sill,
    depth: kind === 'niche' ? 220 : 0,
  })
}

/** The window the room had before openings could be drawn: on the left wall. */
export function defaultWindow(room: Pick<RoomBox, 'depth' | 'height'>): RoomOpening {
  const span = Math.min(1500, Math.max(700, Math.round(room.depth * 0.42)))
  const height = Math.min(1300, Math.max(700, Math.round(room.height * 0.42)))
  const sill = Math.min(900, Math.max(0, room.height - height - 200))
  const center = Math.round(room.depth * 0.55)
  const along = Math.max(0, center - Math.round(span / 2))
  return { id: 'window-1', kind: 'window', wall: 'left', along, sill, span, height, depth: 0 }
}

export function openingsIn(room: RoomBox & { openings?: RoomOpening[] }): RoomOpening[] {
  const list = room.openings ?? [defaultWindow(room)]
  return list.map((opening) => clampOpening(room, opening))
}

export function clampOpening(room: RoomBox, opening: RoomOpening): RoomOpening {
  const length = wallLength(room, opening.wall)
  const span = Math.max(120, Math.min(Math.max(120, length - 40), Math.round(opening.span)))
  const height = Math.max(120, Math.min(room.height - 40, Math.round(opening.height)))
  const sill = opening.kind === 'door' ? 0 : Math.max(0, Math.min(room.height - height, Math.round(opening.sill)))
  const along = Math.max(0, Math.min(Math.max(0, length - span), Math.round(opening.along)))
  const depth = opening.kind === 'niche' ? Math.max(40, Math.min(800, Math.round(opening.depth || 220))) : 0
  return { ...opening, span, height, sill, along, depth, color: openingColor(opening) }
}

function whole(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

/** Missing list means the room still has the original window. An empty list means none. */
export function parseOpenings(raw: unknown): RoomOpening[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: RoomOpening[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const wall = WALLS.find((name) => name === row.wall)
    const kind = KINDS.find((name) => name === row.kind)
    if (!wall || !kind || typeof row.id !== 'string' || row.id.length > 80) continue
    const color = typeof row.color === 'string' && HEX.test(row.color.trim()) ? row.color.trim().toLowerCase() : undefined
    out.push({
      id: row.id,
      kind,
      wall,
      along: whole(row.along, 0),
      span: whole(row.span, 600),
      sill: whole(row.sill, kind === 'door' ? 0 : 900),
      height: whole(row.height, kind === 'door' ? 2100 : 800),
      depth: whole(row.depth, kind === 'niche' ? 220 : 0),
      ...(color ? { color } : {}),
    })
  }
  return out
}
