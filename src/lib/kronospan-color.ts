import type { BoardFinish } from '@/lib/board-finishes'
import { KRONOSPAN_BOARDS as BOARD_ROWS } from '@/data/kronospan-boards'
import { KRONOSPAN_COLORS } from '@/data/kronospan-color'

export interface KronospanSwatch {
  code: string
  name: string
  image?: string
  color: string
}

export interface KronospanColor extends KronospanSwatch {
  image: string
  combinations: KronospanSwatch[]
}

/** One shop board: the decor plus the surface Kronospan presses into it, with that sheet's price. */
export interface KronospanBoard extends KronospanSwatch {
  surface: string
  surfaceLabel: string
  priceEur: number
  group: string
}

export const KRONOSPAN_COLOR_COLLECTION: KronospanColor[] = KRONOSPAN_COLORS

export const KRONOSPAN_GROUP_ORDER = [
  'Бели',
  'Сиви',
  'Черни',
  'Бежови и кафяви',
  'Цветни',
  'Дървесни',
  'Камък и бетон',
  'Други',
] as const

export const KRONOSPAN_BOARDS: KronospanBoard[] = BOARD_ROWS

const byCode = new Map<string, KronospanSwatch>()
for (const color of KRONOSPAN_COLOR_COLLECTION) {
  byCode.set(color.code, color)
  for (const combo of color.combinations) {
    if (!byCode.has(combo.code)) byCode.set(combo.code, combo)
  }
}

const boardsByCode = new Map<string, KronospanBoard[]>()
for (const board of KRONOSPAN_BOARDS) {
  const rows = boardsByCode.get(board.code)
  if (rows) rows.push(board)
  else boardsByCode.set(board.code, [board])
}

const SURFACE_RANK = ['PE', 'SM', 'BS', 'SU', 'PD', 'PW', 'SN']

function surfaceRank(surface: string): number {
  const index = SURFACE_RANK.indexOf(surface)
  return index < 0 ? SURFACE_RANK.length : index
}

export function kronospanPriceLabel(price: number): string {
  return `${price.toFixed(2).replace('.', ',')} €`
}

export function kronospanBoardId(board: { code: string; surface: string }): string {
  return `krono-${board.code}-${board.surface}`
}

export function kronospanFinishId(code: string): string {
  const board = defaultKronospanBoard(code)
  return board ? kronospanBoardId(board) : `krono-${code}`
}

export function kronospanBoardsFor(code: string | null | undefined): KronospanBoard[] {
  if (!code) return []
  return boardsByCode.get(code) ?? []
}

/** The ordinary sheet for a decor: the lower price, and шагре or гладко when the prices match. */
export function defaultKronospanBoard(code: string | null | undefined): KronospanBoard | undefined {
  const rows = kronospanBoardsFor(code)
  if (rows.length === 0) return undefined
  return [...rows].sort((a, b) => a.priceEur - b.priceEur || surfaceRank(a.surface) - surfaceRank(b.surface))[0]
}

export function kronospanBoardByFinishId(id: string): KronospanBoard | undefined {
  if (!id.startsWith('krono-')) return undefined
  const rest = id.slice('krono-'.length)
  const split = rest.match(/^(.*)-([A-Z]{2})$/)
  if (split) {
    return kronospanBoardsFor(split[1]).find((board) => board.surface === split[2])
  }
  return defaultKronospanBoard(rest)
}

export function kronospanCodeFromFinish(finish: { id: string; name?: string } | null | undefined): string | null {
  if (!finish) return null
  const board = kronospanBoardByFinishId(finish.id)
  if (board) return board.code
  if (finish.id.startsWith('krono-')) {
    const code = finish.id.slice('krono-'.length)
    return byCode.has(code) || boardsByCode.has(code) ? code : null
  }
  const code = finish.name?.split(' ')[0] ?? ''
  return byCode.has(code) || boardsByCode.has(code) ? code : null
}

export function kronospanColor(code: string | null | undefined): KronospanColor | undefined {
  if (!code) return undefined
  return KRONOSPAN_COLOR_COLLECTION.find((color) => color.code === code)
}

export function kronospanSwatchByFinishId(id: string): KronospanSwatch | undefined {
  const board = kronospanBoardByFinishId(id)
  if (board) return board
  if (!id.startsWith('krono-')) return undefined
  return byCode.get(id.slice('krono-'.length))
}

export function boardFinishFromBoard(board: KronospanBoard): BoardFinish {
  return {
    id: kronospanBoardId(board),
    name: `${board.code} ${board.name} · ${board.surfaceLabel}`,
    color: board.color,
    sheetPriceEur: board.priceEur,
    ...(board.image ? { image: board.image } : {}),
  }
}

export function boardFinishFromSwatch(swatch: KronospanSwatch): BoardFinish {
  const board = defaultKronospanBoard(swatch.code)
  if (board) return boardFinishFromBoard(board)
  return {
    id: `krono-${swatch.code}`,
    name: `${swatch.code} ${swatch.name}`,
    color: swatch.color,
    sheetPriceEur: 0,
    ...(swatch.image ? { image: swatch.image } : {}),
  }
}

/** Keep an already added colour, including a price the workshop typed in. */
export function withKronospanBoard(rows: BoardFinish[], board: KronospanBoard): BoardFinish[] {
  const id = kronospanBoardId(board)
  if (rows.some((row) => row.id === id)) return rows
  return [...rows, boardFinishFromBoard(board)]
}

export function withKronospanFinish(rows: BoardFinish[], swatch: KronospanSwatch): BoardFinish[] {
  const board = defaultKronospanBoard(swatch.code)
  if (board) return withKronospanBoard(rows, board)
  const id = `krono-${swatch.code}`
  if (rows.some((row) => row.id === id)) return rows
  return [...rows, boardFinishFromSwatch(swatch)]
}

/** A saved workshop colour, or a Kronospan sheet that is only chosen on the cabinet. */
export function resolveBoardFinish(rows: BoardFinish[], id: string | undefined): BoardFinish | undefined {
  if (!id) return undefined
  const saved = rows.find((row) => row.id === id)
  if (saved) return saved
  const board = kronospanBoardByFinishId(id)
  if (board) return boardFinishFromBoard(board)
  const swatch = kronospanSwatchByFinishId(id)
  return swatch ? boardFinishFromSwatch(swatch) : undefined
}
