export type CabinetPartColorKey = 'bottom' | 'side' | 'rail' | 'shelf' | 'leg'

export interface CabinetPartColors {
  bottom: string
  side: string
  rail: string
  shelf: string
  leg: string
}

/** Default board colour — all panels share this unless overridden. */
export const DEFAULT_WOOD_COLOR = '#c4a574'
export const DEFAULT_LEG_COLOR = '#334155'
export const DEFAULT_HARDBOARD_COLOR = '#8d7a62'

export const DEFAULT_PART_COLORS: CabinetPartColors = {
  bottom: DEFAULT_WOOD_COLOR,
  side: DEFAULT_WOOD_COLOR,
  rail: DEFAULT_WOOD_COLOR,
  shelf: DEFAULT_WOOD_COLOR,
  leg: DEFAULT_LEG_COLOR,
}

export const PART_COLOR_FIELDS: { key: CabinetPartColorKey; label: string }[] = [
  { key: 'bottom', label: 'Дъно' },
  { key: 'side', label: 'Страници' },
  { key: 'rail', label: 'Царги' },
  { key: 'shelf', label: 'Рафтове' },
  { key: 'leg', label: 'Крачета' },
]

const HEX = /^#([0-9a-fA-F]{6})$/

export function parseHexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : fallback
}

export function parsePartColors(raw: unknown): CabinetPartColors {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  return {
    bottom: parseHexColor(src.bottom, DEFAULT_PART_COLORS.bottom),
    side: parseHexColor(src.side, DEFAULT_PART_COLORS.side),
    rail: parseHexColor(src.rail, DEFAULT_PART_COLORS.rail),
    shelf: parseHexColor(src.shelf, DEFAULT_PART_COLORS.shelf),
    leg: parseHexColor(src.leg, DEFAULT_PART_COLORS.leg),
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** factor < 1 darkens, > 1 lightens */
export function shade(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(parseHexColor(hex, DEFAULT_WOOD_COLOR))
  return rgbToHex(r * factor, g * factor, b * factor)
}

export function partFaces(hex: string) {
  return {
    front: hex,
    side: shade(hex, 0.82),
    top: shade(hex, 1.14),
  }
}
