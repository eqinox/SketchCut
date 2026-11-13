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
  return { ...opening, span, height, sill, along, depth }
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
    out.push({
      id: row.id,
      kind,
      wall,
      along: whole(row.along, 0),
      span: whole(row.span, 600),
      sill: whole(row.sill, kind === 'door' ? 0 : 900),
      height: whole(row.height, kind === 'door' ? 2100 : 800),
      depth: whole(row.depth, kind === 'niche' ? 220 : 0),
    })
  }
  return out
}
