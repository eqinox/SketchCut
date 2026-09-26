import {
  DEFAULT_SLIDING_CAP_SKUS,
  DEFAULT_SLIDING_HANDLE_SKUS,
  DEFAULT_SLIDING_LINKS,
  DEFAULT_SLIDING_LOWER_TRACK_EUR,
  DEFAULT_SLIDING_MVP005_KIT_EUR,
  DEFAULT_SLIDING_SOFT_CLOSE_EUR,
  DEFAULT_SLIDING_UPPER_TRACK_EUR,
  parseSlidingLinks,
  parseSlidingSkuList,
  parseSlidingTrackPrices,
  type SlidingHardwareLinks,
  type SlidingProfileSku,
  type SlidingTrackColor,
} from './sliding-hardware'

export type SlideKind = 'roller' | 'soft-full' | 'soft-partial'

export type PriceByLength = Record<string, number>

export type { SlidingHardwareLinks, SlidingProfileSku, SlidingTrackColor }

export interface HardwareSettings {
  hingeSoftCloseEur: number
  hingeNormalEur: number
  useNormalHinge: boolean

  /** Small screws (4×16, 4×20, 3.5×16, 3.5×20), EUR per 1000. */
  smallScrew1000PackEur: number

  screw5x60_500PackEur: number
  shelfPinEur: number
  /** Ordinary cabinet handle, EUR each. */
  handleNormalEur: number
  /** @deprecated Whole-bar D1L SKUs in slidingHandleSkus. Kept for old records. */
  slidingHandleEurPerM: number
  /** @deprecated Whole-bar D2 SKUs in slidingCapSkus. Kept for old records. */
  slidingCapEurPerM: number
  /** Upper 3 m track, EUR per bar, by color. */
  slidingUpperTrackEur: Record<SlidingTrackColor, number>
  /** Lower 3 m track, EUR per bar, by color. */
  slidingLowerTrackEur: Record<SlidingTrackColor, number>
  /** MVP-005 roller kit (2 upper + 2 lower) for one sliding door. */
  slidingMvp005KitEur: number
  /** Soft-close damper for MVP-005, EUR each. */
  slidingSoftCloseEur: number
  /** D1L handle profiles — charge the whole bar. */
  slidingHandleSkus: SlidingProfileSku[]
  /** D2 cap profiles for 18 mm — charge the whole bar. */
  slidingCapSkus: SlidingProfileSku[]
  slidingLinks: SlidingHardwareLinks
  /** Clothes hanging rail, EUR per metre. */
  clothesRailEurPerM: number

  edgeMm2Eur: number
  edgeMm05Eur: number

  /**
   * When true, board cost is whole bought sheets (3.5 used → 4 × sheet price).
   * When false, only the consumed area fraction is billed.
   */
  billWholeSheets: boolean

  /** Chipboard (ПДЧ) price per sheet, EUR. */
  chipboardPriceEur: number

  /** Hardboard (фазер) price per sheet, EUR. */
  hardboardPriceEur: number

  /**
   * When true, hardboard cost is whole bought sheets (3.5 used → 4 × sheet price).
   * When false, only the consumed area fraction is billed.
   */
  billWholeHardboardSheets: boolean

  /** Drop cutting and machine-edging labor; assembly stays. */
  skipCuttingEdgingLabor: boolean

  /**
   * Drop chipboard, hardboard and edge-banding cost, plus cutting/edging labor.
   * Assembly and fittings stay.
   */
  skipBoardAndEdgeCost: boolean

  /**
   * Overlay doors and drawer fronts are bought ready-made: gaps only, not nested,
   * no cut/edge labor, no remnant/router work. Hinge hang and fitting the front stay.
   * Per-cabinet `externalDoors` still applies when this is off.
   */
  externalDoors: boolean

  /** Unit prices by runner length in mm, e.g. { "500": 1.82 }. */
  slideRollerEur: PriceByLength
  slideSoftFullEur: PriceByLength
  slideSoftPartialEur: PriceByLength
}

export const DEFAULT_SLIDE_ROLLER_EUR: PriceByLength = {
  '250': 1.07,
  '300': 1.23,
  '350': 1.41,
  '400': 1.53,
  '450': 1.69,
  '500': 1.82,
  '550': 1.97,
  '600': 2.15,
}

export const DEFAULT_SLIDE_SOFT_FULL_EUR: PriceByLength = {
  '300': 15.6,
  '350': 15.6,
  '400': 16.16,
  '450': 16.57,
  '500': 16.97,
  '550': 18.05,
}

export const DEFAULT_SLIDE_SOFT_PARTIAL_EUR: PriceByLength = {
  '300': 10.96,
  '350': 10.96,
  '400': 11.23,
  '450': 11.53,
  '500': 11.71,
  '550': 12.58,
}

export const DEFAULT_HARDWARE_SETTINGS: HardwareSettings = {
  hingeSoftCloseEur: 0.7,
  hingeNormalEur: 0.2,
  useNormalHinge: false,
  smallScrew1000PackEur: 5,
  screw5x60_500PackEur: 13,
  shelfPinEur: 0.05,
  handleNormalEur: 1,
  slidingHandleEurPerM: 0,
  slidingCapEurPerM: 0,
  slidingUpperTrackEur: { ...DEFAULT_SLIDING_UPPER_TRACK_EUR },
  slidingLowerTrackEur: { ...DEFAULT_SLIDING_LOWER_TRACK_EUR },
  slidingMvp005KitEur: DEFAULT_SLIDING_MVP005_KIT_EUR,
  slidingSoftCloseEur: DEFAULT_SLIDING_SOFT_CLOSE_EUR,
  slidingHandleSkus: DEFAULT_SLIDING_HANDLE_SKUS.map((sku) => ({ ...sku })),
  slidingCapSkus: DEFAULT_SLIDING_CAP_SKUS.map((sku) => ({ ...sku })),
  slidingLinks: { ...DEFAULT_SLIDING_LINKS },
  clothesRailEurPerM: 1,
  edgeMm2Eur: 0.7,
  edgeMm05Eur: 0.35,
  billWholeSheets: true,
  chipboardPriceEur: 86,
  hardboardPriceEur: 20,
  billWholeHardboardSheets: true,
  skipCuttingEdgingLabor: false,
  skipBoardAndEdgeCost: false,
  externalDoors: false,
  slideRollerEur: { ...DEFAULT_SLIDE_ROLLER_EUR },
  slideSoftFullEur: { ...DEFAULT_SLIDE_SOFT_FULL_EUR },
  slideSoftPartialEur: { ...DEFAULT_SLIDE_SOFT_PARTIAL_EUR },
}

const SETTINGS_KEY = 'sketchcut-hardware-settings'

function num(src: Record<string, unknown>, key: string, fallback: number): number {
  const v = src[key]
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback
}

function flag(src: Record<string, unknown>, key: string, fallback: boolean): boolean {
  return typeof src[key] === 'boolean' ? (src[key] as boolean) : fallback
}

/** Cutting + machine edging minutes are omitted from the bill. */
export function omitsCuttingEdgingLabor(s: HardwareSettings): boolean {
  return s.skipCuttingEdgingLabor || s.skipBoardAndEdgeCost
}

function mergePriceMap(defaults: PriceByLength, raw: unknown): PriceByLength {
  const out: PriceByLength = { ...defaults }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[key] = value
  }
  return out
}

/** Normalize stored/DB JSON into a full settings object. */
export function parseHardwareSettings(raw: unknown): HardwareSettings {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const d = DEFAULT_HARDWARE_SETTINGS
  const smallScrewFallback = num(
    src,
    'screw4x16_1000PackEur',
    num(src, 'hingeScrew1000PackEur', d.smallScrew1000PackEur),
  )
  return {
    hingeSoftCloseEur: num(src, 'hingeSoftCloseEur', d.hingeSoftCloseEur),
    hingeNormalEur: num(src, 'hingeNormalEur', d.hingeNormalEur),
    useNormalHinge: flag(src, 'useNormalHinge', d.useNormalHinge),
    smallScrew1000PackEur: num(src, 'smallScrew1000PackEur', smallScrewFallback),
    screw5x60_500PackEur: num(src, 'screw5x60_500PackEur', d.screw5x60_500PackEur),
    shelfPinEur: num(src, 'shelfPinEur', d.shelfPinEur),
    handleNormalEur: num(src, 'handleNormalEur', d.handleNormalEur),
    slidingHandleEurPerM: num(src, 'slidingHandleEurPerM', d.slidingHandleEurPerM),
    slidingCapEurPerM: num(src, 'slidingCapEurPerM', d.slidingCapEurPerM),
    slidingUpperTrackEur: parseSlidingTrackPrices(src.slidingUpperTrackEur, d.slidingUpperTrackEur),
    slidingLowerTrackEur: parseSlidingTrackPrices(src.slidingLowerTrackEur, d.slidingLowerTrackEur),
    slidingMvp005KitEur: num(src, 'slidingMvp005KitEur', d.slidingMvp005KitEur),
    slidingSoftCloseEur: num(src, 'slidingSoftCloseEur', d.slidingSoftCloseEur),
    slidingHandleSkus: parseSlidingSkuList(src.slidingHandleSkus, d.slidingHandleSkus),
    slidingCapSkus: parseSlidingSkuList(src.slidingCapSkus, d.slidingCapSkus),
    slidingLinks: parseSlidingLinks(src.slidingLinks),
    clothesRailEurPerM: num(src, 'clothesRailEurPerM', d.clothesRailEurPerM),
    edgeMm2Eur: num(src, 'edgeMm2Eur', d.edgeMm2Eur),
    edgeMm05Eur: num(src, 'edgeMm05Eur', d.edgeMm05Eur),
    billWholeSheets: flag(src, 'billWholeSheets', d.billWholeSheets),
    chipboardPriceEur: num(src, 'chipboardPriceEur', d.chipboardPriceEur),
    hardboardPriceEur: num(src, 'hardboardPriceEur', d.hardboardPriceEur),
    billWholeHardboardSheets: flag(src, 'billWholeHardboardSheets', d.billWholeHardboardSheets),
    skipCuttingEdgingLabor: flag(src, 'skipCuttingEdgingLabor', d.skipCuttingEdgingLabor),
    skipBoardAndEdgeCost: flag(src, 'skipBoardAndEdgeCost', d.skipBoardAndEdgeCost),
    externalDoors: flag(src, 'externalDoors', d.externalDoors),
    slideRollerEur: mergePriceMap(d.slideRollerEur, src.slideRollerEur),
    slideSoftFullEur: mergePriceMap(d.slideSoftFullEur, src.slideSoftFullEur),
    slideSoftPartialEur: mergePriceMap(d.slideSoftPartialEur, src.slideSoftPartialEur),
  }
}

export function loadSettings(): HardwareSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) return parseHardwareSettings(JSON.parse(stored))
  } catch (e) {
    console.error('Failed to load settings:', e)
  }
  return parseHardwareSettings(null)
}

export function saveSettings(settings: HardwareSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}

export function resetSettings(): HardwareSettings {
  const defaults = parseHardwareSettings(null)
  saveSettings(defaults)
  return defaults
}
