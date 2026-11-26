import type { SceneSolid } from '@/lib/cabinets/scene-solids'

/**
 * What is done on the loose boards before the carcass goes together, laid out on the bench:
 * pencil lines for drawer slides, fixed shelves and dividers, points for shelf pins, and the
 * cabinet half of each drawer slide. Board coordinates: `u` along the board's length (for a side,
 * from its top edge down), `v` across it (from the front edge back), in mm.
 */
export interface BenchBoard {
  name: string
  /** Length and width of the face that is marked. */
  u: number
  v: number
  thickness: number
  color: string
  lines: { u0: number; v0: number; u1: number; v1: number }[]
  points: { u: number; v: number }[]
  slides: { u: number; v0: number; length: number }[]
}

/** Shelf pins: one pair per shelf on each side, this far in from the front and the back edge. */
export const PIN_EDGE_MM = 50
/** The pin's hole sits this far under the shelf. */
const PIN_UNDER_SHELF_MM = 6

type Box = Extract<SceneSolid, { kind: 'box' }>

const isBox = (solid: SceneSolid): solid is Box => solid.kind === 'box'
const piece = (box: Box) => box.piece ?? ''

/** True when a part stands against this upright board (a side or a divider), on either face. */
function against(part: Box, board: Box, reach: number): boolean {
  const right = Math.abs(part.x - (board.x + board.w)) <= reach
  const left = Math.abs(part.x + part.w - board.x) <= reach
  const sameHeight = part.y < board.y + board.h && part.y + part.h > board.y
  return (right || left) && sameHeight
}

export function benchPlan(solids: SceneSolid[]): BenchBoard[] {
  const boxes = solids.filter(isBox)
  // The same board can be captured twice; keep one of each.
  const seen = new Set<string>()
  const uprights = boxes.filter((box) => {
    if (!/^(side-left|side-right|divider)/.test(piece(box))) return false
    const key = [box.x, box.y, box.w, box.h, box.z, box.d].map(Math.round).join(',')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const shelves = boxes.filter((box) => piece(box).startsWith('shelf-'))
  // The cabinet half of each drawer slide, where the 3D picture draws it.
  const rails = boxes.filter((box) => box.assembly === 'slide')
  const boards: BenchBoard[] = []

  for (const board of uprights) {
    const lines: BenchBoard['lines'] = []
    const points: BenchBoard['points'] = []
    const slides: BenchBoard['slides'] = []
    const name = piece(board).startsWith('divider') ? 'Разделителна страница' : piece(board) === 'side-left' ? 'Лява страница' : 'Дясна страница'
    for (const shelf of shelves) {
      if (!against(shelf, board, 30)) continue
      const fixed = /^shelf-\d+$/.test(piece(shelf))
      if (fixed) {
        // A fixed shelf is screwed through the side: a line where its middle comes.
        const u = shelf.y + shelf.h / 2 - board.y
        lines.push({ u0: u, v0: 0, u1: u, v1: board.d })
      } else {
        const u = shelf.y + shelf.h + PIN_UNDER_SHELF_MM - board.y
        for (const v of [PIN_EDGE_MM, board.d - PIN_EDGE_MM]) {
          if (!points.some((point) => Math.abs(point.u - u) < 2 && Math.abs(point.v - v) < 2)) points.push({ u, v })
        }
      }
    }
    for (const rail of rails) {
      if (!against(rail, board, 4)) continue
      // The pencil line is where the slide's bottom edge comes.
      const u = rail.y + rail.h - board.y
      if (slides.some((slide) => Math.abs(slide.u - u) < 2)) continue
      const v0 = Math.max(0, rail.z - board.z)
      const length = Math.min(board.d - v0, rail.d)
      lines.push({ u0: u, v0, u1: u, v1: v0 + length })
      slides.push({ u, v0, length })
    }
    if (lines.length + points.length === 0) continue
    boards.push({ name, u: board.h, v: board.d, thickness: board.w, color: board.color, lines, points, slides })
  }

  // Where a divider stands, two lines on the bottom (and the top) across its depth.
  const dividers = boxes.filter((box) => piece(box).startsWith('divider'))
  for (const flat of boxes.filter((box) => /^(bottom|top)$/.test(piece(box)))) {
    const lines: BenchBoard['lines'] = []
    for (const divider of dividers) {
      if (divider.x < flat.x || divider.x + divider.w > flat.x + flat.w) continue
      for (const edge of [divider.x, divider.x + divider.w]) {
        lines.push({ u0: edge - flat.x, v0: 0, u1: edge - flat.x, v1: flat.d })
      }
    }
    if (lines.length === 0) continue
    boards.push({
      name: piece(flat) === 'top' ? 'Плот' : 'Дъно',
      u: flat.w,
      v: flat.d,
      thickness: flat.h,
      color: flat.color,
      lines,
      points: [],
      slides: [],
    })
  }
  return boards
}
