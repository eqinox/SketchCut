import { parsePieceFinishes } from '@/lib/board-finishes'
import type { CabinetInstance } from '@/lib/cabinets'
import { isCombinationType } from '@/lib/cabinets/compose'

/** '' is the plain board a cabinet gets when no colour was chosen. */
export const PLAIN_BOARD = ''

export type ColorUse = {
  finishId: string
  /** Cabinets whose carcass is this colour. */
  carcass: number
  /** Cabinets whose doors and drawer fronts are this colour (also when they follow the carcass). */
  fronts: number
  /** Single pieces given this colour on their own (a side, a shelf…). */
  pieces: number
}

function idOf(value: unknown): string {
  return typeof value === 'string' ? value : PLAIN_BOARD
}

/** Every board colour the project uses, most used first. */
export function colorsInUse(cabinets: CabinetInstance[]): ColorUse[] {
  const uses = new Map<string, ColorUse>()
  const row = (finishId: string) => {
    let use = uses.get(finishId)
    if (!use) {
      use = { finishId, carcass: 0, fronts: 0, pieces: 0 }
      uses.set(finishId, use)
    }
    return use
  }
  for (const cabinet of cabinets) {
    if (isCombinationType(cabinet.typeId)) continue
    const carcass = idOf(cabinet.params.carcassFinishId)
    const front = idOf(cabinet.params.frontFinishId) || carcass
    row(carcass).carcass += 1
    row(front).fronts += 1
    for (const finishId of Object.values(parsePieceFinishes(cabinet.params.pieceFinishes))) {
      row(finishId).pieces += 1
    }
  }
  return [...uses.values()].sort(
    (a, b) => b.carcass + b.fronts + b.pieces - (a.carcass + a.fronts + a.pieces),
  )
}

/**
 * The same cabinet with one colour swapped for another wherever it is used: carcass, doors and
 * single pieces. Null when nothing changes.
 */
export function swapColor(
  params: Record<string, unknown>,
  from: string,
  to: string,
): Record<string, unknown> | null {
  if (from === to) return null
  const next: Record<string, unknown> = { ...params }
  let changed = false
  // Doors that follow the carcass are that colour too, so they change with it.
  if (idOf(params.carcassFinishId) === from) {
    if (to) next.carcassFinishId = to
    else delete next.carcassFinishId
    changed = true
  }
  const front = idOf(params.frontFinishId)
  if (front && front === from) {
    next.frontFinishId = to
    changed = true
  }
  // A door colour equal to the carcass is the same as "like the carcass".
  if (idOf(next.frontFinishId) && idOf(next.frontFinishId) === idOf(next.carcassFinishId)) {
    delete next.frontFinishId
  }
  const pieces = parsePieceFinishes(params.pieceFinishes)
  let piecesChanged = false
  for (const [piece, finishId] of Object.entries(pieces)) {
    if (finishId !== from) continue
    if (to) pieces[piece] = to
    else delete pieces[piece]
    piecesChanged = true
  }
  if (piecesChanged) {
    if (Object.keys(pieces).length > 0) next.pieceFinishes = pieces
    else delete next.pieceFinishes
    changed = true
  }
  return changed ? next : null
}
