import type { HardwareSettings, SlideKind } from '@/lib/settings'
import type { HardwareItem } from './types'
import type { RuleBlock } from './rule-text'

export type { SlideKind }

export interface FastenerPack {
  id: string
  name: string
  packQty: number
  packPriceEur: number
}

/** One more 5×60 screw for each span of this length along the outer panel. */
export const CONFIRMAT_SPAN_MM = 500

/**
 * Confirmat 5×60 count along an outer panel:
 * up to 500 mm → 2, up to 1000 → 3, up to 1500 → 4, and so on.
 */
export function confirmatCount(outerSpanMm: number): number {
  if (!(outerSpanMm > 0)) return 0
  return 1 + Math.ceil(outerSpanMm / CONFIRMAT_SPAN_MM)
}

/** Confirmat / chipboard screw used to assemble carcasses. */
export const SCREW_5X60: FastenerPack = {
  id: 'screw-5x60',
  name: 'Винт 5×60',
  packQty: 500,
  packPriceEur: 13,
}

export const SCREW_4X16: FastenerPack = {
  id: 'screw-4x16',
  name: 'Винтче 4×16',
  packQty: 1000,
  packPriceEur: 5,
}

export const SCREW_4X20: FastenerPack = {
  id: 'screw-4x20',
  name: 'Винтче 4×20',
  packQty: 1000,
  packPriceEur: 5,
}

export const SCREW_35X16: FastenerPack = {
  id: 'screw-3.5x16',
  name: 'Винтче 3.5×16',
  packQty: 1000,
  packPriceEur: 5,
}

export const SCREW_35X20: FastenerPack = {
  id: 'screw-3.5x20',
  name: 'Винтче 3.5×20',
  packQty: 1000,
  packPriceEur: 5,
}

export const FASTENERS = {
  [SCREW_5X60.id]: SCREW_5X60,
  [SCREW_4X16.id]: SCREW_4X16,
  [SCREW_4X20.id]: SCREW_4X20,
  [SCREW_35X16.id]: SCREW_35X16,
  [SCREW_35X20.id]: SCREW_35X20,
} as const

export type FastenerId = keyof typeof FASTENERS

/** Shelf support pin. Four per shelf. */
export const SHELF_PIN = {
  id: 'shelf-pin',
  name: 'Рафтоносач',
  unitPriceEur: 0.05,
} as const

export const SHELF_PINS_PER_SHELF = 4

/** Clothes hanging rail, priced per metre. */
export const CLOTHES_RAIL = {
  id: 'clothes-rail',
  name: 'Лост за дрехи',
  unitPriceEur: 1,
} as const

export const HINGE_SOFT_CLOSE = {
  id: 'hinge-soft-close',
  name: 'Панта плавно прибиране',
  unitPriceEur: 0.7,
} as const

export const HINGE_NORMAL = {
  id: 'hinge-normal',
  name: 'Панта нормално прибиране',
  unitPriceEur: 0.2,
} as const

export const HANDLE_NORMAL = {
  id: 'handle-normal',
  name: 'Обикновена дръжка',
  unitPriceEur: 1,
} as const

export const HANDLES_PER_DOOR = 1
export const HANDLES_PER_DRAWER = 1

export const HINGES_PER_SMALL_DOOR = 2
export const SCREWS_4X16_PER_HINGE = 2
export const SCREWS_4X20_PER_HINGE = 2

export const SLIDES_PER_DRAWER = 2

/** Screws for normal (roller) slides - per drawer (not per slide). */
export const SCREWS_35X20_PER_DRAWER_NORMAL = 6

/** Screws 4×16 for soft-close slides - per drawer (not per slide). */
export const SCREWS_4X16_PER_DRAWER_SOFT = 4

/** Screws 3.5×16 for soft-close slides - per drawer (not per slide). */
export const SCREWS_35X16_PER_DRAWER_SOFT = 2

export function isSoftCloseSlide(kind: SlideKind): boolean {
  return kind === 'soft-full' || kind === 'soft-partial'
}

export const SLIDE_KIND_LABEL: Record<SlideKind, string> = {
  roller: 'Ролкови (нормално прибиране)',
  'soft-full': 'Плавно пълно отваряне',
  'soft-partial': 'Плавно частично отваряне',
}

export const SLIDE_KIND_SHORT: Record<SlideKind, string> = {
  roller: 'ролков',
  'soft-full': 'плавно пълно',
  'soft-partial': 'плавно частично',
}

export const SLIDE_LENGTHS: Record<SlideKind, readonly number[]> = {
  roller: [250, 300, 350, 400, 450, 500, 550, 600],
  'soft-full': [300, 350, 400, 450, 500, 550],
  'soft-partial': [300, 350, 400, 450, 500, 550],
}

export const ALL_SLIDE_LENGTHS = [250, 300, 350, 400, 450, 500, 550, 600] as const

/** Lower kitchen cabinet: 6 through the bottom, 8 for the two top rails. */
export const KITCHEN_BASE_SCREWS_BOTTOM = 6
export const KITCHEN_BASE_SCREWS_RAILS = 8
export const KITCHEN_BASE_SCREWS_TOTAL = KITCHEN_BASE_SCREWS_BOTTOM + KITCHEN_BASE_SCREWS_RAILS

export function parseSlideKind(value: unknown): SlideKind {
  if (value === 'roller' || value === 'soft-full' || value === 'soft-partial') return value
  return 'roller'
}

/** The runner stops this far short of the back edge of the side it is screwed to. */
export const SLIDE_REAR_CLEARANCE_MM = 20

/**
 * Longest runner that fits on the side.
 * A sliding cabinet mounts it on the inner side: that depth already excludes
 * the track, and the runner still needs rear clearance. An overlay front
 * takes its own thickness out of the same depth.
 */
export function slideRunnerDepth(panelDepth: number, sliding: boolean, overlayFrontMm = 0): number {
  if (!sliding) return Math.max(0, panelDepth)
  return Math.max(0, panelDepth - SLIDE_REAR_CLEARANCE_MM - Math.max(0, overlayFrontMm))
}

export function eligibleSlideLengths(depth: number, kind: SlideKind): number[] {
  return SLIDE_LENGTHS[kind].filter((len) => len <= depth)
}

export function defaultSlideLength(depth: number, kind: SlideKind): number {
  const eligible = eligibleSlideLengths(depth, kind)
  return eligible[eligible.length - 1] ?? SLIDE_LENGTHS[kind][0]
}

export function parseSlideLength(value: unknown, depth: number, kind: SlideKind): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  const eligible = eligibleSlideLengths(depth, kind)
  if (eligible.includes(n)) return n
  return defaultSlideLength(depth, kind)
}

export function slidePriceMap(kind: SlideKind, settings: HardwareSettings): Record<string, number> {
  if (kind === 'soft-full') return settings.slideSoftFullEur
  if (kind === 'soft-partial') return settings.slideSoftPartialEur
  return settings.slideRollerEur
}

export function slideUnitPriceEur(kind: SlideKind, length: number, settings: HardwareSettings): number {
  return slidePriceMap(kind, settings)[String(length)] ?? 0
}

export function slideId(kind: SlideKind, length: number): string {
  return `slide-${kind}-${length}`
}

export function slideName(kind: SlideKind, length: number): string {
  return `Водач ${SLIDE_KIND_SHORT[kind]} ${length} мм`
}

export function fastenerUnitPriceEur(pack: FastenerPack): number {
  return pack.packPriceEur / pack.packQty
}

export function fastenerLine(pack: FastenerPack, quantity: number, note?: string): HardwareItem {
  return pricedLine(
    { id: pack.id, name: pack.name, unitPriceEur: fastenerUnitPriceEur(pack) },
    quantity,
    note,
  )
}

export function pricedLine(
  item: { id: string; name: string; unitPriceEur: number },
  quantity: number,
  note?: string,
): HardwareItem {
  return {
    id: item.id,
    name: item.name,
    quantity,
    unitPriceEur: item.unitPriceEur,
    note,
  }
}

export function hardwareCostEur(hardware: HardwareItem[]): number {
  return hardware.reduce((sum, item) => sum + (item.unitPriceEur ?? 0) * item.quantity, 0)
}

export function hardwareQtyById(hardware: HardwareItem[], id: string): number {
  return hardware.reduce((sum, item) => (item.id === id ? sum + item.quantity : sum), 0)
}

export function hardwareCostById(hardware: HardwareItem[], id: string): number {
  return hardware.reduce(
    (sum, item) => (item.id === id ? sum + (item.unitPriceEur ?? 0) * item.quantity : sum),
    0,
  )
}

export function confirmatRuleBlock(): RuleBlock {
  const span = CONFIRMAT_SPAN_MM
  return {
    title: 'Винтове 5×60',
    lines: [
      `Брой по дължината на външната плоскост: 1 + закръгляне нагоре на дължината / ${span}.`,
      `До ${span} мм → ${confirmatCount(span)}, до ${span * 2} мм → ${confirmatCount(span * 2)}, до ${span * 3} мм → ${confirmatCount(span * 3)}.`,
    ],
  }
}

export function hingeRuleBlock(): RuleBlock {
  return {
    title: 'Наложена врата',
    lines: [
      `${HINGES_PER_SMALL_DOOR} панти на врата. На панта: ${SCREWS_4X16_PER_HINGE} винтчета 4×16 и ${SCREWS_4X20_PER_HINGE} винтчета 4×20.`,
      'Плавно или обикновено прибиране се избира в Настройки.',
      'Плъзгащите врати нямат панти — имат механизма MVP-005.',
    ],
  }
}
