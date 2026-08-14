import { computeFreeRectsFromPlaced } from '@/lib/packing/engine'
import { KERF, finalizePackedSheet } from '@/lib/packing/types'
import type { PackedSheet, PackingResult, PlacedPart } from '@/types'

/** Snap when within ~3 cm of a cut line or edge */
export const SNAP_THRESHOLD = 35

export interface SnapGuide {
  orientation: 'vertical' | 'horizontal'
  position: number
}

export interface ResolvedPosition {
  x: number
  y: number
  valid: boolean
  snapped: boolean
  guides: SnapGuide[]
}

function partsConflict(a: PlacedPart, b: PlacedPart, kerf = KERF): boolean {
  return !(
    a.x + a.width + kerf <= b.x ||
    b.x + b.width + kerf <= a.x ||
    a.y + a.height + kerf <= b.y ||
    b.y + b.height + kerf <= a.y
  )
}

export function isValidPartPosition(
  sheetWidth: number,
  sheetHeight: number,
  placed: PlacedPart[],
  partIndex: number,
  x: number,
  y: number,
): boolean {
  const part = placed[partIndex]
  const moved: PlacedPart = { ...part, x, y }

  if (x < 0 || y < 0) return false
  if (x + part.width > sheetWidth || y + part.height > sheetHeight) return false

  for (let i = 0; i < placed.length; i++) {
    if (i === partIndex) continue
    if (partsConflict(moved, placed[i])) return false
  }
  return true
}

function collectAxisCandidates(
  targets: number[],
  raw: number,
  threshold: number,
): number[] {
  const rounded = Math.round(raw)
  const candidates = new Set<number>([rounded])
  for (const t of targets) {
    const snapped = Math.round(t)
    if (Math.abs(raw - snapped) <= threshold) candidates.add(snapped)
  }
  return [...candidates]
}

function getSnapTargetsX(
  part: PlacedPart,
  placed: PlacedPart[],
  partIndex: number,
  sheetWidth: number,
): number[] {
  const w = part.width
  const targets = new Set<number>([0, sheetWidth - w])

  for (let i = 0; i < placed.length; i++) {
    if (i === partIndex) continue
    const o = placed[i]
    targets.add(o.x)
    targets.add(o.x + o.width - w)
    targets.add(o.x + o.width + KERF)
    targets.add(o.x - w - KERF)
  }
  return [...targets]
}

function getSnapTargetsY(
  part: PlacedPart,
  placed: PlacedPart[],
  partIndex: number,
  sheetHeight: number,
): number[] {
  const h = part.height
  const targets = new Set<number>([0, sheetHeight - h])

  for (let i = 0; i < placed.length; i++) {
    if (i === partIndex) continue
    const o = placed[i]
    targets.add(o.y)
    targets.add(o.y + o.height - h)
    targets.add(o.y + o.height + KERF)
    targets.add(o.y - h - KERF)
  }
  return [...targets]
}

function buildGuides(
  part: PlacedPart,
  placed: PlacedPart[],
  partIndex: number,
  x: number,
  y: number,
  sheetWidth: number,
  sheetHeight: number,
): SnapGuide[] {
  const guides: SnapGuide[] = []
  const w = part.width
  const h = part.height

  if (Math.abs(x) < 0.5) guides.push({ orientation: 'vertical', position: 0 })
  if (Math.abs(x + w - sheetWidth) < 0.5) {
    guides.push({ orientation: 'vertical', position: sheetWidth })
  }
  if (Math.abs(y) < 0.5) guides.push({ orientation: 'horizontal', position: 0 })
  if (Math.abs(y + h - sheetHeight) < 0.5) {
    guides.push({ orientation: 'horizontal', position: sheetHeight })
  }

  for (let i = 0; i < placed.length; i++) {
    if (i === partIndex) continue
    const o = placed[i]

    if (Math.abs(x - o.x) < 0.5) guides.push({ orientation: 'vertical', position: o.x })
    if (Math.abs(x + w - (o.x + o.width)) < 0.5) {
      guides.push({ orientation: 'vertical', position: o.x + o.width })
    }
    if (Math.abs(x - (o.x + o.width + KERF)) < 0.5) {
      guides.push({ orientation: 'vertical', position: o.x + o.width + KERF / 2 })
    }
    if (Math.abs(x + w - (o.x - KERF)) < 0.5) {
      guides.push({ orientation: 'vertical', position: o.x - KERF / 2 })
    }

    if (Math.abs(y - o.y) < 0.5) guides.push({ orientation: 'horizontal', position: o.y })
    if (Math.abs(y + h - (o.y + o.height)) < 0.5) {
      guides.push({ orientation: 'horizontal', position: o.y + o.height })
    }
    if (Math.abs(y - (o.y + o.height + KERF)) < 0.5) {
      guides.push({ orientation: 'horizontal', position: o.y + o.height + KERF / 2 })
    }
    if (Math.abs(y + h - (o.y - KERF)) < 0.5) {
      guides.push({ orientation: 'horizontal', position: o.y - KERF / 2 })
    }
  }

  return guides
}

function makeResolved(
  x: number,
  y: number,
  part: PlacedPart,
  placed: PlacedPart[],
  partIndex: number,
  sheetWidth: number,
  sheetHeight: number,
  snapped: boolean,
): ResolvedPosition {
  const valid = isValidPartPosition(sheetWidth, sheetHeight, placed, partIndex, x, y)
  return {
    x,
    y,
    valid,
    snapped: snapped && valid,
    guides:
      snapped && valid
        ? buildGuides(part, placed, partIndex, x, y, sheetWidth, sheetHeight)
        : [],
  }
}

/** Snap to nearest cut line / edge and return the best valid position. */
export function resolvePartPosition(
  sheetWidth: number,
  sheetHeight: number,
  placed: PlacedPart[],
  partIndex: number,
  rawX: number,
  rawY: number,
  threshold = SNAP_THRESHOLD,
): ResolvedPosition {
  const part = placed[partIndex]
  const xCandidates = collectAxisCandidates(
    getSnapTargetsX(part, placed, partIndex, sheetWidth),
    rawX,
    threshold,
  )
  const yCandidates = collectAxisCandidates(
    getSnapTargetsY(part, placed, partIndex, sheetHeight),
    rawY,
    threshold,
  )

  const pairs: { x: number; y: number; dist: number; snapped: boolean }[] = []

  for (const x of xCandidates) {
    for (const y of yCandidates) {
      const snapped = x !== Math.round(rawX) || y !== Math.round(rawY)
      const dist = Math.hypot(x - rawX, y - rawY)
      pairs.push({ x, y, dist, snapped })
    }
  }

  pairs.sort((a, b) => {
    if (a.snapped !== b.snapped) return a.snapped ? -1 : 1
    return a.dist - b.dist
  })

  for (const { x, y, snapped } of pairs) {
    const result = makeResolved(
      x,
      y,
      part,
      placed,
      partIndex,
      sheetWidth,
      sheetHeight,
      snapped,
    )
    if (result.valid) return result
  }

  const rawRoundedX = Math.round(rawX)
  const rawRoundedY = Math.round(rawY)

  for (const x of xCandidates) {
    if (x === rawRoundedX) continue
    const result = makeResolved(
      x,
      rawRoundedY,
      part,
      placed,
      partIndex,
      sheetWidth,
      sheetHeight,
      true,
    )
    if (result.valid) return result
  }

  for (const y of yCandidates) {
    if (y === rawRoundedY) continue
    const result = makeResolved(
      rawRoundedX,
      y,
      part,
      placed,
      partIndex,
      sheetWidth,
      sheetHeight,
      true,
    )
    if (result.valid) return result
  }

  return makeResolved(
    rawRoundedX,
    rawRoundedY,
    part,
    placed,
    partIndex,
    sheetWidth,
    sheetHeight,
    false,
  )
}

export function updatePackedSheetPart(
  sheet: PackedSheet,
  partIndex: number,
  x: number,
  y: number,
): PackedSheet | null {
  const resolved = resolvePartPosition(
    sheet.sheetWidth,
    sheet.sheetHeight,
    sheet.placed,
    partIndex,
    x,
    y,
  )
  if (!resolved.valid) return null

  const placed = sheet.placed.map((p, i) =>
    i === partIndex ? { ...p, x: resolved.x, y: resolved.y } : p,
  )
  const freeRects = computeFreeRectsFromPlaced(sheet.sheetWidth, sheet.sheetHeight, placed)

  return finalizePackedSheet(
    { id: sheet.sheetId, width: sheet.sheetWidth, height: sheet.sheetHeight },
    placed,
    freeRects,
  )
}

function totalWastePercent(sheets: PackedSheet[]): number {
  const totalArea = sheets.reduce((s, sh) => s + sh.sheetWidth * sh.sheetHeight, 0)
  const totalWaste = sheets.reduce((s, sh) => s + sh.wasteArea, 0)
  return totalArea > 0 ? (totalWaste / totalArea) * 100 : 0
}

export function updatePackingResultPart(
  result: PackingResult,
  sheetIndex: number,
  partIndex: number,
  x: number,
  y: number,
): PackingResult | null {
  const sheet = result.sheets[sheetIndex]
  if (!sheet) return null

  const updatedSheet = updatePackedSheetPart(sheet, partIndex, x, y)
  if (!updatedSheet) return null

  const sheets = result.sheets.map((s, i) => (i === sheetIndex ? updatedSheet : s))
  return {
    ...result,
    sheets,
    totalWastePercent: totalWastePercent(sheets),
  }
}
