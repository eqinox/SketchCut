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

export function packSequential(
  sheetPool: SheetDef[],
  sortedParts: ExpandedPart[],
  variantKey: string,
): import('@/types').PackingResult {
  const available = [...sheetPool]
  let remaining = [...sortedParts]
  const usedSheets: InternalSheet[] = []

  while (remaining.length > 0 && available.length > 0) {
    const def = available.shift()!

    if (!remaining.some((p) => canFitOnSheet(def, p))) {
      const altIdx = available.findIndex((s) => remaining.some((p) => canFitOnSheet(s, p)))
      if (altIdx >= 0) {
        available.unshift(def)
        available.unshift(available.splice(altIdx, 1)[0])
        continue
      }
      break
    }

    const sheet = createInternalSheet(def)
    remaining = fillSheetCompletely(sheet, remaining)

    if (sheet.placed.length > 0) {
      usedSheets.push(sheet)
    } else {
      break
    }
  }

  const sheets = usedSheets.map((s) => finalizePackedSheet(s.def, s.placed, s.freeRects))
  return buildResult(sheets, remaining.length, variantKey)
}

const SORT_VARIANTS = [
  (a: ExpandedPart, b: ExpandedPart) => b.width * b.height - a.width * b.height,
  (a: ExpandedPart, b: ExpandedPart) => Math.max(b.width, b.height) - Math.max(a.width, a.height),
  (a: ExpandedPart, b: ExpandedPart) => b.width + b.height - (a.width + a.height),
]

const VARIANT_COUNT = 10

const VARIANT_NAMES = [
  'площ ↓',
  'страна ↓',
  'ширина ↓',
  'височина ↓',
  'периметър ↓',
  'площ ↑',
  'мин. страна ↓',
  'съотношение ↓',
  'височина ↑',
  'ширина ↑',
]

export interface PackingVariantOption {
  result: import('@/types').PackingResult
  label: string
}

/** Generate all sort variants and return only those with minimal waste. */
export function optimizeAllVariants(
  sheetDefs: { id: string; width: number; height: number; quantity?: number }[],
  parts: PartInput[],
): PackingVariantOption[] {
  const expanded = expandParts(parts)
  const sheetPool = expandSheetPool(sheetDefs)

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

  if (sheetPool.length === 0) {
    return [
      {
        result: {
          success: false,
          sheets: [],
          totalWastePercent: 100,
          unplacedCount: expanded.length,
          variantKey: 'no-sheets',
        },
        label: 'Без плочи',
      },
    ]
  }

  const allResults: import('@/types').PackingResult[] = []
  for (let i = 0; i < VARIANT_COUNT; i++) {
    const sorted = sortParts(expanded, i)
    allResults.push(packSequential(sheetPool, sorted, `v${i}`))
  }

  const filtered = filterMinimalWasteVariants(allResults)

  return filtered.map((result) => {
    const idx = parseInt(result.variantKey.replace('v', ''), 10)
    const name = VARIANT_NAMES[idx] ?? `вариант ${idx + 1}`
    return {
      result,
      label: `Разкрой · ${name}`,
    }
  })
}

/** One calculation per click. Re-click for up to 2 alternate sort orders. */
export function optimizePacking(
  sheetDefs: { id: string; width: number; height: number; quantity?: number }[],
  parts: PartInput[],
  clickIndex: number,
): { result: import('@/types').PackingResult; variantIndex: number } {
  const expanded = expandParts(parts)
  const sheetPool = expandSheetPool(sheetDefs)

  if (expanded.length === 0) {
    return {
      result: { success: true, sheets: [], totalWastePercent: 0, unplacedCount: 0, variantKey: 'empty' },
      variantIndex: clickIndex,
    }
  }

  if (sheetPool.length === 0) {
    return {
      result: {
        success: false,
        sheets: [],
        totalWastePercent: 100,
        unplacedCount: expanded.length,
        variantKey: 'no-sheets',
      },
      variantIndex: clickIndex,
    }
  }

  const sorter = SORT_VARIANTS[clickIndex % SORT_VARIANTS.length]
  const sorted = [...expanded].sort(sorter)
  const result = packSequential(sheetPool, sorted, `v${clickIndex % 3}`)

  return { result, variantIndex: clickIndex + 1 }
}

export function getVariantLabel(clickIndex: number): string {
  const names = ['площ ↓', 'страна ↓', 'периметър ↓']
  return `Разкрой · ${names[clickIndex % 3]}`
}

export { KERF, expandSheetPool } from './types'
export type { FreeRect } from './types'
