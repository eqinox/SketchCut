import { openingsIn, parseOpenings, type RoomOpening, type RoomWall } from '@/lib/room-openings'

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
  /**
   * Windows, doors and niches. Missing means the original left-wall window.
   * An empty list means the walls are plain.
   */
  openings?: RoomOpening[]
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
            x: whole(row.x, 0, -5000, 20000),
            y: whole(row.y, 0, -5000, 20000),
            lift: whole(row.lift, 0, 0, 5000),
            turn,
          },
        ]
      })
    : []
  const width = whole(rec.width, DEFAULT_ROOM.width, 1000, 20000)
  const depth = whole(rec.depth, DEFAULT_ROOM.depth, 1000, 20000)
  const height = whole(rec.height, DEFAULT_ROOM.height, 1800, 5000)
  const openings = Object.prototype.hasOwnProperty.call(rec, 'openings') ? parseOpenings(rec.openings) : undefined
  return {
    width,
    depth,
    height,
    floorColor: colorOf(rec.floorColor, DEFAULT_ROOM.floorColor),
    wallColor: colorOf(rec.wallColor, DEFAULT_ROOM.wallColor),
    pieces,
    ...(openings !== undefined ? { openings } : {}),
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

type RoomBox = Pick<RoomPlan, 'width' | 'depth' | 'height' | 'openings'>

/** One solid part of a cabinet. Fronts share v = 0. z grows up from the floor. */
export interface NicheBlock {
  u0: number
  u1: number
  v0: number
  v1: number
  z0: number
  z1: number
}

function nichesIn(room: RoomBox): RoomOpening[] {
  return openingsIn(room).filter((opening) => opening.kind === 'niche')
}

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a1, b1) - Math.max(a0, b0)
}

/** A part in the footprint, measured from the piece's left-front corner. */
function blockRoom(turn: number, width: number, depth: number, block: NicheBlock) {
  const { u0, u1, v0, v1 } = block
  if (turn === 1) return { x0: v0, x1: v1, y0: width - u1, y1: width - u0 }
  if (turn === 2) return { x0: width - u1, x1: width - u0, y0: depth - v1, y1: depth - v0 }
  if (turn === 3) return { x0: depth - v1, x1: depth - v0, y0: u0, y1: u1 }
  return { x0: u0, x1: u1, y0: v0, y1: v1 }
}

/** Empty millimetres between this part and the face that meets the wall. */
function gapToWall(wall: RoomWall, turn: number, width: number, depth: number, block: NicheBlock, foot: { w: number; d: number }) {
  const box = blockRoom(turn, width, depth, block)
  if (wall === 'front') return box.y0
  if (wall === 'back') return foot.d - box.y1
  if (wall === 'left') return box.x0
  return foot.w - box.x1
}

function alongRange(wall: RoomWall, turn: number, width: number, depth: number, block: NicheBlock) {
  const box = blockRoom(turn, width, depth, block)
  return wall === 'front' || wall === 'back' ? { a0: box.x0, a1: box.x1 } : { a0: box.y0, a1: box.y1 }
}

function blockFitsOpening(block: NicheBlock, lift: number, opening: RoomOpening) {
  const bottom = lift + block.z0
  const top = lift + block.z1
  return bottom >= opening.sill - 1 && top <= opening.sill + opening.height + 1 && block.z1 - block.z0 <= opening.height + 1
}

/**
 * How far the outer face may pass the wall.
 * A part enters only while its whole height sits in the opening.
 * The empty step behind a shallower cabinet does not count as solid.
 */
function intrusionLimit(
  blocks: NicheBlock[],
  wall: RoomWall,
  turn: number,
  width: number,
  depth: number,
  foot: { w: number; d: number },
  lift: number,
  opening: RoomOpening,
) {
  const limits = blocks.map((block) => {
    const gap = Math.max(0, gapToWall(wall, turn, width, depth, block, foot))
    const along = alongRange(wall, turn, width, depth, block)
    const fits = blockFitsOpening(block, lift, opening) && along.a1 - along.a0 <= opening.span + 1
    return fits ? gap + opening.depth : gap
  })
  let allowed = Math.min(...limits)
  const placeable = (into: number) => {
    let lo = Number.NEGATIVE_INFINITY
    let hi = Number.POSITIVE_INFINITY
    for (const block of blocks) {
      const gap = Math.max(0, gapToWall(wall, turn, width, depth, block, foot))
      if (gap >= into - 0.5) continue
      if (!blockFitsOpening(block, lift, opening)) return null
      const along = alongRange(wall, turn, width, depth, block)
      lo = Math.max(lo, opening.along - along.a0)
      hi = Math.min(hi, opening.along + opening.span - along.a1)
    }
    return hi >= lo - 1 ? { lo, hi } : null
  }
  if (placeable(allowed)) return allowed
  let lo = 0
  let hi = Math.max(0, allowed)
  for (let step = 0; step < 24; step += 1) {
    const mid = (lo + hi) / 2
    if (placeable(mid)) lo = mid
    else hi = mid
  }
  return lo
}

function alongSlot(
  blocks: NicheBlock[],
  wall: RoomWall,
  turn: number,
  width: number,
  depth: number,
  foot: { w: number; d: number },
  lift: number,
  opening: RoomOpening,
  into: number,
  alongStart: number,
) {
  let lo = Number.NEGATIVE_INFINITY
  let hi = Number.POSITIVE_INFINITY
  let crosses = false
  for (const block of blocks) {
    const gap = Math.max(0, gapToWall(wall, turn, width, depth, block, foot))
    if (gap >= into - 0.5) continue
    if (!blockFitsOpening(block, lift, opening)) return null
    crosses = true
    const along = alongRange(wall, turn, width, depth, block)
    lo = Math.max(lo, opening.along - along.a0)
    hi = Math.min(hi, opening.along + opening.span - along.a1)
  }
  if (!crosses) return alongStart
  if (hi < lo - 1) return null
  return Math.max(lo, Math.min(hi, alongStart))
}

function sinkIntoNiche(
  room: RoomBox,
  piece: RoomPiece,
  w: number,
  d: number,
  h: number,
  lift: number,
  blocks: NicheBlock[],
  width: number,
  depth: number,
): { x: number; y: number; lift: number } | null {
  const x = Math.round(piece.x)
  const y = Math.round(piece.y)
  const cuts: { wall: RoomWall; intrusion: number }[] = [
    { wall: 'front', intrusion: Math.max(0, -y) },
    { wall: 'back', intrusion: Math.max(0, y + d - room.depth) },
    { wall: 'left', intrusion: Math.max(0, -x) },
    { wall: 'right', intrusion: Math.max(0, x + w - room.width) },
  ]
  cuts.sort((a, b) => b.intrusion - a.intrusion)
  const side = cuts[0]
  if (!side || side.intrusion < 1) return null
  const alongStart = side.wall === 'front' || side.wall === 'back' ? x : y
  const alongSize = side.wall === 'front' || side.wall === 'back' ? w : d
  const foot = { w, d }
  const turn = ((piece.turn % 4) + 4) % 4
  const seated = (opening: RoomOpening, at: number) => {
    const roomLift = Math.max(0, Math.min(room.height - h, Math.round(at)))
    const into = intrusionLimit(blocks, side.wall, turn, width, depth, foot, roomLift, opening)
    return into >= 1 ? { lift: roomLift, into } : null
  }
  let niche: RoomOpening | null = null
  let best = 0
  let chosen = { lift, into: 0 }
  for (const opening of nichesIn(room)) {
    if (opening.wall !== side.wall) continue
    const covered = overlap(alongStart, alongStart + alongSize, opening.along, opening.along + opening.span)
    if (covered < Math.min(80, Math.max(alongSize, 1) * 0.25) || covered <= best) continue
    const atLift = seated(opening, lift) ?? seated(opening, opening.sill)
    if (!atLift) continue
    best = covered
    niche = opening
    chosen = atLift
  }
  if (!niche || chosen.into < 1) return null
  const into = Math.min(side.intrusion, chosen.into)
  const along = alongSlot(blocks, side.wall, turn, width, depth, foot, chosen.lift, niche, into, alongStart)
  if (along == null) return null
  if (side.wall === 'front' || side.wall === 'back') {
    const nextY = side.wall === 'front' ? -into : room.depth - d + into
    return { x: Math.round(along), y: Math.round(nextY), lift: chosen.lift }
  }
  const nextX = side.wall === 'left' ? -into : room.width - w + into
  return { x: Math.round(nextX), y: Math.round(along), lift: chosen.lift }
}

export function clampPiece(
  room: RoomBox,
  piece: RoomPiece,
  size: { w: number; d: number; h: number },
  blocks?: NicheBlock[],
): RoomPiece {
  const box = pieceSpan(piece.turn, size.w, size.d)
  const lift = Math.max(0, Math.min(room.height - size.h, Math.round(piece.lift)))
  const solid = blocks && blocks.length > 0 ? blocks : [{ u0: 0, u1: size.w, v0: 0, v1: size.d, z0: 0, z1: size.h }]
  const sunk = sinkIntoNiche(room, piece, box.w, box.d, size.h, lift, solid, size.w, size.d)
  if (sunk) return { ...piece, ...sunk }
  return {
    ...piece,
    x: Math.max(0, Math.min(Math.max(0, room.width - box.w), Math.round(piece.x))),
    y: Math.max(0, Math.min(Math.max(0, room.depth - box.d), Math.round(piece.y))),
    lift,
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
