import type { SceneSolid } from '@/lib/cabinets/scene-solids'

/**
 * What is done on the loose boards before the carcass goes together, laid out on the bench the
 * way the workshop does it: the two outer sides side by side, then the middle divider, then the
 * short dividers, then the bottom and the top. Board coordinates: `u` along the board's length
 * (for an upright, from its top edge down; for the bottom and top, from the left), `v` across it
 * (from the front edge back), in mm.
 */
export interface BenchFace {
  /** Pencil lines: the bottom, fixed shelves and dividers (their middle, or both edges), slides. */
  lines: { u0: number; v0: number; u1: number; v1: number }[]
  /** A cross where the clothes rail's holder comes. */
  crosses: { u: number; v: number }[]
  /** Shelf-pin holes. */
  points: { u: number; v: number }[]
  /** The cabinet half of each drawer slide, screwed on along its pencil line. */
  slides: { u: number; v0: number; length: number }[]
}

export interface BenchBoard {
  name: string
  u: number
  v: number
  thickness: number
  color: string
  /** The face that is up first, then (when there is work on it) the other face after a flip. */
  faces: BenchFace[]
}

export interface BenchGroup {
  key: 'sides' | 'middle' | 'short' | 'bottom' | 'top'
  /** For the captions, e.g. „Двете крайни страници“. */
  title: string
  boards: BenchBoard[]
  /** Lay the boards so their front edges meet in the middle (the two sides). */
  mirrorSecond: boolean
}

/** The assembly bench in the workshop. */
export const BENCH_TABLE = { widthMm: 2000, depthMm: 900, heightMm: 850 }

/**
 * How a group's boards lie on the bench:
 * - `lengthwise`: along the bench's 2 m, side by side across its 90 cm depth (narrow boards);
 * - `across`: across the bench, their bottom edge toward you, side by side along it (short boards);
 * - `one-by-one`: they don't fit together, so one is marked, leaned on the wall, then the next.
 */
export type BenchLayout = 'lengthwise' | 'across' | 'one-by-one'

export function benchLayout(group: BenchGroup): BenchLayout {
  const widths = group.boards.reduce((sum, board) => sum + board.v, 0)
  const longest = group.boards.reduce((most, board) => Math.max(most, board.u), 0)
  if (widths <= BENCH_TABLE.depthMm) return 'lengthwise'
  if (longest <= BENCH_TABLE.depthMm && widths <= BENCH_TABLE.widthMm) return 'across'
  return group.boards.length > 1 ? 'one-by-one' : 'lengthwise'
}

/** Shelf pins: one pair per shelf on each side, this far in from the front and the back edge. */
export const PIN_EDGE_MM = 50
/** The pin's hole sits this far under the shelf. */
const PIN_UNDER_SHELF_MM = 6

type Box = Extract<SceneSolid, { kind: 'box' }>
type Rail = Extract<SceneSolid, { kind: 'rail' }>

const isBox = (solid: SceneSolid): solid is Box => solid.kind === 'box'
const piece = (box: Box) => box.piece ?? ''
const volume = (box: Box) => box.w * box.h * box.d

/** The real board of a piece: the same piece name can be drawn as several boxes. */
export function mainBoxes(solids: SceneSolid[], test: (name: string) => boolean): Box[] {
  const best = new Map<string, Box>()
  for (const solid of solids) {
    if (!isBox(solid) || !test(piece(solid))) continue
    const now = best.get(piece(solid))
    if (!now || volume(solid) > volume(now)) best.set(piece(solid), solid)
  }
  return [...best.values()].sort((a, b) => a.x - b.x)
}

export const isFixedShelf = (name: string) => /^shelf-\d+$/.test(name)

/** Which face of an upright board a part stands against: +1 its right face, -1 its left, 0 none. */
function faceOf(part: { x: number; w: number; y: number; h: number }, board: Box, reach: number): -1 | 0 | 1 {
  const sameHeight = part.y < board.y + board.h && part.y + part.h > board.y
  if (!sameHeight) return 0
  if (Math.abs(part.x - (board.x + board.w)) <= reach) return 1
  if (Math.abs(part.x + part.w - board.x) <= reach) return -1
  return 0
}

const emptyFace = (): BenchFace => ({ lines: [], crosses: [], points: [], slides: [] })
const work = (face: BenchFace) => face.lines.length + face.crosses.length + face.points.length + face.slides.length

/** Everything marked on one upright, face by face (right face first in the result's key 1). */
function uprightFaces(board: Box, solids: SceneSolid[], withBottom: boolean): Map<-1 | 1, BenchFace> {
  const faces = new Map<-1 | 1, BenchFace>([
    [1, emptyFace()],
    [-1, emptyFace()],
  ])
  const boxes = solids.filter(isBox)
  const at = (side: -1 | 0 | 1) => (side === 0 ? null : faces.get(side)!)
  const line = (face: BenchFace, u: number, v0: number, v1: number) => {
    if (face.lines.some((item) => Math.abs(item.u0 - u) < 2 && Math.abs(item.v0 - v0) < 2)) return
    face.lines.push({ u0: u, v0, u1: u, v1 })
  }
  const span = (part: Box) => {
    const v0 = Math.max(0, part.z - board.z)
    return [v0, Math.min(board.d, v0 + part.d)] as const
  }

  if (withBottom) {
    for (const bottom of mainBoxes(solids, (name) => name === 'bottom')) {
      const face = at(faceOf(bottom, board, 30))
      if (face) line(face, bottom.y + bottom.h / 2 - board.y, ...span(bottom))
    }
  }
  for (const shelf of boxes.filter((box) => piece(box).startsWith('shelf-'))) {
    const face = at(faceOf(shelf, board, 30))
    if (!face) continue
    if (isFixedShelf(piece(shelf))) {
      // A fixed shelf is screwed through the board: a line where its middle comes.
      line(face, shelf.y + shelf.h / 2 - board.y, ...span(shelf))
    } else {
      const u = shelf.y + shelf.h + PIN_UNDER_SHELF_MM - board.y
      for (const v of [PIN_EDGE_MM, board.d - PIN_EDGE_MM]) {
        if (!face.points.some((point) => Math.abs(point.u - u) < 2 && Math.abs(point.v - v) < 2)) face.points.push({ u, v })
      }
    }
  }
  for (const rail of solids.filter((solid): solid is Rail => solid.kind === 'rail')) {
    const face = at(faceOf({ x: rail.x, w: rail.w, y: rail.y, h: rail.h }, board, 30))
    if (!face) continue
    face.crosses.push({ u: rail.y + rail.h / 2 - board.y, v: rail.z0 + rail.d / 2 - board.z })
  }
  for (const slide of boxes.filter((box) => box.assembly === 'slide')) {
    const face = at(faceOf(slide, board, 4))
    if (!face) continue
    // The pencil line is where the slide's bottom edge comes.
    const u = slide.y + slide.h - board.y
    if (face.slides.some((item) => Math.abs(item.u - u) < 2)) continue
    const [v0, v1] = span(slide)
    line(face, u, v0, v1)
    face.slides.push({ u, v0, length: v1 - v0 })
  }
  return faces
}

/** Face order for the bench: the face with slides first (or the busier one); an idle face is left out. */
function orderFaces(faces: Map<-1 | 1, BenchFace>, prefer: -1 | 1 | null): BenchFace[] {
  const right = faces.get(1)!
  const left = faces.get(-1)!
  let first: -1 | 1
  if (prefer) first = prefer
  else if (left.slides.length !== right.slides.length) first = left.slides.length > right.slides.length ? -1 : 1
  else first = work(left) > work(right) ? -1 : 1
  const order = first === -1 ? [left, right] : [right, left]
  return order.filter((face, index) => index === 0 || work(face) > 0)
}

/** Lines across the bottom (or the top) where each divider stands: both its edges. */
function flatBoard(flat: Box, dividers: Box[], name: string): BenchBoard | null {
  const face = emptyFace()
  for (const divider of dividers) {
    if (divider.x < flat.x || divider.x + divider.w > flat.x + flat.w) continue
    const touches =
      Math.abs(divider.y + divider.h - flat.y) <= 3 || Math.abs(divider.y - (flat.y + flat.h)) <= 3
    if (!touches) continue
    const v0 = Math.max(0, divider.z - flat.z)
    const v1 = Math.min(flat.d, v0 + divider.d)
    for (const edge of [divider.x, divider.x + divider.w]) {
      face.lines.push({ u0: edge - flat.x, v0, u1: edge - flat.x, v1 })
    }
  }
  if (face.lines.length === 0) return null
  return { name, u: flat.w, v: flat.d, thickness: flat.h, color: flat.color, faces: [face] }
}

/** Dividers that reach from the bottom to the top. The others are the short ones. */
export function splitDividers(solids: SceneSolid[]): { full: Box[]; short: Box[] } {
  const dividers = mainBoxes(solids, (name) => name.startsWith('divider'))
  const top = mainBoxes(solids, (name) => name === 'top')[0]
  const tallest = dividers.reduce((most, item) => Math.max(most, item.h), 0)
  const full = dividers.filter((item) =>
    top ? Math.abs(item.y - (top.y + top.h)) <= 3 || item.y <= top.y + top.h : item.h >= tallest - 3,
  )
  return { full, short: dividers.filter((item) => !full.includes(item)) }
}

export function benchGroups(solids: SceneSolid[]): BenchGroup[] {
  const groups: BenchGroup[] = []
  const sides = mainBoxes(solids, (name) => name === 'side-left' || name === 'side-right')
  const { full, short } = splitDividers(solids)

  // The two outer sides lie side by side, inner faces up: one line marks both at once.
  const sideBoards = sides.flatMap((side): BenchBoard[] => {
    const faces = uprightFaces(side, solids, true)
    const inner = faces.get(piece(side) === 'side-left' ? 1 : -1)!
    if (work(inner) === 0) return []
    const name = piece(side) === 'side-left' ? 'Лява страница' : 'Дясна страница'
    return [{ name, u: side.h, v: side.d, thickness: side.w, color: side.color, faces: [inner] }]
  })
  if (sideBoards.length > 0) {
    groups.push({
      key: 'sides',
      title: sideBoards.length > 1 ? 'Двете крайни страници' : 'Крайната страница',
      boards: sideBoards,
      mirrorSecond: true,
    })
  }

  const uprightBoards = (list: Box[], name: string) =>
    list.flatMap((board): BenchBoard[] => {
      const faces = orderFaces(uprightFaces(board, solids, false), null)
      if (faces.every((face) => work(face) === 0)) return []
      return [{ name, u: board.h, v: board.d, thickness: board.w, color: board.color, faces }]
    })
  const middle = uprightBoards(full, 'Средна разделителна страница')
  if (middle.length > 0) {
    groups.push({
      key: 'middle',
      title: middle.length > 1 ? 'Разделителните страници до горе' : 'Средната разделителна страница',
      boards: middle,
      mirrorSecond: false,
    })
  }
  const shortBoards = uprightBoards(short, 'Разделителна страница')
  if (shortBoards.length > 0) {
    groups.push({
      key: 'short',
      title: shortBoards.length > 1 ? 'Малките разделителни страници' : 'Малката разделителна страница',
      boards: shortBoards,
      mirrorSecond: false,
    })
  }

  const dividers = [...full, ...short]
  for (const [key, name, title] of [
    ['bottom', 'Дъно', 'Дъното'],
    ['top', 'Плот', 'Плотът'],
  ] as const) {
    const flat = mainBoxes(solids, (item) => item === key)[0]
    const board = flat ? flatBoard(flat, dividers, name) : null
    if (board) groups.push({ key, title, boards: [board], mirrorSecond: false })
  }
  return groups
}

/** One job on the bench: a face of the group's boards (after a flip for the second) and what is done on it. */
export type BenchPhase = 'mark' | 'pins' | 'slides'
export interface BenchJob {
  face: number
  phase: BenchPhase
}

export function benchJobs(group: BenchGroup): BenchJob[] {
  const faces = group.boards.reduce((most, board) => Math.max(most, board.faces.length), 0)
  const jobs: BenchJob[] = []
  for (let face = 0; face < faces; face += 1) {
    const all = group.boards.map((board) => board.faces[face] ?? emptyFace())
    const has = (pick: (item: BenchFace) => number) => all.some((item) => pick(item) > 0)
    if (has((item) => item.lines.length + item.crosses.length + item.points.length) || face > 0) jobs.push({ face, phase: 'mark' })
    if (has((item) => item.points.length)) jobs.push({ face, phase: 'pins' })
    if (has((item) => item.slides.length)) jobs.push({ face, phase: 'slides' })
  }
  return jobs
}

/** For the captions: how many of each thing a job makes. */
export function jobCounts(group: BenchGroup, face: number) {
  const all = group.boards.map((board) => board.faces[face] ?? emptyFace())
  return {
    lines: all.reduce((sum, item) => sum + item.lines.length, 0),
    crosses: all.reduce((sum, item) => sum + item.crosses.length, 0),
    points: all.reduce((sum, item) => sum + item.points.length, 0),
    slides: all.reduce((sum, item) => sum + item.slides.length, 0),
  }
}
