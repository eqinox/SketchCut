import type { PlacedPart } from '@/types'
import {
  type ExpandedPart,
  type FreeRect,
  type SheetDef,
  getOrientations,
  placementBounds,
} from './types'

export type Heuristic = 'bssf' | 'baf' | 'cp'

export interface PlacementCandidate {
  x: number
  y: number
  width: number
  height: number
  rotated: boolean
  score: number
}

export interface InternalSheet {
  def: SheetDef
  freeRects: FreeRect[]
  placed: PlacedPart[]
}

export function cloneSheet(sheet: InternalSheet): InternalSheet {
  return {
    def: sheet.def,
    freeRects: sheet.freeRects.map((r) => ({ ...r })),
    placed: sheet.placed.map((p) => ({ ...p })),
  }
}

export function fits(freeRect: FreeRect, pw: number, ph: number): boolean {
  return pw <= freeRect.width && ph <= freeRect.height
}

function contactPointBonus(sheet: InternalSheet, x: number, y: number, w: number, h: number): number {
  let bonus = 0
  if (x === 0) bonus += 2000
  if (y === 0) bonus += 2000
  if (x + w === sheet.def.width) bonus += 800
  if (y + h === sheet.def.height) bonus += 800
  for (const p of sheet.placed) {
    if (x === p.x + p.width || x + w === p.x) bonus += 1000
    if (y === p.y + p.height || y + h === p.y) bonus += 1000
  }
  return bonus
}

export function scorePlacement(
  sheet: InternalSheet,
  freeRect: FreeRect,
  pw: number,
  ph: number,
  x: number,
  y: number,
  heuristic: Heuristic,
): number {
  const leftoverW = freeRect.width - pw
  const leftoverH = freeRect.height - ph
  switch (heuristic) {
    case 'bssf':
      return Math.min(leftoverW, leftoverH)
    case 'baf':
      return freeRect.width * freeRect.height - pw * ph
    case 'cp':
      return y * 1000 + x - contactPointBonus(sheet, x, y, pw, ph)
  }
}

function rectsIntersect(a: FreeRect, b: FreeRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function splitFreeRect(freeRect: FreeRect, occupied: FreeRect): FreeRect[] {
  if (!rectsIntersect(freeRect, occupied)) return [freeRect]

  const result: FreeRect[] = []
  const { x: ox, y: oy, width: ow, height: oh } = occupied

  if (ox > freeRect.x) {
    result.push({ x: freeRect.x, y: freeRect.y, width: ox - freeRect.x, height: freeRect.height })
  }
  if (ox + ow < freeRect.x + freeRect.width) {
    result.push({
      x: ox + ow,
      y: freeRect.y,
      width: freeRect.x + freeRect.width - (ox + ow),
      height: freeRect.height,
    })
  }
  const topX = Math.max(freeRect.x, ox)
  const topRight = Math.min(freeRect.x + freeRect.width, ox + ow)
  if (oy > freeRect.y && topRight > topX) {
    result.push({ x: topX, y: freeRect.y, width: topRight - topX, height: oy - freeRect.y })
  }
  const botX = Math.max(freeRect.x, ox)
  const botRight = Math.min(freeRect.x + freeRect.width, ox + ow)
  if (oy + oh < freeRect.y + freeRect.height && botRight > botX) {
    result.push({
      x: botX,
      y: oy + oh,
      width: botRight - botX,
      height: freeRect.y + freeRect.height - (oy + oh),
    })
  }
  return result.filter((r) => r.width > 0 && r.height > 0)
}

function pruneFreeRects(freeRects: FreeRect[]): FreeRect[] {
  return freeRects.filter((r, i) => {
    if (r.width <= 0 || r.height <= 0) return false
    return !freeRects.some((other, j) => {
      if (i === j) return false
      return (
        r.x >= other.x &&
        r.y >= other.y &&
        r.x + r.width <= other.x + other.width &&
        r.y + r.height <= other.y + other.height
      )
    })
  })
}

export function createInternalSheet(def: SheetDef): InternalSheet {
  return {
    def,
    freeRects: [{ x: 0, y: 0, width: def.width, height: def.height }],
    placed: [],
  }
}

export function findBestOnSheet(
  sheet: InternalSheet,
  part: ExpandedPart,
  heuristic: Heuristic,
): PlacementCandidate | null {
  let best: PlacementCandidate | null = null
  for (const fr of sheet.freeRects) {
    for (const o of getOrientations(part)) {
      if (!fits(fr, o.w, o.h)) continue
      const score = scorePlacement(sheet, fr, o.w, o.h, fr.x, fr.y, heuristic)
      if (!best || score < best.score) {
        best = { x: fr.x, y: fr.y, width: o.w, height: o.h, rotated: o.rotated, score }
      }
    }
  }
  return best
}

export function applyPlacement(sheet: InternalSheet, part: ExpandedPart, p: PlacementCandidate): void {
  sheet.placed.push({
    partId: part.partId,
    label: part.label,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    rotated: p.rotated,
  })
  const occupied = placementBounds(p.x, p.y, p.width, p.height, sheet.def.width, sheet.def.height)
  const next: FreeRect[] = []
  for (const fr of sheet.freeRects) next.push(...splitFreeRect(fr, occupied))
  sheet.freeRects = pruneFreeRects(next)
}

export function sheetUsedArea(sheet: InternalSheet): number {
  return sheet.placed.reduce((s, p) => s + p.width * p.height, 0)
}

export function sheetWasteArea(sheet: InternalSheet): number {
  return sheet.def.width * sheet.def.height - sheetUsedArea(sheet)
}

export function canFitOnSheet(sheet: SheetDef, part: ExpandedPart): boolean {
  return getOrientations(part).some((o) => o.w <= sheet.width && o.h <= sheet.height)
}

export function partArea(part: ExpandedPart): number {
  return part.width * part.height
}

export function anyPartFits(sheet: InternalSheet, pool: ExpandedPart[]): boolean {
  return pool.some((p) => findBestOnSheet(sheet, p, 'bssf') !== null)
}

const TRY_HEURISTICS: Heuristic[] = ['baf', 'bssf', 'cp']

/** Simulate placement and return remaining waste area on sheet */
export function wasteAfterPlacement(
  sheet: InternalSheet,
  part: ExpandedPart,
  placement: PlacementCandidate,
): number {
  const sim = cloneSheet(sheet)
  applyPlacement(sim, part, placement)
  return sheetWasteArea(sim)
}

/** Best part + placement that minimizes sheet waste after placing */
export function findBestMinWasteMove(
  sheet: InternalSheet,
  pool: ExpandedPart[],
): { partIdx: number; placement: PlacementCandidate } | null {
  let best: { partIdx: number; placement: PlacementCandidate; waste: number } | null = null

  for (let i = 0; i < pool.length; i++) {
    for (const h of TRY_HEURISTICS) {
      const c = findBestOnSheet(sheet, pool[i], h)
      if (!c) continue
      const waste = wasteAfterPlacement(sheet, pool[i], c)
      if (!best || waste < best.waste || (waste === best.waste && partArea(pool[i]) > partArea(pool[best.partIdx]))) {
        best = { partIdx: i, placement: c, waste }
      }
    }
  }

  return best ? { partIdx: best.partIdx, placement: best.placement } : null
}

export function gapArea(gap: FreeRect): number {
  return gap.width * gap.height
}

/** Recompute remaining free rectangles after manual part placement. */
export function computeFreeRectsFromPlaced(
  sheetWidth: number,
  sheetHeight: number,
  placed: PlacedPart[],
): FreeRect[] {
  let freeRects: FreeRect[] = [{ x: 0, y: 0, width: sheetWidth, height: sheetHeight }]
  for (const p of placed) {
    const occupied = placementBounds(p.x, p.y, p.width, p.height, sheetWidth, sheetHeight)
    const next: FreeRect[] = []
    for (const fr of freeRects) next.push(...splitFreeRect(fr, occupied))
    freeRects = pruneFreeRects(next)
  }
  return freeRects
}
