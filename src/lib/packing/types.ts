export const KERF = 3

export interface FreeRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ExpandedPart {
  id: string
  partId: string
  width: number
  height: number
  canRotate: boolean
  label: string
}

export interface SheetDef {
  id: string
  width: number
  height: number
}

export interface PartInput {
  id: string
  width: number
  height: number
  quantity: number
  canRotate: boolean
  label: string
}

export function expandParts(parts: PartInput[]): ExpandedPart[] {
  const expanded: ExpandedPart[] = []
  for (const part of parts) {
    for (let i = 0; i < part.quantity; i++) {
      expanded.push({
        id: `${part.id}-${i}`,
        partId: part.id,
        width: part.width,
        height: part.height,
        canRotate: part.canRotate,
        label: part.label,
      })
    }
  }
  return expanded
}

export function expandSheetPool(
  sheets: { id: string; width: number; height: number; quantity?: number }[],
): SheetDef[] {
  const pool: SheetDef[] = []
  for (const sheet of sheets) {
    const qty = sheet.quantity ?? 1
    for (let i = 0; i < qty; i++) {
      pool.push({
        id: qty > 1 ? `${sheet.id}-${i}` : sheet.id,
        width: sheet.width,
        height: sheet.height,
      })
    }
  }
  return pool
}

export function getOrientations(part: ExpandedPart): { w: number; h: number; rotated: boolean }[] {
  const orientations = [{ w: part.width, h: part.height, rotated: false }]
  if (part.canRotate && part.width !== part.height) {
    orientations.push({ w: part.height, h: part.width, rotated: true })
  }
  return orientations
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const result = [...items]
  let s = seed
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function sortParts(parts: ExpandedPart[], variantIndex: number): ExpandedPart[] {
  const sorters: ((a: ExpandedPart, b: ExpandedPart) => number)[] = [
    (a, b) => b.width * b.height - a.width * a.height,
    (a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height),
    (a, b) => b.width - a.width,
    (a, b) => b.height - a.height,
    (a, b) => b.width + b.height - (a.width + a.height),
    (a, b) => a.width * a.height - b.width * b.height,
    (a, b) => Math.min(b.width, b.height) - Math.min(a.width, a.height),
    (a, b) => b.width / b.height - a.width / a.height,
    (a, b) => a.height - b.height,
    (a, b) => a.width - b.width,
  ]

  const sorter = sorters[variantIndex % sorters.length]
  const shuffleRound = Math.floor(variantIndex / sorters.length)
  const sorted = [...parts].sort(sorter)
  if (shuffleRound === 0) return sorted
  return seededShuffle(sorted, shuffleRound * 31 + variantIndex)
}

export function placementBounds(
  x: number,
  y: number,
  w: number,
  h: number,
  sheetW: number,
  sheetH: number,
): FreeRect {
  const kerfRight = x + w + KERF <= sheetW ? KERF : 0
  const kerfBottom = y + h + KERF <= sheetH ? KERF : 0
  return { x, y, width: w + kerfRight, height: h + kerfBottom }
}

export function finalizePackedSheet(
  sheet: SheetDef,
  placed: import('@/types').PlacedPart[],
  freeRects: FreeRect[] = [],
): import('@/types').PackedSheet {
  const sheetArea = sheet.width * sheet.height
  const usedArea = placed.reduce((sum, p) => sum + p.width * p.height, 0)
  const wasteArea = sheetArea - usedArea
  return {
    sheetId: sheet.id,
    sheetWidth: sheet.width,
    sheetHeight: sheet.height,
    placed,
    wasteRects: freeRects.filter((r) => r.width > 0 && r.height > 0),
    usedArea,
    wasteArea,
    wastePercent: sheetArea > 0 ? (wasteArea / sheetArea) * 100 : 0,
  }
}

export function buildResult(
  sheets: import('@/types').PackedSheet[],
  unplacedCount: number,
  variantKey: string,
): import('@/types').PackingResult {
  const totalArea = sheets.reduce((s, sh) => s + sh.sheetWidth * sh.sheetHeight, 0)
  const totalWaste = sheets.reduce((s, sh) => s + sh.wasteArea, 0)
  return {
    success: unplacedCount === 0,
    sheets,
    totalWastePercent: totalArea > 0 ? (totalWaste / totalArea) * 100 : 0,
    unplacedCount,
    variantKey,
  }
}

export function isBetterResult(
  a: import('@/types').PackingResult,
  b: import('@/types').PackingResult | null,
): boolean {
  if (!b) return true
  if (a.unplacedCount === 0 && b.unplacedCount > 0) return true
  if (a.unplacedCount > 0 && b.unplacedCount === 0) return false
  if (a.unplacedCount !== b.unplacedCount) return a.unplacedCount < b.unplacedCount
  if (a.sheets.length !== b.sheets.length) return a.sheets.length < b.sheets.length

  // Zero waste on all sheets except the last
  const aMid = midSheetWaste(a)
  const bMid = midSheetWaste(b)
  if (aMid !== bMid) return aMid < bMid

  // Prefer lower waste on second-to-last if 3+ sheets
  if (a.sheets.length >= 2 && b.sheets.length >= 2) {
    const aPenult = a.sheets[a.sheets.length - 2].wasteArea
    const bPenult = b.sheets[b.sheets.length - 2].wasteArea
    if (aPenult !== bPenult) return aPenult < bPenult
  }

  return a.totalWastePercent < b.totalWastePercent
}

function midSheetWaste(result: import('@/types').PackingResult): number {
  if (result.sheets.length <= 1) return 0
  return result.sheets.slice(0, -1).reduce((s, sh) => s + sh.wasteArea, 0)
}

/** Keep only variants tied for lowest waste (same tier as the best result). */
export function filterMinimalWasteVariants(
  variants: import('@/types').PackingResult[],
): import('@/types').PackingResult[] {
  if (variants.length === 0) return []

  let best = variants[0]
  for (const v of variants.slice(1)) {
    if (isBetterResult(v, best)) best = v
  }

  const bestWasteRounded = Math.round(best.totalWastePercent * 10) / 10

  return variants.filter(
    (v) =>
      v.unplacedCount === best.unplacedCount &&
      v.sheets.length === best.sheets.length &&
      Math.round(v.totalWastePercent * 10) / 10 === bestWasteRounded,
  )
}
