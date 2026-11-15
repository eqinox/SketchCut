import type { BoardFinish } from '@/lib/board-finishes'
import { KRONOSPAN_COLORS } from '@/data/kronospan-color'

export interface KronospanSwatch {
  code: string
  name: string
  image: string
  color: string
}

export interface KronospanColor extends KronospanSwatch {
  combinations: KronospanSwatch[]
}

export const KRONOSPAN_COLOR_COLLECTION: KronospanColor[] = KRONOSPAN_COLORS

const byCode = new Map<string, KronospanSwatch>()
for (const color of KRONOSPAN_COLOR_COLLECTION) {
  byCode.set(color.code, color)
  for (const combo of color.combinations) {
    if (!byCode.has(combo.code)) byCode.set(combo.code, combo)
  }
}

export function kronospanFinishId(code: string): string {
  return `krono-${code}`
}

export function kronospanCodeFromFinish(finish: { id: string; name?: string } | null | undefined): string | null {
  if (!finish) return null
  if (finish.id.startsWith('krono-')) {
    const code = finish.id.slice('krono-'.length)
    return byCode.has(code) ? code : null
  }
  const code = finish.name?.split(' ')[0] ?? ''
  return byCode.has(code) ? code : null
}

export function kronospanColor(code: string | null | undefined): KronospanColor | undefined {
  if (!code) return undefined
  return KRONOSPAN_COLOR_COLLECTION.find((color) => color.code === code)
}

export function boardFinishFromSwatch(swatch: KronospanSwatch): BoardFinish {
  return {
    id: kronospanFinishId(swatch.code),
    name: `${swatch.code} ${swatch.name}`,
    color: swatch.color,
    sheetPriceEur: 0,
    image: swatch.image,
  }
}

/** Keep an already added colour, including a price the workshop typed in. */
export function withKronospanFinish(rows: BoardFinish[], swatch: KronospanSwatch): BoardFinish[] {
  const id = kronospanFinishId(swatch.code)
  if (rows.some((row) => row.id === id)) return rows
  return [...rows, boardFinishFromSwatch(swatch)]
}

export function kronospanSwatchByFinishId(id: string): KronospanSwatch | undefined {
  if (!id.startsWith('krono-')) return undefined
  return byCode.get(id.slice('krono-'.length))
}

/** A saved workshop colour, or a Kronospan swatch that is only chosen on the cabinet. */
export function resolveBoardFinish(rows: BoardFinish[], id: string | undefined): BoardFinish | undefined {
  if (!id) return undefined
  const saved = rows.find((row) => row.id === id)
  if (saved) return saved
  const swatch = kronospanSwatchByFinishId(id)
  return swatch ? boardFinishFromSwatch(swatch) : undefined
}
