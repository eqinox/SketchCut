import type { Part, PartEdgeBanding, Sheet } from '@/types'
import { calculateEdgeBandingTotals } from '@/lib/edge-banding'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import { hardwareCostEur } from './hardware'
import {
  CUTTING_MINUTES_PER_SHEET,
  EDGING_MINUTES_PER_SHEET,
  EDGE_PRICE_MM2_EUR,
  EDGE_PRICE_MM05_EUR,
  edgeBandingCostEur,
  referenceSheet,
  sheetFraction,
  usedBoardCostEur,
} from './materials'
import { WORK_HOURS_PER_DAY, type GeneratedPanel, type HardwareItem, type LaborEstimate } from './types'

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
    const kind = p.material === 'hardboard' ? 'hardboard' : 'chipboard'
    if (material && kind !== material) return sum
    return sum + (p.width * p.height * p.quantity) / 1_000_000
  }, 0)
}

export function panelsEdgeMeters(panels: GeneratedPanel[]): { mm2: number; mm05: number } {
  let mm2 = 0
  let mm05 = 0
  for (const p of panels) {
    const widthEdge = p.width * p.quantity
    const heightEdge = p.height * p.quantity
    const add = (len: number, thickness: GeneratedPanel['edges']['thickness']) => {
      if (thickness === 'mm2') mm2 += len
      else mm05 += len
    }
    if (p.edges.top) add(widthEdge, p.edges.thickness)
    if (p.edges.bottom) add(widthEdge, p.edges.thickness)
    if (p.edges.left) add(heightEdge, p.edges.thickness)
    if (p.edges.right) add(heightEdge, p.edges.thickness)
  }
  return { mm2: mm2 / 1000, mm05: mm05 / 1000 }
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
    cuttingMinutes: CUTTING_MINUTES_PER_SHEET * (chipFrac + hardFrac),
    edgingMinutes: EDGING_MINUTES_PER_SHEET * chipFrac,
    assemblyMinutes,
  }
}

export function formatMinutes(value: number): string {
  const rounded = Math.round(value * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
  return `${text} мин`
}

export interface CabinetPrice {
  hardwareEur: number
  chipboardEur: number
  hardboardEur: number
  edgeEur: number
  cuttingMinutes: number
  edgingMinutes: number
  laborMinutes: number
  laborEur: number | null
  totalEur: number
}

export function cabinetPrice(
  hardware: HardwareItem[],
  labor: LaborEstimate,
  dailyRateEur: number,
  panels: GeneratedPanel[],
  sheets: Sheet[],
  settings: HardwareSettings = DEFAULT_HARDWARE_SETTINGS,
): CabinetPrice {
  const computed = laborFromPanels(panels, sheets, labor.assemblyMinutes)
  const hardwareEur = hardwareCostEur(hardware)
  const laborEur = laborCostEur(computed, dailyRateEur)
  const chipboard = referenceSheet(sheets, 'chipboard')
  const hardboard = referenceSheet(sheets, 'hardboard')
  const chipboardEur = usedBoardCostEur(
    panelsAreaM2(panels, 'chipboard'),
    chipboard.width,
    chipboard.height,
    chipboard.priceEur,
  )
  const hardboardEur = usedBoardCostEur(
    panelsAreaM2(panels, 'hardboard'),
    hardboard.width,
    hardboard.height,
    hardboard.priceEur,
  )
  const edge = panelsEdgeMeters(panels)
  const edgeEur = edgeBandingCostEur(edge.mm2, edge.mm05, {
    mm2: settings.edgeMm2Eur ?? EDGE_PRICE_MM2_EUR,
    mm05: settings.edgeMm05Eur ?? EDGE_PRICE_MM05_EUR,
  })
  const minutes = laborMinutes(computed) ?? 0
  return {
    hardwareEur,
    chipboardEur,
    hardboardEur,
    edgeEur,
    cuttingMinutes: computed.cuttingMinutes ?? 0,
    edgingMinutes: computed.edgingMinutes ?? 0,
    laborMinutes: minutes,
    laborEur,
    totalEur: hardwareEur + chipboardEur + hardboardEur + edgeEur + (laborEur ?? 0),
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

export function formatArea(m2: number): string {
  return `${m2.toFixed(3)} м²`
}
