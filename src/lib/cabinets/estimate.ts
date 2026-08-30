import type { Part, PartEdgeBanding } from '@/types'
import { calculateEdgeBandingTotals } from '@/lib/edge-banding'
import { WORK_HOURS_PER_DAY, type GeneratedPanel, type LaborEstimate } from './types'

export interface MaterialEstimate {
  areaM2: number
  edgeMm2: number
  edgeMm05: number
  partCount: number
}

export function panelsAreaM2(panels: GeneratedPanel[]): number {
  return panels.reduce((sum, p) => sum + (p.width * p.height * p.quantity) / 1_000_000, 0)
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

export function estimateFromPanels(panels: GeneratedPanel[]): MaterialEstimate {
  const edge = panelsEdgeMeters(panels)
  return {
    areaM2: panelsAreaM2(panels),
    edgeMm2: edge.mm2,
    edgeMm05: edge.mm05,
    partCount: panels.reduce((s, p) => s + p.quantity, 0),
  }
}

export function estimateFromParts(parts: Part[], edgeBanding: PartEdgeBanding[]): MaterialEstimate {
  const totals = calculateEdgeBandingTotals(parts, edgeBanding)
  return {
    areaM2: parts.reduce((s, p) => s + (p.width * p.height * p.quantity) / 1_000_000, 0),
    edgeMm2: totals.mm2,
    edgeMm05: totals.mm05,
    partCount: parts.reduce((s, p) => s + p.quantity, 0),
  }
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
  return (minutes / 60) * hourlyRateEur(dailyRateEur)
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat('bg-BG', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatArea(m2: number): string {
  return `${m2.toFixed(3)} м²`
}
