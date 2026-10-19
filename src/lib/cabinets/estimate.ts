import type { Part, PartEdgeBanding, Sheet } from '@/types'
import { calculateEdgeBandingTotals } from '@/lib/edge-banding'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS, omitsCuttingEdgingLabor } from '@/lib/settings'
import { hardwareCostEur } from './hardware'
import {
  CUTTING_MINUTES_PER_SHEET,
  HARDBOARD_CUTTING_MINUTES_PER_SHEET,
  EDGING_MINUTES_PER_SHEET,
  EDGE_PRICE_MM2_EUR,
  EDGE_PRICE_MM05_EUR,
  edgeBandingCostEur,
  referenceSheet,
  sheetFraction,
  usedBoardCostEur,
} from './materials'
import { WORK_HOURS_PER_DAY, edgeSideThickness, type GeneratedPanel, type HardwareItem, type LaborEstimate } from './types'
import { exactMm } from '../utils'
import type { RuleBlock } from './rule-text'

export { hardwareCostEur } from './hardware'

export interface MaterialEstimate {
  areaM2: number
  chipboardAreaM2: number
  hardboardAreaM2: number
  edgeMm2: number
  edgeMm05: number
  partCount: number
}

export function estimateFromPanels(panels: GeneratedPanel[]): MaterialEstimate {
  const edge = panelsEdgeMeters(panels)
  const chipboardAreaM2 = panelsAreaM2(panels, 'chipboard')
  const hardboardAreaM2 = panelsAreaM2(panels, 'hardboard')
  return {
    areaM2: chipboardAreaM2 + hardboardAreaM2,
    chipboardAreaM2,
    hardboardAreaM2,
    edgeMm2: edge.mm2,
    edgeMm05: edge.mm05,
    partCount: panels.reduce((s, p) => s + p.quantity, 0),
  }
}

export function estimateFromParts(parts: Part[], edgeBanding: PartEdgeBanding[]): MaterialEstimate {
  const totals = calculateEdgeBandingTotals(parts, edgeBanding)
  const chipboardAreaM2 = parts.reduce(
    (s, p) => s + (p.kind === 'hardboard' ? 0 : (p.width * p.height * p.quantity) / 1_000_000),
    0,
  )
  const hardboardAreaM2 = parts.reduce(
    (s, p) => s + (p.kind === 'hardboard' ? (p.width * p.height * p.quantity) / 1_000_000 : 0),
    0,
  )
  return {
    areaM2: chipboardAreaM2 + hardboardAreaM2,
    chipboardAreaM2,
    hardboardAreaM2,
    edgeMm2: totals.mm2,
    edgeMm05: totals.mm05,
    partCount: parts.reduce((s, p) => s + p.quantity, 0),
  }
}

export function panelsAreaM2(panels: GeneratedPanel[], material?: GeneratedPanel['material']): number {
  return panels.reduce((sum, p) => {
    if (p.excludeFromCutting) return sum
    const kind = p.material === 'hardboard' ? 'hardboard' : 'chipboard'
    if (material && kind !== material) return sum
    return sum + (p.width * p.height * p.quantity) / 1_000_000
  }, 0)
}

export function panelsEdgeMeters(panels: GeneratedPanel[]): { mm2: number; mm05: number } {
  let mm2 = 0
  let mm05 = 0
  for (const p of panels) {
    if (p.excludeFromCutting) continue
    const meters = panelEdgeMeters(p)
    mm2 += meters.mm2
    mm05 += meters.mm05
  }
  return { mm2, mm05 }
}

/** Edge length in metres, split when one panel mixes 2 mm and 0.5 mm. */
export function panelEdgeMeters(panel: GeneratedPanel): { mm2: number; mm05: number } {
  let mm2 = 0
  let mm05 = 0
  const add = (on: boolean, len: number, side: 'top' | 'bottom' | 'left' | 'right') => {
    if (!on) return
    if (edgeSideThickness(panel.edges, side) === 'mm2') mm2 += len
    else mm05 += len
  }
  add(panel.edges.top, panel.width, 'top')
  add(panel.edges.bottom, panel.width, 'bottom')
  add(panel.edges.left, panel.height, 'left')
  add(panel.edges.right, panel.height, 'right')
  const q = panel.quantity
  return { mm2: (mm2 * q) / 1000, mm05: (mm05 * q) / 1000 }
}

export function hourlyRateEur(dailyRateEur: number): number {
  if (!dailyRateEur || dailyRateEur <= 0) return 0
  return dailyRateEur / WORK_HOURS_PER_DAY
}

export function laborMinutes(labor: LaborEstimate): number | null {
  const values = [labor.cuttingMinutes, labor.edgingMinutes, labor.assemblyMinutes]
  if (values.every((v) => v == null)) return null
  return values.reduce<number>((s, v) => s + (v ?? 0), 0)
}

export function laborCostEur(labor: LaborEstimate, dailyRateEur: number): number | null {
  const minutes = laborMinutes(labor)
  if (minutes == null) return null
  if (!dailyRateEur || dailyRateEur <= 0) return null
  return (minutes / 60) * hourlyRateEur(dailyRateEur)
}

export function laborFromPanels(
  panels: GeneratedPanel[],
  sheets: Sheet[],
  assemblyMinutes: number | null = null,
): LaborEstimate {
  const chipboard = referenceSheet(sheets, 'chipboard')
  const hardboard = referenceSheet(sheets, 'hardboard')
  const chipFrac = sheetFraction(
    panelsAreaM2(panels, 'chipboard'),
    chipboard.width,
    chipboard.height,
  )
  const hardFrac = sheetFraction(
    panelsAreaM2(panels, 'hardboard'),
    hardboard.width,
    hardboard.height,
  )
  return {
    cuttingMinutes:
      CUTTING_MINUTES_PER_SHEET * chipFrac + HARDBOARD_CUTTING_MINUTES_PER_SHEET * hardFrac,
    edgingMinutes: EDGING_MINUTES_PER_SHEET * chipFrac,
    assemblyMinutes,
  }
}

export function formatMinutes(value: number): string {
  return appendSpokenHours(`${minuteAmount(value)} мин`, value)
}

/** Keeps the minutes text and, from 60 up, adds „час и … мин“. */
export function appendSpokenHours(text: string, minutes: number): string {
  const rounded = Math.round(Math.max(0, minutes) * 10) / 10
  if (rounded < 60) return text
  return `${text} · ${formatHoursFromMinutes(rounded)}`
}

function minuteAmount(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
}

/** 1 → „час“, 2 → „2 часа“, 21 → „21 час“, 11 → „11 часа“. */
function hourPhrase(hours: number): string {
  const mod100 = hours % 100
  const mod10 = hours % 10
  if (mod10 === 1 && mod100 !== 11) return hours === 1 ? 'час' : `${hours} час`
  return `${hours} часа`
}

/** 102,6 мин → „час и 42,6 мин“. Под час остават само минутите. */
export function formatHoursFromMinutes(minutes: number): string {
  const total = Math.round(Math.max(0, minutes) * 10) / 10
  const hours = Math.floor(total / 60 + 1e-9)
  const rest = Math.round((total - hours * 60) * 10) / 10
  if (hours <= 0) return `${minuteAmount(total)} мин`
  if (rest <= 0) return hourPhrase(hours)
  return `${hourPhrase(hours)} и ${minuteAmount(rest)} мин`
}

export interface CabinetPrice {
  hardwareEur: number
  chipboardEur: number
  hardboardEur: number
  edgeEur: number
  /** Boards + edge + fittings (everything except labor). */
  materialEur: number
  cuttingMinutes: number
  edgingMinutes: number
  laborMinutes: number
  laborEur: number | null
  totalEur: number
}

export function isBuyoutDoorPanel(panel: GeneratedPanel): boolean {
  return (
    !!panel.excludeFromCutting &&
    (panel.role === 'door' || panel.role === 'sliding-door' || panel.role === 'drawer-front') &&
    panel.highlightColor === 'order'
  )
}

export interface BuyoutDoorGroup {
  name: string
  width: number
  height: number
  quantity: number
}

export interface BuyoutDoorOrderRow extends BuyoutDoorGroup {
  cabinets: string[]
}

/** Same size and name, summed — for the order list, not the nest. */
export function groupBuyoutDoors(panels: GeneratedPanel[]): BuyoutDoorGroup[] {
  const map = new Map<string, BuyoutDoorGroup>()
  for (const p of panels) {
    if (!isBuyoutDoorPanel(p)) continue
    const width = exactMm(p.width)
    const height = exactMm(p.height)
    const key = `${p.name}|${width}|${height}`
    const prev = map.get(key)
    if (prev) prev.quantity += p.quantity
    else map.set(key, { name: p.name, width, height, quantity: p.quantity })
  }
  return [...map.values()]
}

/** Project-wide buyout doors, grouped by size, with cabinet labels. */
export function collectBuyoutDoorOrderList(
  cabinets: Array<{ label: string; panels: GeneratedPanel[] }>,
): BuyoutDoorOrderRow[] {
  const map = new Map<string, BuyoutDoorOrderRow>()
  for (const cab of cabinets) {
    for (const g of groupBuyoutDoors(cab.panels)) {
      const key = `${g.name}|${g.width}|${g.height}`
      const prev = map.get(key)
      if (prev) {
        prev.quantity += g.quantity
        if (!prev.cabinets.includes(cab.label)) prev.cabinets.push(cab.label)
      } else {
        map.set(key, { ...g, cabinets: [cab.label] })
      }
    }
  }
  return [...map.values()]
}

export function billedLaborFromPanels(
  panels: GeneratedPanel[],
  sheets: Sheet[],
  assemblyMinutes: number | null,
  settings: HardwareSettings,
): LaborEstimate {
  const computed = laborFromPanels(panels, sheets, assemblyMinutes)
  if (!omitsCuttingEdgingLabor(settings)) return computed
  return { ...computed, cuttingMinutes: 0, edgingMinutes: 0 }
}

export function cabinetPrice(
  hardware: HardwareItem[],
  labor: LaborEstimate,
  dailyRateEur: number,
  panels: GeneratedPanel[],
  sheets: Sheet[],
  settings: HardwareSettings = DEFAULT_HARDWARE_SETTINGS,
): CabinetPrice {
  const computed = billedLaborFromPanels(panels, sheets, labor.assemblyMinutes, settings)
  const hardwareEur = hardwareCostEur(hardware)
  const laborEur = laborCostEur(computed, dailyRateEur)
  const skipMats = settings.skipBoardAndEdgeCost
  const chipboard = referenceSheet(sheets, 'chipboard')
  const hardboard = referenceSheet(sheets, 'hardboard')
  const chipboardEur = skipMats
    ? 0
    : usedBoardCostEur(
        panelsAreaM2(panels, 'chipboard'),
        chipboard.width,
        chipboard.height,
        chipboard.priceEur,
        settings.billWholeSheets,
      )
  const hardboardEur = skipMats
    ? 0
    : usedBoardCostEur(
        panelsAreaM2(panels, 'hardboard'),
        hardboard.width,
        hardboard.height,
        hardboard.priceEur,
        settings.billWholeHardboardSheets,
      )
  const edge = panelsEdgeMeters(panels)
  const edgeEur = skipMats
    ? 0
    : edgeBandingCostEur(edge.mm2, edge.mm05, {
        mm2: settings.edgeMm2Eur ?? EDGE_PRICE_MM2_EUR,
        mm05: settings.edgeMm05Eur ?? EDGE_PRICE_MM05_EUR,
      })
  const minutes = laborMinutes(computed) ?? 0
  const materialEur = hardwareEur + chipboardEur + hardboardEur + edgeEur
  return {
    hardwareEur,
    chipboardEur,
    hardboardEur,
    edgeEur,
    materialEur,
    cuttingMinutes: computed.cuttingMinutes ?? 0,
    edgingMinutes: computed.edgingMinutes ?? 0,
    laborMinutes: minutes,
    laborEur,
    totalEur: materialEur + (laborEur ?? 0),
  }
}

export function formatEur(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat('bg-BG', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

export function laborHourRuleBlock(): RuleBlock {
  const day = 100
  return {
    title: 'Час',
    lines: [
      `Часовата ставка е дневната ставка / ${WORK_HOURS_PER_DAY} работни часа. При ${day} € на ден това е ${formatEur(hourlyRateEur(day))} на час.`,
    ],
  }
}

export function formatArea(m2: number): string {
  return `${m2.toFixed(3)} м²`
}
