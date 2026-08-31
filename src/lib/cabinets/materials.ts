import type { BoardKind, Sheet } from '@/types'

export type { BoardKind }

export const DEFAULT_CHIPBOARD_WIDTH = 2780
export const DEFAULT_CHIPBOARD_HEIGHT = 2040
export const DEFAULT_CHIPBOARD_PRICE_EUR = 86

export const DEFAULT_HARDBOARD_WIDTH = 2800
export const DEFAULT_HARDBOARD_HEIGHT = 2070
export const DEFAULT_HARDBOARD_PRICE_EUR = 0
export const DEFAULT_HARDBOARD_THICKNESS = 3

/** Thick edge banding (2 mm). */
export const EDGE_PRICE_MM2_EUR = 0.7
/** Regular edge banding (0.5 mm). */
export const EDGE_PRICE_MM05_EUR = 0.35

/** Saw time for one full sheet, including chipboard and hardboard. */
export const CUTTING_MINUTES_PER_SHEET = 40
/** Edgebander time for one full chipboard sheet (hardboard is not edged). */
export const EDGING_MINUTES_PER_SHEET = 30

/** Gap at the top of a door, mm. */
export const DOOR_CLEARANCE_TOP = 5
/** Gap at the bottom of a door, mm. */
export const DOOR_CLEARANCE_BOTTOM = 0
/** Gaps (фуги) subtracted from each door's share of the cabinet width, mm. */
export const DOOR_GAP_X = 3
/** 2 mm banding on both opposite edges. */
export const DOOR_EDGE_BOTH = 4

export function sheetKind(sheet: Pick<Sheet, 'kind'> | undefined): BoardKind {
  return sheet?.kind === 'hardboard' ? 'hardboard' : 'chipboard'
}

export function partKind(part: { kind?: BoardKind } | undefined): BoardKind {
  return part?.kind === 'hardboard' ? 'hardboard' : 'chipboard'
}

export function defaultSheetPrice(kind: BoardKind): number {
  return kind === 'hardboard' ? DEFAULT_HARDBOARD_PRICE_EUR : DEFAULT_CHIPBOARD_PRICE_EUR
}

export function normalizeSheet(sheet: Sheet): Sheet {
  const kind = sheetKind(sheet)
  const price =
    typeof sheet.priceEur === 'number' && Number.isFinite(sheet.priceEur) && sheet.priceEur >= 0
      ? sheet.priceEur
      : defaultSheetPrice(kind)
  return { ...sheet, kind, priceEur: price, quantity: sheet.quantity ?? 1 }
}

export function sheetAreaM2(width: number, height: number): number {
  return (width * height) / 1_000_000
}

export function sheetFraction(usedAreaM2: number, sheetWidth: number, sheetHeight: number): number {
  const full = sheetAreaM2(sheetWidth, sheetHeight)
  if (full <= 0 || usedAreaM2 <= 0) return 0
  return usedAreaM2 / full
}

/** Price of used board as a fraction of one full sheet. */
export function usedBoardCostEur(
  usedAreaM2: number,
  sheetWidth: number,
  sheetHeight: number,
  sheetPriceEur: number,
): number {
  const full = sheetAreaM2(sheetWidth, sheetHeight)
  if (full <= 0 || sheetPriceEur <= 0 || usedAreaM2 <= 0) return 0
  return (usedAreaM2 / full) * sheetPriceEur
}

export function edgeBandingCostEur(mm2Meters: number, mm05Meters: number): number {
  return mm2Meters * EDGE_PRICE_MM2_EUR + mm05Meters * EDGE_PRICE_MM05_EUR
}

export function createHardboardSheet(id: string): Sheet {
  return {
    id,
    width: DEFAULT_HARDBOARD_WIDTH,
    height: DEFAULT_HARDBOARD_HEIGHT,
    quantity: 1,
    kind: 'hardboard',
    priceEur: DEFAULT_HARDBOARD_PRICE_EUR,
  }
}

export function firstSheetOfKind(sheets: Sheet[], kind: BoardKind): Sheet | undefined {
  return sheets.map(normalizeSheet).find((s) => sheetKind(s) === kind)
}

export function referenceSheet(
  sheets: Sheet[],
  kind: BoardKind,
): { width: number; height: number; priceEur: number } {
  const found = firstSheetOfKind(sheets, kind)
  if (found) {
    return {
      width: found.width,
      height: found.height,
      priceEur: found.priceEur ?? defaultSheetPrice(kind),
    }
  }
  if (kind === 'hardboard') {
    return {
      width: DEFAULT_HARDBOARD_WIDTH,
      height: DEFAULT_HARDBOARD_HEIGHT,
      priceEur: DEFAULT_HARDBOARD_PRICE_EUR,
    }
  }
  return {
    width: DEFAULT_CHIPBOARD_WIDTH,
    height: DEFAULT_CHIPBOARD_HEIGHT,
    priceEur: DEFAULT_CHIPBOARD_PRICE_EUR,
  }
}

export type DoorCount = 0 | 1 | 2

export function parseDoorCount(value: unknown): DoorCount {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (n === 1 || n === 2) return n
  return 0
}

/** Cut size (before 2 mm banding on all four edges). */
export function doorCutSize(
  cabinetWidth: number,
  cabinetHeight: number,
  doorCount: 1 | 2,
): { width: number; height: number } {
  return {
    width: cabinetWidth / doorCount - DOOR_GAP_X - DOOR_EDGE_BOTH,
    height: cabinetHeight - DOOR_CLEARANCE_TOP - DOOR_CLEARANCE_BOTTOM - DOOR_EDGE_BOTH,
  }
}

export function boardKindLabel(kind: BoardKind): string {
  return kind === 'hardboard' ? 'Фазер' : 'ПДЧ'
}
