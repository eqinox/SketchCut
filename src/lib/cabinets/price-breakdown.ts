import type { Sheet } from '@/types'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import {
  CUTTING_MINUTES_PER_SHEET,
  EDGING_MINUTES_PER_SHEET,
  EDGE_PRICE_MM2_EUR,
  EDGE_PRICE_MM05_EUR,
  edgeBandingCostEur,
  referenceSheet,
  sheetAreaM2,
  sheetFraction,
  usedBoardCostEur,
} from './materials'
import {
  FASTENERS,
  SCREW_4X16,
  SCREW_4X20,
  SCREW_35X16,
  SCREW_5X60,
} from './hardware'
import type { AssemblyStep } from '@/lib/assembly-time'
import { describeAssemblyCalc } from '@/lib/assembly-time'
import { WORK_HOURS_PER_DAY, type GeneratedPanel, type HardwareItem } from './types'
import {
  formatArea,
  formatEur,
  formatMinutes,
  hourlyRateEur,
  laborCostEur,
  laborFromPanels,
  laborMinutes,
  panelsAreaM2,
} from './estimate'

export interface PriceBreakdownLine {
  label: string
  hint?: string
  amountEur: number | null
}

export interface PriceBreakdownSection {
  id: string
  title: string
  intro?: string
  lines: PriceBreakdownLine[]
  subtotalEur: number | null
}

export interface PriceBreakdown {
  sections: PriceBreakdownSection[]
  totalEur: number
}

function panelAreaM2(panel: GeneratedPanel): number {
  return (panel.width * panel.height * panel.quantity) / 1_000_000
}

function panelKind(panel: GeneratedPanel): 'chipboard' | 'hardboard' {
  return panel.material === 'hardboard' ? 'hardboard' : 'chipboard'
}

function billablePanels(panels: GeneratedPanel[]): GeneratedPanel[] {
  return panels.filter((p) => !p.excludeFromCutting)
}

function mmSize(width: number, height: number): string {
  return `${Math.round(width)} × ${Math.round(height)} мм`
}

function formatM(meters: number): string {
  return `${meters.toFixed(2).replace('.', ',')} м`
}

function formatPct(fraction: number): string {
  return `${(fraction * 100).toFixed(1).replace('.', ',')}%`
}

const EDGE_SIDE_LABEL = {
  top: 'горен ръб (по широчина)',
  bottom: 'долен ръб (по широчина)',
  left: 'ляв ръб (по височина)',
  right: 'десен ръб (по височина)',
} as const

function fastenerPackHint(id: string | undefined, settings: HardwareSettings): string | undefined {
  if (!id) return undefined
  if (id === SCREW_5X60.id) {
    const pack = settings.screw5x60_500PackEur
    const unit = pack / SCREW_5X60.packQty
    return `кутия ${SCREW_5X60.packQty} бр. = ${formatEur(pack)} → ${formatEur(unit, 3)}/бр.`
  }
  if (id === SCREW_4X16.id || id === SCREW_4X20.id || id === SCREW_35X16.id) {
    const pack = settings.smallScrew1000PackEur
    const unit = pack / (FASTENERS[id as keyof typeof FASTENERS]?.packQty ?? 1000)
    return `кутия 1000 бр. = ${formatEur(pack)} → ${formatEur(unit, 4)}/бр.`
  }
  return undefined
}

function boardSection(
  id: 'chipboard' | 'hardboard',
  title: string,
  panels: GeneratedPanel[],
  sheet: Sheet,
): PriceBreakdownSection {
  const used = panelsAreaM2(panels, id)
  const full = sheetAreaM2(sheet.width, sheet.height)
  const frac = sheetFraction(used, sheet.width, sheet.height)
  const cost = usedBoardCostEur(used, sheet.width, sheet.height, sheet.priceEur)
  const lines: PriceBreakdownLine[] = billablePanels(panels)
    .filter((p) => panelKind(p) === id)
    .map((p) => {
      const area = panelAreaM2(p)
      const partCost = usedBoardCostEur(area, sheet.width, sheet.height, sheet.priceEur)
      return {
        label: `${p.name} · ${p.quantity} бр. · ${mmSize(p.width, p.height)}`,
        hint: `${formatArea(area)}${p.note ? ` · ${p.note}` : ''}`,
        amountEur: sheet.priceEur > 0 ? partCost : 0,
      }
    })
  if (lines.length === 0) {
    return { id, title, lines: [{ label: 'Няма детайли', amountEur: 0 }], subtotalEur: 0 }
  }
  lines.push({
    label: `Плоча ${mmSize(sheet.width, sheet.height)} · ${formatEur(sheet.priceEur)}`,
    hint:
      sheet.priceEur > 0
        ? `използвано ${formatArea(used)} от ${formatArea(full)} (${formatPct(frac)})`
        : 'плочата няма зададена цена — материалът не влиза в сметката',
    amountEur: cost,
  })
  return {
    id,
    title,
    intro: `Цената е дял от една плоча (${mmSize(sheet.width, sheet.height)} = ${formatArea(full)} на ${formatEur(sheet.priceEur)}).`,
    lines,
    subtotalEur: cost,
  }
}

function edgeSection(panels: GeneratedPanel[], settings: HardwareSettings): PriceBreakdownSection {
  const mm2Price = settings.edgeMm2Eur ?? EDGE_PRICE_MM2_EUR
  const mm05Price = settings.edgeMm05Eur ?? EDGE_PRICE_MM05_EUR
  const lines: PriceBreakdownLine[] = []
  let mm2 = 0
  let mm05 = 0
  for (const p of billablePanels(panels)) {
    const parts: string[] = []
    const add = (side: keyof typeof EDGE_SIDE_LABEL, lenMm: number) => {
      if (!p.edges[side]) return
      const meters = (lenMm * p.quantity) / 1000
      if (p.edges.thickness === 'mm2') mm2 += meters
      else mm05 += meters
      parts.push(`${EDGE_SIDE_LABEL[side]} ${formatM(meters)}`)
    }
    add('top', p.width)
    add('bottom', p.width)
    add('left', p.height)
    add('right', p.height)
    if (parts.length === 0) continue
    const thick = p.edges.thickness === 'mm2' ? '2 мм' : '0.5 мм'
    const panelMeters =
      (p.edges.top ? p.width : 0) +
      (p.edges.bottom ? p.width : 0) +
      (p.edges.left ? p.height : 0) +
      (p.edges.right ? p.height : 0)
    const totalM = (panelMeters * p.quantity) / 1000
    const unit = p.edges.thickness === 'mm2' ? mm2Price : mm05Price
    lines.push({
      label: `${p.name} · кант ${thick} · ${p.quantity} бр.`,
      hint: `${parts.join(', ')} = ${formatM(totalM)} × ${formatEur(unit, 2)}/м`,
      amountEur: totalM * unit,
    })
  }
  const cost = edgeBandingCostEur(mm2, mm05, { mm2: mm2Price, mm05: mm05Price })
  if (mm2 > 0) {
    lines.push({
      label: `Общо кант 2 мм: ${formatM(mm2)} × ${formatEur(mm2Price, 2)}/м`,
      amountEur: mm2 * mm2Price,
    })
  }
  if (mm05 > 0) {
    lines.push({
      label: `Общо кант 0.5 мм: ${formatM(mm05)} × ${formatEur(mm05Price, 2)}/м`,
      amountEur: mm05 * mm05Price,
    })
  }
  if (lines.length === 0) {
    return { id: 'edge', title: 'Кант', lines: [], subtotalEur: 0 }
  }
  return {
    id: 'edge',
    title: 'Кант',
    intro: `Дебел кант (2 мм) ${formatEur(mm2Price, 2)}/м · обикновен (0.5 мм) ${formatEur(mm05Price, 2)}/м.`,
    lines,
    subtotalEur: cost,
  }
}

function hardwareSection(hardware: HardwareItem[], settings: HardwareSettings): PriceBreakdownSection {
  const lines: PriceBreakdownLine[] = hardware.map((h) => {
    const pack = fastenerPackHint(h.id, settings)
    const unit = h.unitPriceEur
    const total = unit != null ? unit * h.quantity : null
    const unitHint = unit != null ? `${h.quantity} бр. × ${formatEur(unit, unit < 0.1 ? 3 : 2)}` : `${h.quantity} бр. · няма зададена цена`
    return {
      label: h.name,
      hint: [h.note, pack, unitHint].filter(Boolean).join(' · '),
      amountEur: total,
    }
  })
  const subtotal = hardware.reduce((s, h) => s + (h.unitPriceEur ?? 0) * h.quantity, 0)
  if (lines.length === 0) {
    return { id: 'hardware', title: 'Фурнитура', lines: [{ label: 'Няма фурнитура', amountEur: 0 }], subtotalEur: 0 }
  }
  return {
    id: 'hardware',
    title: 'Фурнитура',
    intro: 'Всяка позиция е количество × цена за брой. Винтовете се смятат от цената на кутията.',
    lines,
    subtotalEur: subtotal,
  }
}

function minutesCostEur(minutes: number, hourly: number): number | null {
  if (!(hourly > 0)) return null
  if (!(minutes > 0)) return 0
  return (minutes / 60) * hourly
}

function mergeAssemblySteps(groups: AssemblyStep[][]): AssemblyStep[] {
  const order: string[] = []
  const map = new Map<string, AssemblyStep>()
  for (const step of groups.flat()) {
    const prev = map.get(step.id)
    if (!prev) {
      order.push(step.id)
      map.set(step.id, { ...step })
      continue
    }
    map.set(step.id, {
      ...prev,
      minutes: Math.round((prev.minutes + step.minutes) * 10) / 10,
      quantity: (prev.quantity ?? 1) + (step.quantity ?? 1),
    })
  }
  return order.map((id) => map.get(id)!)
}

function laborSection(
  panels: GeneratedPanel[],
  sheets: Sheet[],
  assemblyMinutes: number | null,
  assemblySteps: AssemblyStep[],
  dailyRateEur: number,
): PriceBreakdownSection {
  const computed = laborFromPanels(panels, sheets, assemblyMinutes)
  const chipboard = referenceSheet(sheets, 'chipboard')
  const hardboard = referenceSheet(sheets, 'hardboard')
  const chipArea = panelsAreaM2(panels, 'chipboard')
  const hardArea = panelsAreaM2(panels, 'hardboard')
  const chipFrac = sheetFraction(chipArea, chipboard.width, chipboard.height)
  const hardFrac = sheetFraction(hardArea, hardboard.width, hardboard.height)
  const hourly = hourlyRateEur(dailyRateEur)
  const minutes = laborMinutes(computed)
  const cost = laborCostEur(computed, dailyRateEur)
  const cutMin = computed.cuttingMinutes ?? 0
  const edgeMin = computed.edgingMinutes ?? 0
  const chipCut = chipFrac * CUTTING_MINUTES_PER_SHEET
  const hardCut = hardFrac * CUTTING_MINUTES_PER_SHEET
  const chipEdge = chipFrac * EDGING_MINUTES_PER_SHEET
  const lines: PriceBreakdownLine[] = [
    {
      label: 'Рязане',
      hint:
        `${formatPct(chipFrac)} × ${CUTTING_MINUTES_PER_SHEET} мин (ПДЧ) = ${formatMinutes(chipCut)}` +
        ` + ${formatPct(hardFrac)} × ${CUTTING_MINUTES_PER_SHEET} мин (фазер) = ${formatMinutes(hardCut)}` +
        ` → ${formatMinutes(cutMin)}`,
      amountEur: minutesCostEur(cutMin, hourly),
    },
    {
      label: 'Кантиране на машина',
      hint:
        `${formatPct(chipFrac)} ПДЧ × ${EDGING_MINUTES_PER_SHEET} мин/плоча = ${formatMinutes(chipEdge)}` +
        ` (фазерът не се кантира) → ${formatMinutes(edgeMin)}`,
      amountEur: minutesCostEur(edgeMin, hourly),
    },
  ]

  if (assemblySteps.length > 0) {
    for (const step of assemblySteps) {
      lines.push({
        label: step.label,
        hint: describeAssemblyCalc(step),
        amountEur: minutesCostEur(step.minutes, hourly),
      })
    }
    lines.push({
      label: 'Общо сглобяване',
      hint:
        assemblyMinutes != null
          ? `сбор на операциите по-горе = ${formatMinutes(assemblyMinutes)}`
          : 'няма зададено време за сглобяване',
      amountEur: null,
    })
  } else {
    lines.push({
      label: 'Сглобяване',
      hint:
        assemblyMinutes != null && assemblyMinutes > 0
          ? formatMinutes(assemblyMinutes)
          : 'няма зададено време за сглобяване',
      amountEur: minutesCostEur(assemblyMinutes ?? 0, hourly),
    })
  }

  lines.push({
    label: 'Общо труд',
    hint:
      hourly > 0
        ? `${formatEur(dailyRateEur)}/ден ÷ ${WORK_HOURS_PER_DAY} ч = ${formatEur(hourly)}/ч · ${minutes != null ? formatMinutes(minutes) : '0 мин'} ÷ 60 × ${formatEur(hourly)}/ч = ${cost != null ? formatEur(cost) : '—'}`
        : 'задай ставка €/ден в панела Шкафове, за да влезе трудът в цената',
    amountEur: cost,
  })

  return {
    id: 'labor',
    title: 'Труд',
    intro:
      'Рязането и машинното кантиране са дял от една плоча. Сглобяването е по операциите от настройките (Настройки → време).',
    lines,
    subtotalEur: cost,
  }
}

export function explainCabinetPrice(input: {
  panels: GeneratedPanel[]
  hardware: HardwareItem[]
  assemblyMinutes: number | null
  assemblySteps?: AssemblyStep[]
  dailyRateEur: number
  sheets: Sheet[]
  settings?: HardwareSettings
}): PriceBreakdown {
  const settings = input.settings ?? DEFAULT_HARDWARE_SETTINGS
  const chipboard = referenceSheet(input.sheets, 'chipboard')
  const hardboard = referenceSheet(input.sheets, 'hardboard')
  const billed = billablePanels(input.panels)
  const sections: PriceBreakdownSection[] = []
  if (billed.some((p) => panelKind(p) === 'chipboard')) {
    sections.push(boardSection('chipboard', 'ПДЧ', input.panels, chipboard))
  }
  if (billed.some((p) => panelKind(p) === 'hardboard')) {
    sections.push(boardSection('hardboard', 'Фазер', input.panels, hardboard))
  }
  const edge = edgeSection(input.panels, settings)
  if (edge.lines.length > 1 || (edge.subtotalEur ?? 0) > 0) {
    sections.push(edge)
  }
  if (input.hardware.length > 0) {
    sections.push(hardwareSection(input.hardware, settings))
  }
  sections.push(
    laborSection(
      input.panels,
      input.sheets,
      input.assemblyMinutes,
      input.assemblySteps ?? [],
      input.dailyRateEur,
    ),
  )
  const totalEur = sections.reduce((s, sec) => s + (sec.subtotalEur ?? 0), 0)
  return { sections, totalEur }
}

export function explainCabinetsPrice(
  rows: Array<{
    label: string
    panels: GeneratedPanel[]
    hardware: HardwareItem[]
    assemblyMinutes: number | null
    assemblySteps?: AssemblyStep[]
  }>,
  dailyRateEur: number,
  sheets: Sheet[],
  settings?: HardwareSettings,
): PriceBreakdown {
  const hw = settings ?? DEFAULT_HARDWARE_SETTINGS
  const each = rows.map((row) => ({
    label: row.label,
    explained: explainCabinetPrice({ ...row, dailyRateEur, sheets, settings: hw }),
  }))
  const merged = explainCabinetPrice({
    panels: rows.flatMap((r) => r.panels),
    hardware: rows.flatMap((r) => r.hardware),
    assemblyMinutes: rows.reduce((s, r) => s + (r.assemblyMinutes ?? 0), 0),
    assemblySteps: mergeAssemblySteps(rows.map((r) => r.assemblySteps ?? [])),
    dailyRateEur,
    sheets,
    settings: hw,
  })
  return {
    sections: [
      {
        id: 'cabinets',
        title: 'По шкафове',
        intro: 'Крайната цена е сборът на всички шкафове по-долу, разбит по материали, кант, фурнитура и труд.',
        lines: each.map((row) => ({
          label: row.label,
          amountEur: row.explained.totalEur,
        })),
        subtotalEur: each.reduce((s, row) => s + row.explained.totalEur, 0),
      },
      ...merged.sections,
    ],
    totalEur: merged.totalEur,
  }
}
