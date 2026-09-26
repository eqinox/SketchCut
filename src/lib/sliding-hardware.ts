/** Sliding-wardrobe hardware catalogs, sold as whole bars / kits. */

export const SLIDING_TRACK_LENGTH_MM = 3000
export const SLIDING_UPPER_TRACK_DEPTH_MM = 80
export const SLIDING_UPPER_TRACK_HEIGHT_MM = 44
/** Extra setback beyond the upper rail so doors pass freely. */
export const SLIDING_UPPER_TRACK_CLEARANCE_MM = 10
export const SLIDING_LOWER_TRACK_DEPTH_MM = 62
export const SLIDING_LOWER_TRACK_HEIGHT_MM = 4
/** Lower rail sits this far in from the bottom front edge so it lines up with the upper. */
export const SLIDING_LOWER_TRACK_INSET_MM = 20

export const SLIDING_TRACK_COLOR_IDS = ['black', 'matt-chrome', 'chrome', 'inox', 'white'] as const
export type SlidingTrackColor = (typeof SLIDING_TRACK_COLOR_IDS)[number]

export const SLIDING_TRACK_COLOR_LABELS: Record<SlidingTrackColor, string> = {
  black: 'Черен',
  'matt-chrome': 'Матхром',
  chrome: 'Хром',
  inox: 'Инокс',
  white: 'Бяло',
}

export interface SlidingProfileSku {
  id: string
  code: string
  color: string
  lengthMm: number
  priceEur: number
}

export interface SlidingHardwareLinks {
  d1Handle: string
  d2Profile: string
  mvp005System: string
  mvp005Mechanism: string
  softClose: string
}

export const DEFAULT_SLIDING_UPPER_TRACK_EUR: Record<SlidingTrackColor, number> = {
  black: 22.5,
  'matt-chrome': 19.02,
  chrome: 14.1,
  inox: 26.31,
  white: 23.79,
}

export const DEFAULT_SLIDING_LOWER_TRACK_EUR: Record<SlidingTrackColor, number> = {
  black: 11.19,
  'matt-chrome': 10.89,
  chrome: 6.96,
  inox: 12.45,
  white: 12.63,
}

export const DEFAULT_SLIDING_MVP005_KIT_EUR = 27.61
export const DEFAULT_SLIDING_SOFT_CLOSE_EUR = 9.4

/** D1L handle profiles — whole bar price, 18 mm board. */
export const DEFAULT_SLIDING_HANDLE_SKUS: SlidingProfileSku[] = [
  { id: '070476', code: '070476', color: 'Алуминий', lengthMm: 2500, priceEur: 15.6 },
  { id: '070476A', code: '070476A', color: 'Алуминий', lengthMm: 3000, priceEur: 18.72 },
  { id: '070581', code: '070581', color: 'Инокс', lengthMm: 2500, priceEur: 13.93 },
  { id: '070652', code: '070652', color: 'Черен мат', lengthMm: 2700, priceEur: 16.62 },
  { id: '070727', code: '070727', color: 'Черен мат', lengthMm: 2500, priceEur: 14.25 },
  { id: '070727A', code: '070727A', color: 'Черен мат', lengthMm: 3000, priceEur: 17.1 },
]

/** D2 cap profiles for 18 mm board only — whole bar price. */
export const DEFAULT_SLIDING_CAP_SKUS: SlidingProfileSku[] = [
  { id: '070477', code: '070477', color: 'Алуминий', lengthMm: 2500, priceEur: 6 },
  { id: '070184', code: '070184', color: 'Инокс', lengthMm: 2700, priceEur: 7.5 },
  { id: '070207', code: '070207', color: 'Алуминий', lengthMm: 6000, priceEur: 11.88 },
  { id: '070228', code: '070228', color: 'Об. хром', lengthMm: 2700, priceEur: 4.23 },
  { id: '070234', code: '070234', color: 'Хим. хром', lengthMm: 2700, priceEur: 6.41 },
  { id: '070477A', code: '070477A', color: 'Алуминий', lengthMm: 3000, priceEur: 7.2 },
  { id: '070572', code: '070572', color: 'Инокс', lengthMm: 2000, priceEur: 5.38 },
  { id: '070572A', code: '070572A', color: 'Инокс', lengthMm: 2500, priceEur: 8.07 },
  { id: '070653', code: '070653', color: 'Черен мат', lengthMm: 2700, priceEur: 6.54 },
  { id: '070722', code: '070722', color: 'Черен мат', lengthMm: 2500, priceEur: 5.8 },
  { id: '070722A', code: '070722A', color: 'Черен мат', lengthMm: 3000, priceEur: 6.96 },
]

export const DEFAULT_SLIDING_LINKS: SlidingHardwareLinks = {
  d1Handle: 'https://balkanyug.bg/bg/product/1169-al-kant-drujka-al-d1-l/',
  d2Profile: 'https://balkanyug.bg/bg/product/2772-alprofil-al-d2-18mm-/',
  mvp005System: 'https://balkanyug.bg/bg/product/852-mpv-005-7036/',
  mvp005Mechanism: 'https://balkanyug.bg/bg/product/5611-mehanizum-za-pluzgashti-vrati-7302/',
  softClose: 'https://balkanyug.bg/bg/product/5118-plavno-zatvariane-za-mehanizum-mpv-005-alb-6740-/',
}

export function parseSlidingTrackColor(raw: unknown, fallback: SlidingTrackColor = 'black'): SlidingTrackColor {
  return SLIDING_TRACK_COLOR_IDS.includes(raw as SlidingTrackColor) ? (raw as SlidingTrackColor) : fallback
}

export function parseSoftCloseCount(raw: unknown, fallback = 1): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(12, Math.round(n))
}

export function parseSlidingSkuId(raw: unknown): string {
  return typeof raw === 'string' ? raw : ''
}

function parseSku(raw: unknown, fallback: SlidingProfileSku): SlidingProfileSku {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...fallback }
  const row = raw as Record<string, unknown>
  const lengthMm =
    typeof row.lengthMm === 'number' && Number.isFinite(row.lengthMm) && row.lengthMm > 0
      ? Math.round(row.lengthMm)
      : fallback.lengthMm
  const priceEur =
    typeof row.priceEur === 'number' && Number.isFinite(row.priceEur) && row.priceEur >= 0
      ? row.priceEur
      : fallback.priceEur
  return {
    id: typeof row.id === 'string' && row.id ? row.id : fallback.id,
    code: typeof row.code === 'string' && row.code ? row.code : fallback.code,
    color: typeof row.color === 'string' && row.color ? row.color : fallback.color,
    lengthMm,
    priceEur,
  }
}

export function parseSlidingSkuList(raw: unknown, defaults: SlidingProfileSku[]): SlidingProfileSku[] {
  const byId = new Map(defaults.map((sku) => [sku.id, { ...sku }]))
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const row = item as Record<string, unknown>
      const id = typeof row.id === 'string' && row.id ? row.id : typeof row.code === 'string' ? row.code : ''
      if (!id) continue
      const prev = byId.get(id) ?? {
        id,
        code: typeof row.code === 'string' && row.code ? row.code : id,
        color: typeof row.color === 'string' ? row.color : '',
        lengthMm: 0,
        priceEur: 0,
      }
      byId.set(id, parseSku(row, prev))
    }
  }
  const out = defaults.map((sku) => byId.get(sku.id) ?? { ...sku })
  for (const sku of byId.values()) {
    if (!defaults.some((d) => d.id === sku.id)) out.push(sku)
  }
  return out
}

export function parseSlidingTrackPrices(
  raw: unknown,
  defaults: Record<SlidingTrackColor, number>,
): Record<SlidingTrackColor, number> {
  const out = { ...defaults }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  const src = raw as Record<string, unknown>
  for (const id of SLIDING_TRACK_COLOR_IDS) {
    const v = src[id]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[id] = v
  }
  return out
}

export function parseSlidingLinks(raw: unknown): SlidingHardwareLinks {
  const d = DEFAULT_SLIDING_LINKS
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...d }
  const src = raw as Record<string, unknown>
  const str = (key: keyof SlidingHardwareLinks) =>
    typeof src[key] === 'string' && (src[key] as string).trim() ? (src[key] as string).trim() : d[key]
  return {
    d1Handle: str('d1Handle'),
    d2Profile: str('d2Profile'),
    mvp005System: str('mvp005System'),
    mvp005Mechanism: str('mvp005Mechanism'),
    softClose: str('softClose'),
  }
}

/** Shortest bar that covers `needMm`. Preferred id wins if it is long enough. */
export function pickSlidingSku(
  skus: SlidingProfileSku[],
  needMm: number,
  preferredId?: string,
): SlidingProfileSku | null {
  if (skus.length === 0) return null
  const longEnough = [...skus]
    .filter((sku) => sku.lengthMm >= needMm)
    .sort((a, b) => a.lengthMm - b.lengthMm || a.priceEur - b.priceEur)
  if (preferredId) {
    const pref = skus.find((sku) => sku.id === preferredId)
    if (pref && pref.lengthMm >= needMm) return pref
  }
  if (longEnough[0]) return longEnough[0]
  return [...skus].sort((a, b) => b.lengthMm - a.lengthMm)[0] ?? null
}

export function slidingSkuLabel(sku: SlidingProfileSku): string {
  return `${sku.code} · ${sku.color} · ${sku.lengthMm} мм · ${sku.priceEur.toFixed(2)} €`
}
