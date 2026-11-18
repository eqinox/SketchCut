import type { Part, Sheet } from '@/types'
import {
  DEFAULT_CHIPBOARD_HEIGHT,
  DEFAULT_CHIPBOARD_WIDTH,
  createHardboardSheet,
  partKind,
  referenceSheet,
  sheetFraction,
  sheetKind,
  usedBoardCostEur,
} from '@/lib/cabinets/materials'
import { parseHexColor } from '@/lib/cabinets/colors'
import type { GeneratedPanel, PanelRole } from '@/lib/cabinets/types'
import { generateId } from '@/lib/utils'

/** A decor the workshop buys as its own board: a name, the colour you see, and the sheet price. */
export interface BoardFinish {
  id: string
  name: string
  color: string
  sheetPriceEur: number
  /**
   * Swatch the drawing turns into a whole sheet.
   * Either a JPEG data URL, or a built-in Kronospan file such as `/kronospan/K8681.jpg`.
   */
  image?: string
}

const KRONOSPAN_SWATCH = /^\/kronospan\/[A-Za-z0-9]+\.jpg$/

function parseFinishImage(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  if (KRONOSPAN_SWATCH.test(raw)) return raw
  if (!raw.startsWith('data:image/')) return undefined
  if (raw.length < 32 || raw.length > 500_000) return undefined
  return raw
}

const FRONT_ROLES = new Set<PanelRole>(['door', 'sliding-door', 'drawer-front'])

export function isFrontPanel(role: PanelRole): boolean {
  return FRONT_ROLES.has(role)
}

export function parseBoardFinishes(raw: unknown): BoardFinish[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: BoardFinish[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const src = item as Record<string, unknown>
    const id = typeof src.id === 'string' ? src.id.trim() : ''
    const name = typeof src.name === 'string' ? src.name.trim() : ''
    if (!id || !name || seen.has(id)) continue
    const price = src.sheetPriceEur
    seen.add(id)
    const image = parseFinishImage(src.image)
    out.push({
      id,
      name,
      color: parseHexColor(src.color, '#c4a574'),
      sheetPriceEur: typeof price === 'number' && Number.isFinite(price) && price >= 0 ? price : 0,
      ...(image ? { image } : {}),
    })
  }
  return out
}

export function finishById(finishes: BoardFinish[], id: string | undefined): BoardFinish | undefined {
  if (!id) return undefined
  return finishes.find((finish) => finish.id === id)
}

/** One drawn piece points at a board from the workshop list, not at a free colour. */
export function parsePieceFinishes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || key.length > 80 || typeof value !== 'string') continue
    const id = value.trim()
    if (!id || id.length > 80) continue
    out[key] = id
  }
  return out
}

/** Colour and photo of each piece, taken from the board it points at. */
export function paintForPieceFinishes(
  raw: unknown,
  finishes: BoardFinish[],
): { colors: Record<string, string>; images: { color: string; image: string }[] } {
  const colors: Record<string, string> = {}
  const images: { color: string; image: string }[] = []
  const seen = new Set<string>()
  for (const [piece, id] of Object.entries(parsePieceFinishes(raw))) {
    const finish = finishById(finishes, id)
    if (!finish) continue
    colors[piece] = finish.color
    const key = finish.color.toLowerCase()
    if (finish.image && !seen.has(key)) {
      seen.add(key)
      images.push({ color: finish.color, image: finish.image })
    }
  }
  return { colors, images }
}

export function newBoardFinish(
  name: string,
  color: string,
  sheetPriceEur: number,
  image?: string,
): BoardFinish {
  const photo = parseFinishImage(image)
  return {
    id: generateId(),
    name: name.trim() || 'Цвят',
    color: parseHexColor(color, '#c4a574'),
    sheetPriceEur: sheetPriceEur >= 0 ? sheetPriceEur : 0,
    ...(photo ? { image: photo } : {}),
  }
}

function withFinish(panel: GeneratedPanel, finishId: string): GeneratedPanel {
  return finishId ? { ...panel, finishId } : panel
}

/**
 * Doors and fronts take the front decor. The rest of the chipboard takes the carcass decor.
 * A piece chosen on the drawing takes that board instead, and a shared line splits when the copies differ.
 */
export function stampPanelFinishes(
  panels: GeneratedPanel[],
  carcassId: unknown,
  frontId: unknown,
  pieceFinishesRaw?: unknown,
): GeneratedPanel[] {
  const chosen = parsePieceFinishes(pieceFinishesRaw)
  const carcass = typeof carcassId === 'string' ? carcassId : ''
  const front = typeof frontId === 'string' ? frontId : ''
  const carcassFinish = carcass || front
  const frontFinish = front || carcass
  const out: GeneratedPanel[] = []
  for (const panel of panels) {
    if (panel.material === 'hardboard' || panel.excludeFromCutting) {
      out.push(panel)
      continue
    }
    const fallback = isFrontPanel(panel.role) ? frontFinish : carcassFinish
    const keys = panel.pieceKeys
    if (!keys || keys.length === 0) {
      out.push(withFinish(panel, fallback))
      continue
    }
    const groups = new Map<string, number>()
    for (let i = 0; i < panel.quantity; i++) {
      const key = keys[i]
      const id = (key && chosen[key]) || fallback || ''
      groups.set(id, (groups.get(id) ?? 0) + 1)
    }
    if (groups.size <= 1) {
      out.push(withFinish(panel, [...groups.keys()][0] ?? ''))
      continue
    }
    for (const [id, quantity] of groups) {
      const pieceKeys = keys.filter((key, index) => {
        const finish = (key && chosen[key]) || fallback || ''
        return index < panel.quantity && finish === id && key
      })
      out.push(withFinish({ ...panel, quantity, ...(pieceKeys.length > 0 ? { pieceKeys } : {}) }, id))
    }
  }
  return out
}

export function chipboardFinishIds(panels: GeneratedPanel[]): string[] {
  const ids: string[] = []
  for (const panel of panels) {
    if (panel.excludeFromCutting || panel.material === 'hardboard' || !panel.finishId) continue
    if (!ids.includes(panel.finishId)) ids.push(panel.finishId)
  }
  return ids
}

export function panelsOfFinish(panels: GeneratedPanel[], finishId: string): GeneratedPanel[] {
  return panels.filter(
    (panel) =>
      !panel.excludeFromCutting && panel.material !== 'hardboard' && panel.finishId === finishId,
  )
}

export function sheetForFinish(
  sheets: Sheet[],
  finishId: string,
  finishes: BoardFinish[],
): { width: number; height: number; priceEur: number } {
  const found = sheets.find((sheet) => sheet.kind !== 'hardboard' && sheet.finishId === finishId)
  const finish = finishById(finishes, finishId)
  if (found) {
    return {
      width: found.width,
      height: found.height,
      priceEur: found.priceEur ?? finish?.sheetPriceEur ?? 0,
    }
  }
  if (finish) {
    return {
      width: DEFAULT_CHIPBOARD_WIDTH,
      height: DEFAULT_CHIPBOARD_HEIGHT,
      priceEur: finish.sheetPriceEur,
    }
  }
  return referenceSheet(sheets, 'chipboard')
}

function chipboardArea(panels: GeneratedPanel[]): number {
  return panels
    .filter((panel) => !panel.excludeFromCutting && panel.material !== 'hardboard')
    .reduce((sum, panel) => sum + (panel.width * panel.height * panel.quantity) / 1_000_000, 0)
}

/** Share of a full sheet, added up when the carcass and the doors are different decors. */
export function chipboardFraction(panels: GeneratedPanel[], sheets: Sheet[], finishes: BoardFinish[] = []): number {
  const ids = chipboardFinishIds(panels)
  if (ids.length === 0) {
    const sheet = referenceSheet(sheets, 'chipboard')
    return sheetFraction(chipboardArea(panels), sheet.width, sheet.height)
  }
  return ids.reduce((sum, id) => {
    const area = panelsOfFinish(panels, id).reduce(
      (part, panel) => part + (panel.width * panel.height * panel.quantity) / 1_000_000,
      0,
    )
    const sheet = sheetForFinish(sheets, id, finishes)
    return sum + sheetFraction(area, sheet.width, sheet.height)
  }, 0)
}

export function chipboardCostEur(
  panels: GeneratedPanel[],
  sheets: Sheet[],
  finishes: BoardFinish[],
  billWholeSheets: boolean,
): number {
  const ids = chipboardFinishIds(panels)
  if (ids.length === 0) {
    const sheet = referenceSheet(sheets, 'chipboard')
    return usedBoardCostEur(chipboardArea(panels), sheet.width, sheet.height, sheet.priceEur, billWholeSheets)
  }
  return ids.reduce((sum, id) => {
    const area = panelsOfFinish(panels, id).reduce(
      (part, panel) => part + (panel.width * panel.height * panel.quantity) / 1_000_000,
      0,
    )
    const sheet = sheetForFinish(sheets, id, finishes)
    return sum + usedBoardCostEur(area, sheet.width, sheet.height, sheet.priceEur, billWholeSheets)
  }, 0)
}

export function ensureFinishSheets(sheets: Sheet[], parts: Part[], finishes: BoardFinish[]): Sheet[] {
  const needed = new Set(parts.filter((part) => part.kind !== 'hardboard' && part.finishId).map((part) => part.finishId!))
  const next = [...sheets]
  for (const id of needed) {
    if (next.some((sheet) => sheet.kind !== 'hardboard' && sheet.finishId === id)) continue
    const finish = finishById(finishes, id)
    if (!finish) continue
    next.push({
      id: generateId(),
      width: DEFAULT_CHIPBOARD_WIDTH,
      height: DEFAULT_CHIPBOARD_HEIGHT,
      quantity: 1,
      kind: 'chipboard',
      priceEur: finish.sheetPriceEur,
      finishId: id,
    })
  }
  return next
}

function plainChipboardSheet(priceEur: number): Sheet {
  return {
    id: generateId(),
    width: DEFAULT_CHIPBOARD_WIDTH,
    height: DEFAULT_CHIPBOARD_HEIGHT,
    quantity: 1,
    kind: 'chipboard',
    priceEur,
  }
}

/** Make sure generate has a sheet for every part colour, plus фазер when there are backs. */
export function ensurePackingSheets(
  sheets: Sheet[],
  parts: Part[],
  finishes: BoardFinish[],
  prices: { chipboardPriceEur: number; hardboardPriceEur: number },
): Sheet[] {
  const next = [...ensureFinishSheets(sheets, parts, finishes)]
  const chipPrice = prices.chipboardPriceEur
  const needed = new Set(
    parts.filter((part) => partKind(part) === 'chipboard' && part.finishId).map((part) => part.finishId!),
  )
  for (const id of needed) {
    if (next.some((sheet) => sheetKind(sheet) === 'chipboard' && sheet.finishId === id)) continue
    const finish = finishById(finishes, id)
    next.push({
      id: generateId(),
      width: DEFAULT_CHIPBOARD_WIDTH,
      height: DEFAULT_CHIPBOARD_HEIGHT,
      quantity: 1,
      kind: 'chipboard',
      priceEur: finish?.sheetPriceEur ?? chipPrice,
      finishId: id,
    })
  }

  const chipParts = parts.filter((part) => partKind(part) === 'chipboard')
  const plainParts = chipParts.some((part) => !part.finishId)
  const coloredParts = chipParts.some((part) => !!part.finishId)
  const hasChipSheet = next.some((sheet) => sheetKind(sheet) === 'chipboard')
  const hasPlainSheet = next.some((sheet) => sheetKind(sheet) === 'chipboard' && !sheet.finishId)
  if (chipParts.length > 0 && !hasChipSheet) {
    next.push(plainChipboardSheet(chipPrice))
  } else if (plainParts && coloredParts && !hasPlainSheet) {
    next.push(plainChipboardSheet(chipPrice))
  }

  if (
    parts.some((part) => partKind(part) === 'hardboard') &&
    !next.some((sheet) => sheetKind(sheet) === 'hardboard')
  ) {
    next.push(createHardboardSheet(generateId(), prices.hardboardPriceEur))
  }
  return next
}
