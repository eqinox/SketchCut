import type { Part, Sheet } from '@/types'
import {
  DEFAULT_CHIPBOARD_HEIGHT,
  DEFAULT_CHIPBOARD_WIDTH,
  referenceSheet,
  sheetFraction,
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
  /** Cropped swatch (JPEG data URL). The drawing builds a whole sheet from it. */
  image?: string
}

function parseFinishImage(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.startsWith('data:image/')) return undefined
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

/** Doors and fronts take the front decor. The rest of the chipboard takes the carcass decor. */
export function stampPanelFinishes(
  panels: GeneratedPanel[],
  carcassId: unknown,
  frontId: unknown,
): GeneratedPanel[] {
  const carcass = typeof carcassId === 'string' ? carcassId : ''
  const front = typeof frontId === 'string' ? frontId : ''
  if (!carcass && !front) return panels
  const carcassFinish = carcass || front
  const frontFinish = front || carcass
  return panels.map((panel) => {
    if (panel.material === 'hardboard' || panel.excludeFromCutting) return panel
    return { ...panel, finishId: isFrontPanel(panel.role) ? frontFinish : carcassFinish }
  })
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
