import { ensureFinishSheets, type BoardFinish } from '@/lib/board-finishes'
import { partKind, sheetKind } from '@/lib/cabinets/materials'
import { defaultKronospanBoard, kronospanBoardByFinishId } from '@/lib/kronospan-color'
import type { Part, Sheet } from '@/types'

/**
 * Whether a decor has a direction. Wood decors do. Plain colours (white, grey, the colour
 * group) do not, so parts cut from them can be turned either way. Unknown decors: undefined.
 */
export function finishHasGrain(finishId: string): boolean | undefined {
  const board =
    kronospanBoardByFinishId(finishId) ??
    (finishId.startsWith('krono-') ? defaultKronospanBoard(finishId.slice('krono-'.length)) : undefined)
  if (!board) return undefined
  return board.group === 'Дървесни' || board.group === 'Камък и бетон'
}

/**
 * The sheet list holds only the boards the parts are cut from, and the фазер.
 * A board nobody uses any more (a colour that was swapped away, the plain board once every
 * cabinet has a colour) is taken off. Each decor board knows whether it has grain.
 */
export function syncSheets(sheets: Sheet[], parts: Part[], finishes: BoardFinish[]): Sheet[] {
  const withNew = ensureFinishSheets(sheets, parts, finishes)
  const chipParts = parts.filter((part) => partKind(part) === 'chipboard')
  const usedDecors = new Set(chipParts.flatMap((part) => (part.finishId ? [part.finishId] : [])))
  const usesPlain = chipParts.some((part) => !part.finishId)
  const kept = withNew.filter((sheet) => {
    if (sheetKind(sheet) === 'hardboard') return true
    if (sheet.finishId) return usedDecors.has(sheet.finishId)
    // With no parts yet the plain board stays as the starting sheet.
    return usesPlain || chipParts.length === 0
  })
  return kept.map((sheet) => {
    if (sheet.grainByHand) return sheet
    // Фазер is the same all over, so its parts turn freely.
    if (sheetKind(sheet) === 'hardboard') return sheet.hasGrain === false ? sheet : { ...sheet, hasGrain: false }
    if (!sheet.finishId) return sheet
    const grain = finishHasGrain(sheet.finishId)
    return grain === undefined || grain === sheet.hasGrain ? sheet : { ...sheet, hasGrain: grain }
  })
}

/** True when the part's board has no grain: then it turns either way, whatever its own setting says. */
export function partOnSmoothBoard(part: Part, sheets: Sheet[]): boolean {
  const kind = partKind(part)
  const board = sheets.find(
    (sheet) => sheetKind(sheet) === kind && (kind === 'hardboard' || (sheet.finishId ?? '') === (part.finishId ?? '')),
  )
  return board?.hasGrain === false
}
