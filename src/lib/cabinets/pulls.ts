import { createContext } from 'react'

/** A bow pull or the plain bar. `none` leaves the front without a handle. */
export type PullSku = 'none' | 'normal' | 'tara-96' | 'tara-160'

export interface TaraPull {
  sku: 'tara-96' | 'tara-160'
  name: string
  /** Screw centres, mm. */
  c: number
  /** The other drilling this model accepts, mm. */
  c1: number
  /** Overall length, mm. */
  l: number
  /** How far the bow stands off the front, mm. */
  h: number
  /** Grip width, mm. */
  w: number
  /** Pieces in a pack, when the maker states it. */
  pack?: number
  color: string
}

export const TARA_PULLS: readonly TaraPull[] = [
  {
    sku: 'tara-96',
    name: 'Дръжка Тара 96/128',
    c: 96,
    c1: 128,
    l: 158,
    h: 26,
    w: 16,
    pack: 30,
    color: '06/07 — Хром/Инокс',
  },
  {
    sku: 'tara-160',
    name: 'Дръжка Тара 160/192',
    c: 160,
    c1: 192,
    l: 233,
    h: 26,
    w: 18,
    color: '06/07 — Хром/Инокс',
  },
]

export const PULL_CHOICES: readonly { sku: PullSku; name: string }[] = [
  { sku: 'normal', name: 'Обикновена дръжка' },
  { sku: 'tara-96', name: 'Дръжка Тара 96/128' },
  { sku: 'tara-160', name: 'Дръжка Тара 160/192' },
  { sku: 'none', name: 'Без дръжка' },
]

export function taraPull(sku: string): TaraPull | undefined {
  return TARA_PULLS.find((pull) => pull.sku === sku)
}

export function isTaraSku(sku: string): sku is 'tara-96' | 'tara-160' {
  return sku === 'tara-96' || sku === 'tara-160'
}

export function parsePullSku(raw: unknown): PullSku {
  if (raw === 'none' || raw === 'tara-96' || raw === 'tara-160' || raw === 'normal') return raw
  return 'normal'
}

export function parsePullOverrides(raw: unknown): Record<string, PullSku> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, PullSku> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key) continue
    if (value === 'none' || value === 'normal' || value === 'tara-96' || value === 'tara-160') out[key] = value
  }
  return out
}

export function pullName(sku: PullSku): string {
  if (sku === 'none') return 'Без дръжка'
  if (sku === 'normal') return 'Обикновена дръжка'
  return taraPull(sku)?.name ?? 'Дръжка Тара'
}

export function pullHardwareId(sku: Exclude<PullSku, 'none'>): string {
  if (sku === 'normal') return 'handle-normal'
  return `handle-${sku}`
}

/** Which pull a front wears. Missing context keeps the ordinary handle. */
export interface PullChoice {
  skuFor(key: string): PullSku
  choose?: (key: string, sku: PullSku) => void
}

export const PullChoiceContext = createContext<PullChoice | null>(null)

export function pullChoiceFrom(
  params: Record<string, unknown>,
  choose?: (key: string, sku: PullSku) => void,
): PullChoice {
  const overrides = parsePullOverrides(params.handleOverrides)
  const fallback: PullSku = params.includeHandles === false ? 'none' : parsePullSku(params.handleSku)
  return {
    skuFor(key) {
      return overrides[key] ?? fallback
    },
    choose,
  }
}
