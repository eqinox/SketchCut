/** A room the project cabinets are arranged in. Sizes are the clear opening, in mm. */

export interface RoomPiece {
  id: string
  cabinetId: string
  /** Clear mm from the left wall to the piece's left side. */
  x: number
  /** Clear mm from the front wall to the piece's front side. */
  y: number
  /** Clear mm from the floor to the bottom of the piece, legs included. */
  lift: number
  /** Quarter turns clockwise, seen from above. */
  turn: 0 | 1 | 2 | 3
}

export interface RoomPlan {
  width: number
  depth: number
  height: number
  floorColor: string
  wallColor: string
  pieces: RoomPiece[]
}

export const DEFAULT_ROOM: RoomPlan = {
  width: 4000,
  depth: 3500,
  height: 2600,
  floorColor: '#c4a574',
  wallColor: '#f3efe6',
  pieces: [],
}

/** Drawn wall thickness on the plan. The typed size stays the clear opening. */
export const ROOM_WALL_MM = 120

const HEX = /^#[0-9a-fA-F]{6}$/

function whole(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

function colorOf(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value) ? value : fallback
}

export function parseRoomPlan(raw: unknown): RoomPlan {
  const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const pieces = Array.isArray(rec.pieces)
    ? rec.pieces.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const row = item as Record<string, unknown>
        if (typeof row.id !== 'string' || typeof row.cabinetId !== 'string') return []
        const turn = whole(row.turn, 0, 0, 3) as 0 | 1 | 2 | 3
        return [
          {
            id: row.id,
            cabinetId: row.cabinetId,
            x: whole(row.x, 0, 0, 20000),
            y: whole(row.y, 0, 0, 20000),
            lift: whole(row.lift, 0, 0, 5000),
            turn,
          },
        ]
      })
    : []
  return {
    width: whole(rec.width, DEFAULT_ROOM.width, 1000, 20000),
    depth: whole(rec.depth, DEFAULT_ROOM.depth, 1000, 20000),
    height: whole(rec.height, DEFAULT_ROOM.height, 1800, 5000),
    floorColor: colorOf(rec.floorColor, DEFAULT_ROOM.floorColor),
    wallColor: colorOf(rec.wallColor, DEFAULT_ROOM.wallColor),
    pieces,
  }
}

export function pieceSpan(turn: number, width: number, depth: number): { w: number; d: number } {
  return turn % 2 === 1 ? { w: depth, d: width } : { w: width, d: depth }
}

/** A wall cabinet hangs. Everything else stands on the floor. */
export function defaultLift(typeId: string, height: number, roomHeight: number): number {
  if (typeId !== 'kitchen-wall') return 0
  return Math.max(0, Math.min(1450, roomHeight - height))
}

export function clampPiece(
  room: Pick<RoomPlan, 'width' | 'depth' | 'height'>,
  piece: RoomPiece,
  size: { w: number; d: number; h: number },
): RoomPiece {
  const box = pieceSpan(piece.turn, size.w, size.d)
  return {
    ...piece,
    x: Math.max(0, Math.min(room.width - box.w, Math.round(piece.x))),
    y: Math.max(0, Math.min(room.depth - box.d, Math.round(piece.y))),
    lift: Math.max(0, Math.min(room.height - size.h, Math.round(piece.lift))),
  }
}

export function boxesOverlap(
  a: { x: number; y: number; w: number; d: number },
  b: { x: number; y: number; w: number; d: number },
): boolean {
  return a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.d - 1 && a.y + a.d > b.y + 1
}

/** Stations along one axis. Consecutive gaps add up to the clear size. */
export function chainStations(spans: { a: number; b: number }[], total: number): number[] {
  const pts = [0, Math.round(total)]
  for (const span of spans) {
    const a = Math.round(Math.max(0, Math.min(span.a, span.b)))
    const b = Math.round(Math.min(total, Math.max(span.a, span.b)))
    if (b > a) {
      pts.push(a, b)
    }
  }
  return [...new Set(pts)].sort((a, b) => a - b)
}
