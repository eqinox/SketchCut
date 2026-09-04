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
/** Gap between stacked fronts (drawer–drawer or drawer–door), mm. */
export const DRAWER_DOOR_GAP = 3
/** Default finished drawer-front height when adding a drawer, mm. */
export const DEFAULT_DRAWER_FRONT_HEIGHT = 150
/** Practical upper bound for stacked drawers in one carcass. */
export const MAX_DRAWERS = 6
/** Extra mm between stacked fronts when first cut as one board, then resawn after edging. */
export const COMBINED_FRONT_SAW_BUFFER = 6
/** 2 mm banding on both opposite edges. */
export const DOOR_EDGE_BOTH = 4

/** Drawer box rails sit this much shorter than the drawer front, mm. */
export const DRAWER_RAIL_BELOW_FRONT = 50
/** Clearance each side of a roller slide, mm. */
export const ROLLER_SLIDE_SIDE_GAP = 12.5
/** Clearance each side of a soft-close slide, mm. */
export const SOFT_SLIDE_SIDE_GAP = 5
/** Soft-close outer rails are this much shorter than the slide, mm. */
export const SOFT_SLIDE_OUTER_RAIL_SHORTEN = 10
/** Soft-close inner rails are this much shorter in height than the outer rails (groove for the back). */
export const SOFT_INNER_RAIL_HEIGHT_DROP = 14

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

export function edgeBandingCostEur(
  mm2Meters: number,
  mm05Meters: number,
  prices?: { mm2?: number; mm05?: number },
): number {
  const mm2 = prices?.mm2 ?? EDGE_PRICE_MM2_EUR
  const mm05 = prices?.mm05 ?? EDGE_PRICE_MM05_EUR
  return mm2Meters * mm2 + mm05Meters * mm05
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

/** Calculate drawer front size (before edging) */
export function drawerFrontCutSize(
  cabinetWidth: number,
  frontHeight: number,
): { width: number; height: number } {
  return {
    width: cabinetWidth - DOOR_GAP_X - DOOR_EDGE_BOTH,
    height: frontHeight - DOOR_EDGE_BOTH,
  }
}

export function parseDrawerFrontHeights(raw: unknown, legacySingle?: unknown): number[] {
  const toPos = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10)
    if (!Number.isFinite(n) || n <= 0) return null
    return Math.round(n)
  }
  if (Array.isArray(raw)) {
    return raw.map(toPos).filter((n): n is number => n != null)
  }
  const one = toPos(legacySingle)
  return one ? [one] : []
}

/**
 * Height taken by drawer fronts plus the 3 mm gaps between them
 * (and before a door, when there is one). Does not include the 5 mm top clearance.
 */
export function drawerStackUsed(drawerFrontHeights: number[], hasDoor: boolean): number {
  const heights = drawerFrontHeights.filter((h) => h > 0)
  if (heights.length === 0) return 0
  const between = (heights.length - 1) * DRAWER_DOOR_GAP
  const beforeDoor = hasDoor ? DRAWER_DOOR_GAP : 0
  return heights.reduce((sum, h) => sum + h, 0) + between + beforeDoor
}

/** Remaining face height below the drawers (door, or leftover if drawers-only). */
export function remainingFrontHeight(
  cabinetHeight: number,
  drawerFrontHeights: number[],
  hasDoor: boolean,
): number {
  return cabinetHeight - DOOR_CLEARANCE_TOP - DOOR_CLEARANCE_BOTTOM - drawerStackUsed(drawerFrontHeights, hasDoor)
}

/**
 * Fronts that share the same width can be first-cut as one board for continuous grain.
 * One full-width door matches the drawer fronts; two doors are half-width and stay separate.
 */
export function canCombineFronts(drawerCount: number, doorCount: number): boolean {
  const stacked = drawerCount + (doorCount === 1 ? 1 : 0)
  return stacked >= 2
}

export function combinedFrontCutHeight(cutHeights: number[]): number {
  const heights = cutHeights.filter((h) => h > 0)
  if (heights.length === 0) return 0
  return heights.reduce((sum, h) => sum + h, 0) + COMBINED_FRONT_SAW_BUFFER * (heights.length - 1)
}

/** Calculate door size when combined with drawer(s) above (before edging) */
export function doorWithDrawersCutSize(
  cabinetWidth: number,
  cabinetHeight: number,
  drawerFrontHeights: number[],
  doorCount: 1 | 2,
): { width: number; height: number } {
  return {
    width: cabinetWidth / doorCount - DOOR_GAP_X - DOOR_EDGE_BOTH,
    height: remainingFrontHeight(cabinetHeight, drawerFrontHeights, true) - DOOR_EDGE_BOTH,
  }
}

/** Calculate door size when combined with one drawer above (before edging) */
export function doorWithDrawerCutSize(
  cabinetWidth: number,
  cabinetHeight: number,
  drawerFrontHeight: number,
  doorCount: 1 | 2,
): { width: number; height: number } {
  return doorWithDrawersCutSize(cabinetWidth, cabinetHeight, [drawerFrontHeight], doorCount)
}

export function boardKindLabel(kind: BoardKind): string {
  return kind === 'hardboard' ? 'Фазер' : 'ПДЧ'
}

export interface DrawerBoxRails {
  /** Clear width between carcass sides. */
  innerCarcassW: number
  sideGapEach: number
  /** Outer width of the drawer box (between slides). */
  drawerOuterW: number
  inner: { width: number; height: number }
  outer: { width: number; height: number }
}

/** Cut sizes for the four drawer-box rails (царги) of one drawer. */
export function drawerBoxRails(
  cabinetWidth: number,
  thickness: number,
  drawerFrontHeight: number,
  slideLength: number,
  softClose: boolean,
): DrawerBoxRails | null {
  const outerHeight = drawerFrontHeight - DRAWER_RAIL_BELOW_FRONT
  const innerHeight = softClose ? outerHeight - SOFT_INNER_RAIL_HEIGHT_DROP : outerHeight
  if (outerHeight <= 0 || innerHeight <= 0 || thickness <= 0 || slideLength <= 0) return null

  const innerCarcassW = cabinetWidth - 2 * thickness
  const sideGapEach = softClose ? SOFT_SLIDE_SIDE_GAP : ROLLER_SLIDE_SIDE_GAP
  const drawerOuterW = innerCarcassW - 2 * sideGapEach
  const innerWidth = drawerOuterW - 2 * thickness
  const outerLength = softClose ? slideLength - SOFT_SLIDE_OUTER_RAIL_SHORTEN : slideLength
  if (innerWidth <= 0 || outerLength <= 0 || drawerOuterW <= 0) return null

  return {
    innerCarcassW,
    sideGapEach,
    drawerOuterW,
    inner: { width: innerWidth, height: innerHeight },
    outer: { width: outerLength, height: outerHeight },
  }
}
