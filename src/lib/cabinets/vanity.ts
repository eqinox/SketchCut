import { confirmatCount, fastenerLine, SCREW_5X60 } from './hardware'
import { DEFAULT_HARDBOARD_THICKNESS, hardboardCutSize } from './materials'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import {
  DEFAULT_NIGHTSTAND_PARAMS,
  generatePlinthCabinet,
  measureNightstand,
  parseNightstandParams,
  type NightstandParams,
} from './nightstand'
import type { RuleBlock } from './rule-text'
import { edges, type CabinetGeneratorResult, type CabinetTypeDefinition, type GeneratedPanel } from './types'
import { formatMm } from '../utils'
import type { InteriorLayout, PartitionSpec } from './zones'

export const VANITY_TYPE_ID = 'vanity'

/** Where the sitting opening is. `none` is a wide nightstand. */
export type VanityKnee = 'none' | 'middle' | 'left' | 'right'
/** One half is a single panel to the floor, without a pedestal. */
export type VanityLegSide = 'none' | 'left' | 'right'

/** Rear fascia in the knee opening, instead of a hardboard back. Usually 250–300 mm. */
export const VANITY_BACK_RAIL_MM = 280

/** Clear width of a pedestal, so a drawer can still be made. */
export const VANITY_MIN_PEDESTAL_MM = 200
/** Clear sitting opening. */
export const VANITY_MIN_KNEE_MM = 280

export interface VanityParams extends NightstandParams {
  knee: VanityKnee
  /** Asked clear width of the opening. The built width is clamped to what fits. */
  kneeWidth: number
  /** When set, that half is one panel (a leg), not a pedestal. */
  legSide: VanityLegSide
  /** Height of the rear fascia across the knee opening. */
  backRailHeight: number
}

export const DEFAULT_VANITY_PARAMS: VanityParams = {
  ...DEFAULT_NIGHTSTAND_PARAMS,
  width: 1300,
  height: 750,
  depth: 450,
  hasBack: true,
  knee: 'middle',
  kneeWidth: 500,
  legSide: 'none',
  backRailHeight: VANITY_BACK_RAIL_MM,
}

export function parseVanityKnee(value: unknown): VanityKnee {
  return value === 'none' || value === 'left' || value === 'right' || value === 'middle' ? value : 'middle'
}

export function parseVanityParams(raw: Record<string, unknown>): VanityParams {
  const base = parseNightstandParams(raw)
  const knee = parseVanityKnee(raw.knee)
  const asked = raw.kneeWidth
  const kneeWidth =
    typeof asked === 'number' && Number.isFinite(asked) && asked > 0
      ? asked
      : DEFAULT_VANITY_PARAMS.kneeWidth
  const rail = raw.backRailHeight
  const backRailHeight =
    typeof rail === 'number' && Number.isFinite(rail) && rail >= 40 && rail <= 600
      ? rail
      : DEFAULT_VANITY_PARAMS.backRailHeight
  const legSide: VanityLegSide = raw.legSide === 'left' || raw.legSide === 'right' ? raw.legSide : 'none'
  return {
    ...base,
    knee,
    kneeWidth,
    legSide: knee === 'none' ? 'none' : legSide,
    backRailHeight,
    useLegs: knee === 'none' ? base.useLegs : false,
  }
}

export interface VanityPedestal {
  /** Outer-left x of the bottom and the plinth. */
  x: number
  /** Clear width between the side and the divider. */
  w: number
  name: string
}

export interface VanityOpening {
  knee: number
  /** Inner-left coordinates of the clear opening. */
  x0: number
  x1: number
  dividers: PartitionSpec[]
  pedestals: VanityPedestal[]
  error: string | null
}

function dividerSpec(offsetMm: number): PartitionSpec {
  return {
    from: 'left',
    fromFace: 'right',
    toFace: 'left',
    offsetMm,
    fromPartition: null,
  }
}

/**
 * Knee geometry. `null` when there is no opening.
 * Bottoms and plinths exist only on the pedestals. Dividers reach the floor.
 */
export function vanityOpening(
  p: Pick<VanityParams, 'width' | 'thickness' | 'knee' | 'kneeWidth'> & { legSide?: VanityLegSide },
): VanityOpening | null {
  if (p.knee === 'none') return null
  const leg = p.legSide ?? 'none'
  const kneeMode: VanityKnee = leg === 'left' ? 'left' : leg === 'right' ? 'right' : p.knee
  const T = p.thickness
  const innerW = p.width - 2 * T
  const dividerCount = kneeMode === 'middle' ? 2 : 1
  const pedestalCount = kneeMode === 'middle' ? 2 : 1
  const maxKnee = innerW - dividerCount * T - pedestalCount * VANITY_MIN_PEDESTAL_MM
  if (!(maxKnee >= VANITY_MIN_KNEE_MM)) {
    return {
      knee: 0,
      x0: 0,
      x1: 0,
      dividers: [],
      pedestals: [],
      error: 'Ширината не стига за отвор за краката и шкафче отстрани.',
    }
  }
  const knee = Math.round(Math.min(Math.max(p.kneeWidth, VANITY_MIN_KNEE_MM), maxKnee))
  if (kneeMode === 'left') {
    const pedW = innerW - knee - T
    return {
      knee,
      x0: 0,
      x1: knee,
      dividers: [dividerSpec(knee)],
      pedestals: [{ x: T + knee + T, w: pedW, name: 'дясно шкафче' }],
      error: null,
    }
  }
  if (kneeMode === 'right') {
    const pedW = innerW - knee - T
    return {
      knee,
      x0: pedW + T,
      x1: innerW,
      dividers: [dividerSpec(pedW)],
      pedestals: [{ x: T, w: pedW, name: 'ляво шкафче' }],
      error: null,
    }
  }
  const rest = innerW - knee - 2 * T
  const leftW = Math.floor(rest / 2)
  const rightW = rest - leftW
  return {
    knee,
    x0: leftW + T,
    x1: leftW + T + knee,
    dividers: [dividerSpec(leftW), dividerSpec(leftW + T + knee)],
    pedestals: [
      { x: T, w: leftW, name: 'ляво шкафче' },
      { x: T + leftW + T + knee + T, w: rightW, name: 'дясно шкафче' },
    ],
    error: null,
  }
}

/** Knee pages replace other full-height pages. A page inside one side is kept. */
export function mergeKneePartitions(
  existing: PartitionSpec[] | undefined,
  dividers: PartitionSpec[],
): PartitionSpec[] {
  const kept = (existing ?? []).filter(
    (spec) =>
      spec.stopsAtShelf != null ||
      spec.startsAtShelf != null ||
      (spec.splitsPath != null && spec.splitsPath !== ''),
  )
  return [...dividers, ...kept]
}

function groupedPanels(
  spans: { w: number; name: string; key?: string }[],
  make: (width: number, quantity: number, names: string) => GeneratedPanel,
): GeneratedPanel[] {
  const groups = new Map<number, { quantity: number; names: string[]; keys: string[] }>()
  for (const span of spans) {
    const row = groups.get(span.w) ?? { quantity: 0, names: [], keys: [] }
    row.quantity += 1
    if (!row.names.includes(span.name)) row.names.push(span.name)
    if (span.key) row.keys.push(span.key)
    groups.set(span.w, row)
  }
  return [...groups.entries()].map(([width, row]) => {
    const panel = make(width, row.quantity, row.names.join(' и '))
    return row.keys.length > 0 ? { ...panel, pieceKeys: row.keys } : panel
  })
}

export function vanityKneeError(p: VanityParams, layout: InteriorLayout): string | null {
  const opening = vanityOpening(p)
  if (!opening) return null
  if (opening.error) return opening.error
  if (p.doorSpan !== 'zones' && p.doorCount > 0) {
    return 'Врата на целия шкаф покрива отвора за краката. Сложи я на шкафчето или в отвора.'
  }
  void layout
  return null
}

/** Hardboard only behind a pedestal. The knee opening has the fascia instead. */
export function vanityBackSpans(
  p: Pick<VanityParams, 'width' | 'thickness'>,
  opening: VanityOpening,
): { x: number; w: number }[] {
  const T = p.thickness
  const rightInner = p.width - T
  return opening.pedestals.map((pedestal) => {
    const atLeft = Math.abs(pedestal.x - T) < 1
    const atRight = Math.abs(pedestal.x + pedestal.w - rightInner) < 1
    if (atLeft && !atRight) return { x: pedestal.x, w: pedestal.w + T }
    if (atRight && !atLeft) return { x: pedestal.x - T, w: pedestal.w + T }
    return { x: pedestal.x, w: pedestal.w }
  })
}

function kneeWhere(knee: VanityKnee): string {
  if (knee === 'left') return 'отляво'
  if (knee === 'right') return 'отдясно'
  return 'по средата'
}

export function generateVanity(raw: Record<string, unknown>, settings?: unknown): CabinetGeneratorResult {
  const parsed = parseVanityParams(raw)
  const opening = vanityOpening(parsed)
  if (!opening) {
    return generatePlinthCabinet(raw, settings, { topInner: false, label: 'Тоалетка' })
  }
  if (opening.error) {
    const built = generatePlinthCabinet({ ...raw, useLegs: false }, settings, {
      topInner: false,
      label: 'Тоалетка',
    })
    return { ...built, notes: [opening.error, ...built.notes] }
  }
  const partitions = mergeKneePartitions(parsed.partitions, opening.dividers)
  const built = generatePlinthCabinet(
    { ...parsed, useLegs: false, partitions, knee: parsed.knee, kneeWidth: opening.knee } as Record<string, unknown>,
    settings,
    { topInner: false, label: 'Тоалетка' },
  )
  const measured = measureNightstand({ ...parsed, useLegs: false }, false)
  const oldBottom = built.panels.find((panel) => panel.role === 'bottom')
  const oldPlinth = built.panels.find((panel) => panel.role === 'plinth')
  const bottoms = groupedPanels(
    opening.pedestals.map((pedestal) => ({
      w: pedestal.w,
      name: pedestal.name,
      key: `bottom-${Math.round(pedestal.x)}`,
    })),
    (width, quantity, names) => ({
    role: 'bottom',
    name: 'Дъно',
    width,
    height: measured.bottomD,
    quantity,
    canRotate: false,
    edges: oldBottom?.edges ?? edges({ top: true }, 'mm05'),
    note: `Кант 0.5 мм: предна. Влиза между страницата и разделителя (${formatMm(width)} мм). ${names}.`,
  }))
  const plinths = groupedPanels(
    opening.pedestals.flatMap((pedestal) =>
      Array.from({ length: parsed.plinthCount }, () => ({
        w: pedestal.w,
        name: pedestal.name,
        key: `plinth-${Math.round(pedestal.x)}`,
      })),
    ),
    (width, quantity, names) => ({
    role: 'plinth',
    name: 'Цокъл',
    width,
    height: parsed.plinthHeight,
    quantity,
    canRotate: false,
    edges: oldPlinth?.edges ?? edges({ bottom: true }, 'mm2'),
    note: `Кант 2 мм: само долната дълга страна. ${formatMm(width)} мм, само под ${names}.`,
  }))
  const railH = Math.min(parsed.backRailHeight, Math.max(40, measured.innerH - 40))
  const fasciaScrews = confirmatCount(railH) * 2
  const hardwareSettings =
    (settings as { hardware?: { screw5x60_500PackEur?: number } } | undefined)?.hardware ??
    DEFAULT_HARDWARE_SETTINGS
  const backHeight = hardboardCutSize(parsed.width, parsed.height, parsed.plinthHeight).height
  const backs = parsed.hasBack
    ? groupedPanels(
        opening.pedestals.map((pedestal) => ({ w: pedestal.w + 2 * parsed.thickness, name: pedestal.name })),
        (width, quantity, names) => ({
          role: 'back' as const,
          name: 'Фазер',
          width,
          height: backHeight,
          quantity,
          canRotate: true,
          edges: edges({}),
          material: 'hardboard' as const,
          note: `Фазер ${DEFAULT_HARDBOARD_THICKNESS} мм. Без кант. Само зад ${names}. Отворът е с бленда, без фазер.`,
        }),
      )
    : []
  const fascia: GeneratedPanel = {
    role: 'rail',
    name: 'Бленда',
    width: opening.knee,
    height: railH,
    quantity: 1,
    canRotate: false,
    edges: edges({ bottom: true }, 'mm05'),
    note: `Кант 0.5 мм: долна. Отзад на отвора, от лявата част до дясната, ${formatMm(opening.knee)} × ${formatMm(railH)} мм. Вместо гръб.`,
    pieceKeys: ['fascia-knee'],
  }
  const panels = built.panels
    .filter((panel) => panel.role !== 'back')
    .flatMap((panel) => {
      if (panel.role === 'bottom') return bottoms
      if (panel.role === 'plinth') return plinths
      return [panel]
    })
    .concat(backs, fascia)
    .map((panel) => {
    if (panel.name !== 'Разделителна страница') return panel
    if (!panel.note?.includes('Сяда на дъното като вътрешна страница')) return panel
    return {
      ...panel,
      height: measured.sideH,
      edges: edges({ left: true, bottom: true }, 'mm05'),
      note: 'Кант 0.5 мм: предна и долна. Стига до пода. Дъното на шкафчето влиза в нея.',
    }
  })
  const bottomScrews = opening.pedestals.length * 2 * confirmatCount(measured.bottomD)
  let plinthScrews = 0
  for (const pedestal of opening.pedestals) {
    plinthScrews += confirmatCount(pedestal.w) * parsed.plinthCount
  }
  const hardware = built.hardware.map((item) => {
    if (item.note?.startsWith('Дъно')) return { ...item, quantity: bottomScrews }
    if (item.note?.startsWith('Цокъл')) {
      return { ...item, quantity: plinthScrews, note: 'Цокъл — винтове през дъното на шкафчето' }
    }
    return item
  })
  hardware.push(
    fastenerLine(
      { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur ?? SCREW_5X60.packPriceEur },
      fasciaScrews,
      'Бленда — винтове в двата края',
    ),
  )
  const kept = built.notes.filter((note) => {
    if (/сяда на дъното|сядат на дъното/.test(note)) return false
    if (/външни на дъното/.test(note)) return false
    if (/^Цокъл с канта/.test(note)) return false
    if (/^Дъното е на/.test(note)) return false
    if (/цокъл/.test(note) && /навътре/.test(note)) return false
    if (/^Сглобяване:/.test(note)) return false
    if (/Плотът се хваща отвътре с/.test(note)) return false
    if (note.startsWith('Фазер')) return false
    return true
  })
  const pedText = opening.pedestals.map((pedestal) => `${pedestal.name} ${formatMm(pedestal.w)} мм`).join(', ')
  const brackets = 4 + 2 * opening.dividers.length
  const notes = [
    kept[0] ?? `Тоалетка ${parsed.width} × ${parsed.height} × ${parsed.depth} мм.`,
    `Отвор за краката ${formatMm(opening.knee)} мм ${kneeWhere(parsed.legSide === 'left' ? 'left' : parsed.legSide === 'right' ? 'right' : parsed.knee)}. ${pedText}. Под отвора няма дъно и няма цокъл.`,
    parsed.legSide === 'left'
      ? 'Лявата половина е една плоскост — крак до пода, без дъно, без цокъл и без гръб.'
      : parsed.legSide === 'right'
        ? 'Дясната половина е една плоскост — крак до пода, без дъно, без цокъл и без гръб.'
        : 'Двете половини са шкафчета с дъно, цокъл и фазер.',
    `Отзад на отвора има бленда ${formatMm(opening.knee)} × ${formatMm(railH)} мм, от лявата част до дясната. Там няма фазер.`,
    `Разделителите са ${formatMm(measured.sideH)} мм и стигат до пода. Дъното на шкафчето влиза между страницата и разделителя.`,
    'Плотът минава над целия отвор. Чекмедже може и в отвора. Огледалото не се реже от плочата.',
    `Сглобяване: цокъл към дъното на всяко шкафче, после дъното между страницата и разделителя. Плотът се хваща с ${brackets} ъгълчета.`,
    ...kept.slice(1),
  ]
  const steps = (built.labor.assemblySteps ?? []).map((step) => {
    if (step.id !== 'plinth' || opening.pedestals.length <= 1) return step
    const was = step.quantity ?? 1
    const quantity = was * opening.pedestals.length
    return {
      ...step,
      quantity,
      minutes: (step.minutes / was) * quantity,
      label: 'Слагане на цокли към дъната на шкафчетата',
    }
  })
  const plinthBefore = (built.labor.assemblySteps ?? []).find((step) => step.id === 'plinth')
  const plinthAfter = steps.find((step) => step.id === 'plinth')
  const extra = (plinthAfter?.minutes ?? 0) - (plinthBefore?.minutes ?? 0)
  return {
    ...built,
    panels,
    hardware,
    notes,
    labor: {
      ...built.labor,
      assemblyMinutes: (built.labor.assemblyMinutes ?? 0) + extra,
      assemblySteps: steps,
    },
  }
}

export function vanityRuleBlock(): RuleBlock {
  const sample = DEFAULT_VANITY_PARAMS
  const opening = vanityOpening(sample)
  const pedText = opening?.pedestals.map((pedestal) => formatMm(pedestal.w)).join(' и ') ?? ''
  return {
    title: 'Тоалетка',
    lines: [
      `По подразбиране ${sample.width} × ${sample.height} × ${sample.depth} мм. Плотът е външен и ляга върху страниците.`,
      `Отвор за краката ${formatMm(opening?.knee ?? sample.kneeWidth)} мм по средата. Шкафчетата са ${pedText} мм.`,
      'Под отвора няма дъно и цокъл. Отзад там има бленда, висока около 250–300 мм, широка колкото отвора. Фазер имат само шкафчетата.',
      'Лявата или дясната половина може да е една плоскост-крак, без дъно, цокъл и гръб.',
      'Чекмедже може и в отвора. Огледалото не се реже от плочата.',
    ],
  }
}

export const vanityType: CabinetTypeDefinition = {
  id: VANITY_TYPE_ID,
  name: 'Тоалетка',
  category: 'other',
  description:
    'Седяща маса с отвор за краката. Шкафчетата са с дъно, цокъл и фазер, отзад на отвора има бленда. Чекмедже може и в отвора. Едната половина може да е само крак. Огледалото не влиза в разкроя.',
  defaultParams: { ...DEFAULT_VANITY_PARAMS },
  generate: generateVanity,
}
