export type SlideKind = 'roller' | 'soft-full' | 'soft-partial'

export type PriceByLength = Record<string, number>

export interface HardwareSettings {
  hingeSoftCloseEur: number
  hingeNormalEur: number
  useNormalHinge: boolean

  /** Small screws (4×16, 4×20, 3.5×16, 3.5×20), EUR per 1000. */
  smallScrew1000PackEur: number

  screw5x60_500PackEur: number
  shelfPinEur: number

  edgeMm2Eur: number
  edgeMm05Eur: number

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
  edgeMm2Eur: 0.7,
  edgeMm05Eur: 0.35,
  slideRollerEur: { ...DEFAULT_SLIDE_ROLLER_EUR },
  slideSoftFullEur: { ...DEFAULT_SLIDE_SOFT_FULL_EUR },
  slideSoftPartialEur: { ...DEFAULT_SLIDE_SOFT_PARTIAL_EUR },
}

const SETTINGS_KEY = 'sketchcut-hardware-settings'

function num(src: Record<string, unknown>, key: string, fallback: number): number {
  const v = src[key]
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback
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
    useNormalHinge: typeof src.useNormalHinge === 'boolean' ? src.useNormalHinge : d.useNormalHinge,
    smallScrew1000PackEur: num(src, 'smallScrew1000PackEur', smallScrewFallback),
    screw5x60_500PackEur: num(src, 'screw5x60_500PackEur', d.screw5x60_500PackEur),
    shelfPinEur: num(src, 'shelfPinEur', d.shelfPinEur),
    edgeMm2Eur: num(src, 'edgeMm2Eur', d.edgeMm2Eur),
    edgeMm05Eur: num(src, 'edgeMm05Eur', d.edgeMm05Eur),
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
