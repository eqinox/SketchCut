import {
  type ExpandedPart,
  type SheetDef,
  finalizePackedSheet,
  buildResult,
  expandParts,
  expandSheetPool,
  sortParts,
  filterMinimalWasteVariants,
  type PartInput,
} from './types'
import {
  type InternalSheet,
  createInternalSheet,
  applyPlacement,
  canFitOnSheet,
  findBestMinWasteMove,
  findBestOnSheet,
  partArea,
  gapArea,
} from './engine'

/** Pack one sheet until absolutely nothing else fits */
function fillSheetCompletely(sheet: InternalSheet, remaining: ExpandedPart[]): ExpandedPart[] {
  const pool = [...remaining]

  // Main loop: always pick move that minimizes waste on this sheet
  while (true) {
    const move = findBestMinWasteMove(sheet, pool)
    if (!move) break
    applyPlacement(sheet, pool[move.partIdx], move.placement)
    pool.splice(move.partIdx, 1)
  }

  // Gap fill: try smallest parts into smallest free gaps
  for (let pass = 0; pass < 20; pass++) {
    let placed = false
    const gaps = [...sheet.freeRects].sort((a, b) => gapArea(a) - gapArea(b))
    const bySize = [...pool].sort((a, b) => partArea(a) - partArea(b))

    for (const gap of gaps) {
      if (gap.width < 20 || gap.height < 20) continue
      for (const part of bySize) {
        const idx = pool.indexOf(part)
        if (idx < 0) continue
        const c = findBestOnSheet(sheet, part, 'bssf')
        if (!c) continue
        if (
          c.x >= gap.x - 1 &&
          c.y >= gap.y - 1 &&
          c.x + c.width <= gap.x + gap.width + 1 &&
          c.y + c.height <= gap.y + gap.height + 1
        ) {
          applyPlacement(sheet, part, c)
          pool.splice(idx, 1)
          placed = true
          break
        }
      }
      if (placed) break
    }

    if (!placed) {
      // Last resort: any part that fits anywhere
      for (let i = 0; i < pool.length; i++) {
        const c = findBestOnSheet(sheet, pool[i], 'cp')
        if (c) {
          applyPlacement(sheet, pool[i], c)
          pool.splice(i, 1)
          placed = true
          break
        }
      }
    }

    if (!placed) break
  }

  return pool
}

function nextCopyId(baseId: string, ids: string[]): string {
  let max = -1
  for (const id of ids) {
    if (id === baseId) {
      max = Math.max(max, 0)
      continue
    }
    if (!id.startsWith(`${baseId}-`)) continue
    const suffix = id.slice(baseId.length + 1)
    if (/^\d+$/.test(suffix)) max = Math.max(max, Number(suffix))
  }
  return `${baseId}-${max + 1}`
}

/** Pack onto the given sheets, then keep adding copies until every part that fits is placed. */
export function packSequential(
  sheetPool: SheetDef[],
  sortedParts: ExpandedPart[],
  variantKey: string,
  templates: SheetDef[] = sheetPool,
): import('@/types').PackingResult {
  const molds = templates.map((t) => ({
    id: t.id,
    width: t.width,
    height: t.height,
    hasGrain: t.hasGrain,
  }))
  const available = [...sheetPool]
  let remaining = [...sortedParts]
  const usedSheets: InternalSheet[] = []
  let guard = 0
  const guardLimit = Math.max(remaining.length * 2 + available.length + molds.length + 4, 8)

  while (remaining.length > 0 && guard < guardLimit) {
    guard++
    const idx = available.findIndex((s) => remaining.some((p) => canFitOnSheet(s, p)))
    if (idx < 0) {
      const mold = molds
        .filter((m) => remaining.some((p) => canFitOnSheet(m, p)))
        .sort((a, b) => b.width * b.height - a.width * a.height)[0]
      if (!mold) break
      const ids = [...usedSheets.map((s) => s.def.id), ...available.map((s) => s.id), mold.id]
      available.push({
        id: nextCopyId(mold.id, ids),
        width: mold.width,
        height: mold.height,
        hasGrain: mold.hasGrain,
      })
      continue
    }

    const def = available.splice(idx, 1)[0]!
    const before = remaining.length
    const sheet = createInternalSheet(def)
    remaining = fillSheetCompletely(sheet, remaining)
    if (sheet.placed.length > 0 && remaining.length < before) {
      usedSheets.push(sheet)
      continue
    }

    for (let i = molds.length - 1; i >= 0; i--) {
      if (molds[i]!.width === def.width && molds[i]!.height === def.height) molds.splice(i, 1)
    }
    for (let i = available.length - 1; i >= 0; i--) {
      if (available[i]!.width === def.width && available[i]!.height === def.height) {
        available.splice(i, 1)
      }
    }
  }

  const sheets = usedSheets.map((s) => finalizePackedSheet(s.def, s.placed, s.freeRects))
  return {
    ...buildResult(sheets, remaining.length, variantKey),
    unplaced: remaining.map((part) => ({
      label: part.label,
      width: part.width,
      height: part.height,
    })),
  }
}

const SORT_VARIANTS = [
  (a: ExpandedPart, b: ExpandedPart) => b.width * b.height - a.width * b.height,
  (a: ExpandedPart, b: ExpandedPart) => Math.max(b.width, b.height) - Math.max(a.width, a.height),
  (a: ExpandedPart, b: ExpandedPart) => b.width + b.height - (a.width + a.height),
]

const VARIANT_COUNT = 10

export interface PackingVariantOption {
  result: import('@/types').PackingResult
  label: string
}

/** Generate all sort variants and return only those with minimal waste. */
export function optimizeAllVariants(
  sheetDefs: { id: string; width: number; height: number; quantity?: number; hasGrain?: boolean }[],
  parts: PartInput[],
): PackingVariantOption[] {
  const expanded = expandParts(parts)
  const sheetPool = expandSheetPool(sheetDefs)
  const templates = sheetDefs.map((sheet) => ({
    id: sheet.id,
    width: sheet.width,
    height: sheet.height,
    hasGrain: sheet.hasGrain,
  }))

  if (expanded.length === 0) {
    return [
      {
        result: {
          success: true,
          sheets: [],
          totalWastePercent: 0,
          unplacedCount: 0,
          variantKey: 'empty',
        },
        label: 'Празен',
      },
    ]
  }

  if (sheetPool.length === 0 && templates.length === 0) {
    return [
      {
        result: {
          success: false,
          sheets: [],
          totalWastePercent: 100,
          unplacedCount: expanded.length,
          unplaced: expanded.map((part) => ({
            label: part.label,
            width: part.width,
            height: part.height,
          })),
          variantKey: 'no-sheets',
        },
        label: 'Без плочи',
      },
    ]
  }

  const allResults: import('@/types').PackingResult[] = []
  for (let i = 0; i < VARIANT_COUNT; i++) {
    const sorted = sortParts(expanded, i)
    allResults.push(packSequential(sheetPool, sorted, `v${i}`, templates))
  }

  const filtered = filterMinimalWasteVariants(allResults)

  return filtered.map((result, i) => ({
    result,
    label: `Вариант ${i + 1}`,
  }))
}

/** One calculation per click. Re-click for up to 2 alternate sort orders. */
export function optimizePacking(
  sheetDefs: { id: string; width: number; height: number; quantity?: number; hasGrain?: boolean }[],
  parts: PartInput[],
  clickIndex: number,
): { result: import('@/types').PackingResult; variantIndex: number } {
  const expanded = expandParts(parts)
  const sheetPool = expandSheetPool(sheetDefs)
  const templates = sheetDefs.map((sheet) => ({
    id: sheet.id,
    width: sheet.width,
    height: sheet.height,
    hasGrain: sheet.hasGrain,
  }))

  if (expanded.length === 0) {
    return {
      result: { success: true, sheets: [], totalWastePercent: 0, unplacedCount: 0, variantKey: 'empty' },
      variantIndex: clickIndex,
    }
  }

  if (sheetPool.length === 0 && templates.length === 0) {
    return {
      result: {
        success: false,
        sheets: [],
        totalWastePercent: 100,
        unplacedCount: expanded.length,
        unplaced: expanded.map((part) => ({
          label: part.label,
          width: part.width,
          height: part.height,
        })),
        variantKey: 'no-sheets',
      },
      variantIndex: clickIndex,
    }
  }

  const sorter = SORT_VARIANTS[clickIndex % SORT_VARIANTS.length]
  const sorted = [...expanded].sort(sorter)
  const result = packSequential(sheetPool, sorted, `v${clickIndex % 3}`, templates)

  return { result, variantIndex: clickIndex + 1 }
}

export { KERF, expandSheetPool, raiseSheetQuantities } from './types'
export type { FreeRect } from './types'
