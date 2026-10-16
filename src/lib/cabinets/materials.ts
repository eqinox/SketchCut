import type { BoardKind, Sheet } from '@/types'
import { formatMm } from '../utils'
import type { RuleBlock, RuleSection } from './rule-text'
import { KERF } from '@/lib/packing/types'
import {
  HANDLES_PER_DOOR,
  HANDLES_PER_DRAWER,
  SCREWS_35X16_PER_DRAWER_SOFT,
  SCREWS_35X20_PER_DRAWER_NORMAL,
  SCREWS_4X16_PER_DRAWER_SOFT,
  SLIDES_PER_DRAWER,
} from './hardware'

export type { BoardKind }

export const DEFAULT_CHIPBOARD_WIDTH = 2780
export const DEFAULT_CHIPBOARD_HEIGHT = 2040
export const DEFAULT_CHIPBOARD_PRICE_EUR = 86

export const DEFAULT_HARDBOARD_WIDTH = 2800
export const DEFAULT_HARDBOARD_HEIGHT = 2070
export const DEFAULT_HARDBOARD_PRICE_EUR = 20
export const DEFAULT_HARDBOARD_THICKNESS = 3

/** Thick edge banding (2 mm). */
export const EDGE_PRICE_MM2_EUR = 0.7
/** Regular edge banding (0.5 mm). */
export const EDGE_PRICE_MM05_EUR = 0.35

/** Saw time for one full sheet, including chipboard and hardboard. */
export const CUTTING_MINUTES_PER_SHEET = 40
/** Edgebander time for one full chipboard sheet (hardboard is not edged). */
export const EDGING_MINUTES_PER_SHEET = 30

/**
 * Overlay door / front sizing — keep in sync with `.cursor/rules/door-fronts.mdc`.
 * Cut size is before banding; banding is glued on after the saw.
 *
 * Height: bottom of the door sits at 0 on the opening; subtract DOOR_CLEARANCE_TOP
 * at the top (фуга), then DOOR_EDGE_MM on top and bottom for banding.
 * When the top overhangs the sides, the opening's top is the underside of the top.
 * Width: DOOR_GAP_X total (DOOR_SIDE_GAP_EACH each side), then banding on both sides.
 */
/** Фуга at the top of a door (and of the topmost front in a stack), mm. */
export const DOOR_CLEARANCE_TOP = 3
/** Фуга at the bottom of a door, mm. Door sits at 0 on the opening. */
export const DOOR_CLEARANCE_BOTTOM = 0
/** Total side фуга subtracted from each door's share of the width, mm. */
export const DOOR_GAP_X = 3
/** Left / right share of DOOR_GAP_X, mm. */
export const DOOR_SIDE_GAP_EACH = 1.5
/**
 * Inner drawer front: sits between the sides (does not cover their edge banding).
 * Total side фуга, mm.
 */
export const INNER_DRAWER_GAP_X = 6
/** Left / right share of INNER_DRAWER_GAP_X, mm. */
export const INNER_DRAWER_SIDE_GAP_EACH = 3
/** Gap between stacked fronts (drawer–drawer or drawer–door), mm. */
export const DRAWER_DOOR_GAP = 3
/** Default finished drawer-front height when adding a drawer, mm. */
export const DEFAULT_DRAWER_FRONT_HEIGHT = 150
/** Practical upper bound for stacked drawers in one carcass. */
export const MAX_DRAWERS = 6
/** Max evenly spaced shelves. */
export const MAX_SHELVES = 8
/** Extra mm between stacked fronts when first cut as one board, then resawn after edging. */
export const COMBINED_FRONT_SAW_BUFFER = 6
/** Thick (2 mm) banding on one edge. */
export const DOOR_EDGE_MM = 2
/** 2 mm banding on both opposite edges. */
export const DOOR_EDGE_BOTH = DOOR_EDGE_MM * 2

/** Drawer box rails sit this much shorter than the drawer front, mm — then the height is rounded to 10. */
export const DRAWER_RAIL_BELOW_FRONT = 50
/** Rail cut height is always a multiple of this, mm. */
export const DRAWER_RAIL_HEIGHT_STEP = 10
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
  const rawPrice =
    typeof sheet.priceEur === 'number' && Number.isFinite(sheet.priceEur) && sheet.priceEur >= 0
      ? sheet.priceEur
      : defaultSheetPrice(kind)
  const price = kind === 'hardboard' && rawPrice === 0 ? defaultSheetPrice(kind) : rawPrice
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

/**
 * How many sheets to bill for the used area.
 * Whole-sheet mode rounds up (3.5 used → 4 bought).
 */
export function billedSheetCount(
  usedAreaM2: number,
  sheetWidth: number,
  sheetHeight: number,
  billWholeSheets = false,
): number {
  const frac = sheetFraction(usedAreaM2, sheetWidth, sheetHeight)
  if (frac <= 0) return 0
  if (!billWholeSheets) return frac
  const rounded = Math.round(frac * 1e6) / 1e6
  return Math.max(1, Math.ceil(rounded - 1e-9))
}

/** Price of used board as a fraction of one full sheet, or of whole bought sheets. */
export function usedBoardCostEur(
  usedAreaM2: number,
  sheetWidth: number,
  sheetHeight: number,
  sheetPriceEur: number,
  billWholeSheets = false,
): number {
  if (sheetPriceEur <= 0) return 0
  return billedSheetCount(usedAreaM2, sheetWidth, sheetHeight, billWholeSheets) * sheetPriceEur
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

export function createHardboardSheet(id: string, priceEur?: number): Sheet {
  return {
    id,
    width: DEFAULT_HARDBOARD_WIDTH,
    height: DEFAULT_HARDBOARD_HEIGHT,
    quantity: 1,
    kind: 'hardboard',
    priceEur: priceEur ?? DEFAULT_HARDBOARD_PRICE_EUR,
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

/** 0–MAX_SHELVES evenly spaced shelves. */
export function parseShelfCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(MAX_SHELVES, Math.floor(n))
}

/**
 * Hardboard back cut: full outer width × height.
 * With a plinth, the plinth zone is not covered (height minus plinth).
 * With legs, the whole back is covered.
 */
export function hardboardCutSize(
  cabinetWidth: number,
  cabinetHeight: number,
  plinthHeight = 0,
): { width: number; height: number } {
  return {
    width: cabinetWidth,
    height: Math.max(1, cabinetHeight - Math.max(0, plinthHeight)),
  }
}

export type DoorCutOpts = {
  /**
   * When false, only overlay gaps are subtracted — finished size for a bought door.
   * Default true: also subtract 2+2 mm for workshop edge banding.
   */
  subtractEdge?: boolean
  /** Inner front: opening is between the sides; 3+3 mm gaps instead of overlay 1.5+1.5. */
  inset?: boolean
}

export type DrawerFrontCutOpts = DoorCutOpts

export function drawerFrontGapX(inset: boolean): number {
  return inset ? INNER_DRAWER_GAP_X : DOOR_GAP_X
}

export function drawerFrontSideGapEach(inset: boolean): number {
  return inset ? INNER_DRAWER_SIDE_GAP_EACH : DOOR_SIDE_GAP_EACH
}

function doorEdgeDeduction(opts?: DoorCutOpts): number {
  return opts?.subtractEdge === false ? 0 : DOOR_EDGE_BOTH
}

/** Finished/cut width of one door from the opening it sits in. */
export function doorCutWidth(openingWidth: number, doorCount: 1 | 2, opts?: DoorCutOpts): number {
  const edge = doorEdgeDeduction(opts)
  if (opts?.inset) {
    const between = doorCount === 2 ? DRAWER_DOOR_GAP : 0
    return (openingWidth - INNER_DRAWER_GAP_X - between) / doorCount - edge
  }
  return openingWidth / doorCount - DOOR_GAP_X - edge
}

/** Cut size (before 2 mm banding on all four edges), or finished size when `subtractEdge` is false. */
export function doorCutSize(
  openingWidth: number,
  cabinetHeight: number,
  doorCount: 1 | 2,
  opts?: DoorCutOpts,
): { width: number; height: number } {
  const edge = doorEdgeDeduction(opts)
  return {
    width: doorCutWidth(openingWidth, doorCount, opts),
    height: cabinetHeight - DOOR_CLEARANCE_TOP - DOOR_CLEARANCE_BOTTOM - edge,
  }
}

/** Short Bulgarian note of the overlay + banding rule, for prices and dialogs. */
export function doorCutRuleNote(opts?: {
  withDrawerGaps?: boolean
  subtractEdge?: boolean
  insetFront?: boolean
}): string {
  const stacked = opts?.withDrawerGaps
    ? `${DRAWER_DOOR_GAP} мм между челата, `
    : ''
  const gap = drawerFrontGapX(opts?.insetFront === true)
  const each = drawerFrontSideGapEach(opts?.insetFront === true)
  const edgeBit =
    opts?.subtractEdge === false
      ? 'готов размер (само фуги, без махане на кант)'
      : `кант ${DOOR_EDGE_MM} мм от 4 страни`
  return (
    `фуга ${DOOR_CLEARANCE_TOP} мм отгоре` +
    (DOOR_CLEARANCE_BOTTOM > 0 ? `, ${DOOR_CLEARANCE_BOTTOM} мм отдолу` : ', долу на 0') +
    `, ${stacked}странично ${gap} мм общо (${each} мм отляво и отдясно), ${edgeBit}`
  )
}

/** Cut size (before 2 mm banding), or finished size when `subtractEdge` is false. */
export function drawerFrontCutSize(
  openingWidth: number,
  frontHeight: number,
  opts?: DrawerFrontCutOpts,
): { width: number; height: number } {
  const edge = doorEdgeDeduction(opts)
  return {
    width: openingWidth - drawerFrontGapX(opts?.inset === true) - edge,
    height: frontHeight - edge,
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
 * (and before a door, when there is one). Does not include the top фуга.
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
  clearanceBottom = DOOR_CLEARANCE_BOTTOM,
): number {
  return cabinetHeight - DOOR_CLEARANCE_TOP - clearanceBottom - drawerStackUsed(drawerFrontHeights, hasDoor)
}

/** Height left for the drawer fronts themselves after top/bottom фуга and gaps between them. */
export function drawerFrontFillMm(
  frontHeight: number,
  count: number,
  clearanceBottom = DOOR_CLEARANCE_BOTTOM,
): number {
  if (count < 1) return 0
  return frontHeight - DOOR_CLEARANCE_TOP - clearanceBottom - (count - 1) * DRAWER_DOOR_GAP
}

/**
 * Split a front into `count` equal drawer heights (integer mm).
 * Remainder millimetres go to the topmost fronts. Fills the opening: top фуга +
 * fronts + gaps between them, nothing left over.
 */
export function equalDrawerFrontHeights(
  frontHeight: number,
  count: number,
  clearanceBottom = DOOR_CLEARANCE_BOTTOM,
): number[] {
  const n = Math.max(0, Math.floor(count))
  if (n < 1) return []
  const available = drawerFrontFillMm(frontHeight, n, clearanceBottom)
  if (available <= 0) return Array.from({ length: n }, () => 0)
  const base = Math.floor(available / n)
  const rem = available - base * n
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0))
}

export function drawerFrontsAreEven(
  frontHeight: number,
  heights: number[],
  clearanceBottom = DOOR_CLEARANCE_BOTTOM,
): boolean {
  const positive = heights.filter((h) => h > 0)
  if (positive.length === 0) return true
  const even = equalDrawerFrontHeights(frontHeight, positive.length, clearanceBottom)
  return even.length === positive.length && even.every((h, i) => h === positive[i])
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
  openingWidth: number,
  cabinetHeight: number,
  drawerFrontHeights: number[],
  doorCount: 1 | 2,
  opts?: DoorCutOpts,
): { width: number; height: number } {
  const edge = doorEdgeDeduction(opts)
  return {
    width: doorCutWidth(openingWidth, doorCount, opts),
    height: remainingFrontHeight(cabinetHeight, drawerFrontHeights, true) - edge,
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

/** Cut height of a drawer rail: nearest 10 mm (100, 110, 120…). */
export function roundDrawerRailHeight(mm: number): number {
  if (!(mm > 0)) return 0
  return Math.max(DRAWER_RAIL_HEIGHT_STEP, Math.round(mm / DRAWER_RAIL_HEIGHT_STEP) * DRAWER_RAIL_HEIGHT_STEP)
}

/** Cut sizes for the four drawer-box rails (царги) of one drawer. */
export function drawerBoxRails(
  cabinetWidth: number,
  thickness: number,
  drawerFrontHeight: number,
  slideLength: number,
  softClose: boolean,
  innerOpeningW?: number,
): DrawerBoxRails | null {
  const outerHeight = roundDrawerRailHeight(drawerFrontHeight - DRAWER_RAIL_BELOW_FRONT)
  const innerHeight = softClose ? outerHeight - SOFT_INNER_RAIL_HEIGHT_DROP : outerHeight
  if (outerHeight <= 0 || innerHeight <= 0 || thickness <= 0 || slideLength <= 0) return null

  const innerCarcassW =
    innerOpeningW != null && innerOpeningW > 0
      ? innerOpeningW
      : cabinetWidth - 2 * thickness
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

const RULE_OPENING_W = 600
const RULE_OPENING_H = 720

export function overlayDoorRuleSection(): RuleSection {
  const one = doorCutSize(RULE_OPENING_W, RULE_OPENING_H, 1)
  const two = doorCutSize(RULE_OPENING_W, RULE_OPENING_H, 2)
  const even = equalDrawerFrontHeights(RULE_OPENING_H, 3)
  return {
    id: 'overlay',
    title: 'Наложени врати и чела',
    blocks: [
      {
        title: 'Какво се реже',
        lines: [
          `Режещият размер е без канта. Кантът ${DOOR_EDGE_MM} мм се лепи после, от четирите страни (${DOOR_EDGE_BOTH} мм общо на двойка срещуположни страни).`,
        ],
      },
      {
        title: 'Височина',
        lines: [
          `Долу вратата е на ${DOOR_CLEARANCE_BOTTOM}. Горе се махат ${DOOR_CLEARANCE_TOP} мм.`,
          `Рязане по височина = отвор − ${DOOR_CLEARANCE_TOP} − ${DOOR_CLEARANCE_BOTTOM} − ${DOOR_EDGE_BOTH}. Готовият размер с кант = отвор − ${DOOR_CLEARANCE_TOP} − ${DOOR_CLEARANCE_BOTTOM}.`,
          `Отвор ${RULE_OPENING_H} мм, една врата: рязане ${formatMm(one.height)} мм височина.`,
          'При външен плот горната точка на отвора е долната страна на плота. Вратата стига до плота и не влиза в него.',
          'С крачета дъното е външно: долната точка е горната страна на дъното.',
          'При вътрешен плот (секция) вратата покрива и предния кант на плота.',
        ],
      },
      {
        title: 'Широчина',
        lines: [
          `Една врата или едно чело: фуга ${DOOR_GAP_X} мм общо = ${formatMm(DOOR_SIDE_GAP_EACH)} мм отляво + ${formatMm(DOOR_SIDE_GAP_EACH)} мм отдясно.`,
          `Рязане = отвор / брой − ${DOOR_GAP_X} − ${DOOR_EDGE_BOTH}.`,
          `Отвор ${RULE_OPENING_W} мм: една врата ${formatMm(one.width)} мм, две врати по ${formatMm(two.width)} мм.`,
        ],
      },
      {
        title: 'Чела едно над друго',
        lines: [
          `Между челата и между чело и врата има ${DRAWER_DOOR_GAP} мм.`,
          `Най-долното чело сяда на ${DOOR_CLEARANCE_BOTTOM}. Най-горното свършва ${DOOR_CLEARANCE_TOP} мм под горния край.`,
          `Ново чело по подразбиране е ${DEFAULT_DRAWER_FRONT_HEIGHT} мм. Най-много ${MAX_DRAWERS} чекмеджета в един отвор.`,
          `„Изравни“ на отвор ${RULE_OPENING_H} мм на 3 чела дава ${even.map((h) => formatMm(h)).join(' + ')} мм. Остатъчните милиметри отиват към горните чела.`,
          `Чела с еднаква широчина (една врата отгоре, не две) могат да се режат от една плоча. Между парчетата се оставят ${COMBINED_FRONT_SAW_BUFFER} мм: две чела по ${formatMm(one.height)} мм стават ${formatMm(combinedFrontCutHeight([one.height, one.height]))} мм.`,
        ],
      },
    ],
  }
}

export function insetDoorRuleSection(): RuleSection {
  const two = doorCutSize(RULE_OPENING_W, RULE_OPENING_H, 2, { inset: true })
  const one = doorCutSize(RULE_OPENING_W, RULE_OPENING_H, 1, { inset: true })
  return {
    id: 'inset',
    title: 'Вътрешни врати и чела',
    blocks: [
      {
        title: 'Къде сядат',
        lines: [
          'Влизат между страниците и не покриват канта им.',
          `Височина: до долната страна на плота или рафта отгоре, после ${DOOR_CLEARANCE_TOP} мм фуга горе. Долу — горната страна на дъното или рафта отдолу. Рязане по височина за отвор ${RULE_OPENING_H} мм: ${formatMm(one.height)} мм.`,
        ],
      },
      {
        title: 'Широчина',
        lines: [
          `Фуга ${INNER_DRAWER_GAP_X} мм общо = ${INNER_DRAWER_SIDE_GAP_EACH} мм отляво + ${INNER_DRAWER_SIDE_GAP_EACH} мм отдясно.`,
          `При две вътрешни врати има още ${DRAWER_DOOR_GAP} мм между тях.`,
          `Рязане = (отвор − фугите) / брой − ${DOOR_EDGE_BOTH}. Отвор ${RULE_OPENING_W} мм: една ${formatMm(one.width)} мм, две по ${formatMm(two.width)} мм.`,
        ],
      },
    ],
  }
}

export function drawerRuleSection(): RuleSection {
  const front = DEFAULT_DRAWER_FRONT_HEIGHT
  const slide = 500
  const roller = drawerBoxRails(RULE_OPENING_W, 18, front, slide, false)
  const soft = drawerBoxRails(RULE_OPENING_W, 18, front, slide, true)
  return {
    id: 'drawers',
    title: 'Чекмедже',
    blocks: [
      {
        title: 'Кутия',
        lines: [
          `Височина на страницата = височина на челото − ${DRAWER_RAIL_BELOW_FRONT} мм, закръглена до ${DRAWER_RAIL_HEIGHT_STEP} мм.`,
          roller
            ? `Чело ${front} мм и ролков водач ${slide} мм: страница ${formatMm(roller.outer.height)} × ${formatMm(roller.outer.width)} мм, чело и гръб ${formatMm(roller.inner.height)} × ${formatMm(roller.inner.width)} мм.`
            : '',
          `При плавно прибиране вътрешните страници са с ${SOFT_INNER_RAIL_HEIGHT_DROP} мм по-ниски, а дължината е водачът минус ${SOFT_SLIDE_OUTER_RAIL_SHORTEN} мм.` +
            (soft ? ` Същият пример: страница ${formatMm(soft.outer.height)} × ${formatMm(soft.outer.width)} мм, вътре ${formatMm(soft.inner.height)} × ${formatMm(soft.inner.width)} мм.` : ''),
          `Отстъп от страницата на шкафа: ${formatMm(ROLLER_SLIDE_SIDE_GAP)} мм от всяка страна при ролкови, ${SOFT_SLIDE_SIDE_GAP} мм при плавно.`,
          `${SLIDES_PER_DRAWER} водача на чекмедже.`,
          `Винтчета при ролкови: ${SCREWS_35X20_PER_DRAWER_NORMAL} бр. 3,5×20 на чекмедже. При плавно: ${SCREWS_4X16_PER_DRAWER_SOFT} бр. 4×16 и ${SCREWS_35X16_PER_DRAWER_SOFT} бр. 3,5×16.`,
          `${HANDLES_PER_DRAWER} дръжка на чекмедже и ${HANDLES_PER_DOOR} на врата, ако дръжките са включени.`,
        ].filter((line) => line !== ''),
      },
    ],
  }
}

export function boardRuleBlocks(): RuleBlock[] {
  const back = hardboardCutSize(600, 800, 100)
  const full = sheetAreaM2(DEFAULT_CHIPBOARD_WIDTH, DEFAULT_CHIPBOARD_HEIGHT)
  const billed = billedSheetCount(3.5 * full, DEFAULT_CHIPBOARD_WIDTH, DEFAULT_CHIPBOARD_HEIGHT, true)
  return [
    {
      title: 'Кант',
      lines: [
        `Дебел кант ${DOOR_EDGE_MM} мм и тънък 0,5 мм. Цените по подразбиране са ${formatMm(EDGE_PRICE_MM2_EUR)} €/м и ${formatMm(EDGE_PRICE_MM05_EUR)} €/м и се сменят в Настройки.`,
        'Фазерът не се кантира.',
      ],
    },
    {
      title: 'Фазер',
      lines: [
        `Гърбът е пълната широчина × височината. С цокъл височината се маха с височината на цокъла. Шкаф 600 × 800 с цокъл 100: фазер ${formatMm(back.width)} × ${formatMm(back.height)} мм. С крачета цокълът е 0 и гърбът покрива целия корпус.`,
      ],
    },
    {
      title: 'Разкрой и труд',
      lines: [
        `Дискът на триона е ${KERF} мм и се оставя между детайлите.`,
        `Рязането се смята ${CUTTING_MINUTES_PER_SHEET} мин на цяла плоча, умножено по използваната част (ПДЧ и фазер отделно).`,
        `Кантирането е ${EDGING_MINUTES_PER_SHEET} мин на цяла ПДЧ плоча, пак по използваната част.`,
        `Отметката за цели плочи закръгля нагоре: 3,5 плочи се таксуват като ${formatMm(billed)}.`,
      ],
    },
  ]
}
