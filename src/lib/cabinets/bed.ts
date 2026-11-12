import { parsePartColors, DEFAULT_PART_COLORS, type CabinetPartColors } from './colors'
import { confirmatCount, fastenerLine, pricedLine, SCREW_4X16, SCREW_5X60 } from './hardware'
import { SCREWS_PER_CORNER_BRACKET } from './nightstand'
import { DEFAULT_HARDWARE_SETTINGS, type HardwareSettings } from '@/lib/settings'
import { formatMm } from '../utils'
import type { RuleBlock } from './rule-text'
import {
  edges,
  emptyLabor,
  type CabinetGeneratorResult,
  type CabinetTypeDefinition,
  type EdgeSideName,
  type EdgeThickness,
  type GeneratedPanel,
  type JoineryConfig,
  type PanelEdgePlan,
} from './types'

export const BED_TYPE_ID = 'bed'

/** Overall bed is the mattress plus this much, on both length and width. */
export const BED_MATTRESS_ALLOWANCE_MM = 50
/** Inner sides stop this far below the outer sides so the slat frame can sit. */
export const BED_INNER_DROP_MM = 150
/** Bought slat frame thickness. */
export const BED_FRAME_HEIGHT_MM = 20
/** Lift-mechanism plates, measured from the top panel along the side. */
export const BED_LIFT_PANEL_MM = 700
export const BED_HEADBOARD_HEIGHT_MM = 800
/** Corner brackets on one support panel. Two panels make eight. */
export const BED_BRACKETS_PER_SUPPORT = 4

const CORNER_BRACKET = {
  id: 'corner-bracket',
  name: 'Ъгълче',
  unitPriceEur: 0.05,
}

export const BED_JOINERY: JoineryConfig = {
  bottomSides: 'bottom-covers-sides',
  topSides: 'rails-between-sides',
  depth: 'bottom-covers-sides',
}

export interface BedParams {
  mattressLength: number
  mattressWidth: number
  sideHeight: number
  thickness: number
  liftMechanism: boolean
  headboard: boolean
  headboardHeight: number
  /** Outer width, mattress width + 50. Kept so the room and the badge use the real bed. */
  width: number
  /** Outer length, mattress length + 50. */
  depth: number
  /** Standing height: the headboard when there is one, otherwise the sides, plus the bottom. */
  height: number
  colors: CabinetPartColors
}

export interface BedMeasure {
  width: number
  length: number
  sideHeight: number
  thickness: number
  sideLength: number
  topWidth: number
  innerHeight: number
  supportWidth: number
  liftLength: number
  headboardHeight: number
  standingHeight: number
}

export const DEFAULT_BED_PARAMS: BedParams = {
  mattressLength: 2000,
  mattressWidth: 1600,
  sideHeight: 400,
  thickness: 18,
  liftMechanism: false,
  headboard: false,
  headboardHeight: BED_HEADBOARD_HEIGHT_MM,
  width: 1650,
  depth: 2050,
  height: 418,
  colors: { ...DEFAULT_PART_COLORS },
}

function band(
  sides: Partial<Pick<PanelEdgePlan, 'top' | 'bottom' | 'left' | 'right'>>,
  thickness: EdgeThickness,
  sideThickness?: Partial<Record<EdgeSideName, EdgeThickness>>,
): PanelEdgePlan {
  return {
    ...edges(sides, thickness),
    ...(sideThickness ? { sideThickness } : {}),
  }
}

function hardwareOf(settings?: unknown): HardwareSettings {
  const hardware = (settings as { hardware?: HardwareSettings } | undefined)?.hardware
  return hardware ?? DEFAULT_HARDWARE_SETTINGS
}

export function measureBed(p: Pick<BedParams, 'mattressLength' | 'mattressWidth' | 'sideHeight' | 'thickness' | 'headboard' | 'headboardHeight'>): BedMeasure {
  const thickness = p.thickness
  const width = p.mattressWidth + BED_MATTRESS_ALLOWANCE_MM
  const length = p.mattressLength + BED_MATTRESS_ALLOWANCE_MM
  const sideLength = length - 2 * thickness
  const topWidth = width - 2 * thickness
  const innerHeight = p.sideHeight - BED_INNER_DROP_MM
  const supportWidth = (topWidth - 3 * thickness) / 2
  const headboardHeight = p.headboardHeight
  const standing = Math.max(p.sideHeight, p.headboard ? headboardHeight : 0) + thickness
  return {
    width,
    length,
    sideHeight: p.sideHeight,
    thickness,
    sideLength,
    topWidth,
    innerHeight,
    supportWidth,
    liftLength: Math.min(BED_LIFT_PANEL_MM, Math.max(0, sideLength)),
    headboardHeight,
    standingHeight: standing,
  }
}

export function bedError(p: BedParams): string | null {
  const m = measureBed(p)
  if (!(p.mattressLength >= 800) || !(p.mattressWidth >= 600)) {
    return 'Матракът трябва да е поне 800 × 600 мм.'
  }
  if (m.innerHeight < 40) {
    return `Страниците трябва да са поне ${BED_INNER_DROP_MM + 40} мм високи, за да остане вътрешна страница.`
  }
  if (m.supportWidth < 80) {
    return 'Широчината не стига за двете плоскости под рамката.'
  }
  if (m.sideLength < 400) {
    return 'Дължината не стига за страниците.'
  }
  return null
}

export function parseBedParams(raw: Record<string, unknown>): BedParams {
  const d = DEFAULT_BED_PARAMS
  const num = (key: string, fallback: number) => {
    const v = raw[key]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
  }
  const mattressLength = num('mattressLength', d.mattressLength)
  const mattressWidth = num('mattressWidth', d.mattressWidth)
  const sideHeight = num('sideHeight', d.sideHeight)
  const thickness = num('thickness', d.thickness)
  const headboard = raw.headboard === true
  const liftMechanism = raw.liftMechanism === true
  const headboardHeight = num('headboardHeight', d.headboardHeight)
  const measured = measureBed({
    mattressLength,
    mattressWidth,
    sideHeight,
    thickness,
    headboard,
    headboardHeight,
  })
  return {
    mattressLength,
    mattressWidth,
    sideHeight,
    thickness,
    liftMechanism,
    headboard,
    headboardHeight,
    width: measured.width,
    depth: measured.length,
    height: measured.standingHeight,
    colors: parsePartColors(raw.colors),
  }
}

function panel(
  name: string,
  width: number,
  height: number,
  quantity: number,
  edge: PanelEdgePlan,
  note: string,
  extra?: Partial<GeneratedPanel>,
): GeneratedPanel {
  return {
    role: extra?.role ?? 'rail',
    name,
    width,
    height,
    quantity,
    canRotate: false,
    edges: edge,
    note,
    ...extra,
  }
}

export function generateBed(raw: Record<string, unknown>, settings?: unknown): CabinetGeneratorResult {
  const parsed = parseBedParams(raw)
  const m = measureBed(parsed)
  const error = bedError(parsed)
  const hw = hardwareOf(settings)
  const T = m.thickness
  const notes: string[] = []
  if (error) notes.push(error)

  const supportEach = Math.round(m.supportWidth)
  const innerNote = `Кант 0.5 мм: само горната. ${formatMm(m.sideLength)} × ${formatMm(m.innerHeight)} мм. С ${BED_INNER_DROP_MM} мм по-ниска от външната, за да легне рамката.`
  const panels: GeneratedPanel[] = [
    panel(
      'Дъно',
      m.length,
      m.width,
      1,
      band({ top: true, bottom: true, left: true, right: true }, 'mm2', { right: 'mm05' }),
      `Кант 2 мм: двете дълги страни и горният къс край. Кант 0.5 мм: долният къс край. Цялото легло ${formatMm(m.length)} × ${formatMm(m.width)} мм. Страниците влизат в него и се хващат с винтове отдолу.`,
      { role: 'bottom' },
    ),
    panel(
      'Страница',
      m.sideLength,
      m.sideHeight,
      2,
      band({ top: true, bottom: true }, 'mm2', { bottom: 'mm05' }),
      `Кант 2 мм: горна. Кант 0.5 мм: долна. ${formatMm(m.sideLength)} × ${formatMm(m.sideHeight)} мм. С ${T} мм по-къси от дъното във всеки край.`,
    ),
    panel('Вътрешна страница', m.sideLength, m.innerHeight, 2, band({ top: true }, 'mm05'), innerNote),
    panel(
      'Средна страница',
      m.sideLength,
      m.innerHeight,
      1,
      band({ top: true }, 'mm05'),
      `Кант 0.5 мм: само горната. По средата, дели леглото на лява и дясна част. ${formatMm(m.sideLength)} × ${formatMm(m.innerHeight)} мм.`,
    ),
    panel(
      'Плоскост под рамката',
      supportEach,
      m.innerHeight,
      2,
      band({ top: true }, 'mm05'),
      `Кант 0.5 мм: само горната. ${formatMm(supportEach)} × ${formatMm(m.innerHeight)} мм. Между вътрешната страница и средната. По 4 ъгълчета.`,
    ),
    panel(
      'Плот',
      m.topWidth,
      m.sideHeight,
      1,
      band({ top: true, bottom: true }, 'mm05'),
      `Кант 0.5 мм: горе и долу. ${formatMm(m.topWidth)} × ${formatMm(m.sideHeight)} мм. Влиза между страниците в края на леглото.`,
      { role: 'top' },
    ),
  ]

  if (parsed.liftMechanism) {
    panels.push(
      panel(
        'Плоскост за механизма',
        m.liftLength,
        m.innerHeight,
        2,
        band({ top: true }, 'mm05'),
        `Кант 0.5 мм: само горната. ${formatMm(m.liftLength)} × ${formatMm(m.innerHeight)} мм. От страната на плота, хваната с винтове за вътрешната страница. Лява и дясна.`,
      ),
    )
  }

  if (parsed.headboard) {
    panels.push(
      panel(
        'Табла',
        m.width,
        m.headboardHeight,
        1,
        band({ top: true, bottom: true, left: true, right: true }, 'mm2', { bottom: 'mm05' }),
        `Кант 2 мм: горе и двата края. Кант 0.5 мм: долу. ${formatMm(m.width)} × ${formatMm(m.headboardHeight)} мм, в горния край на леглото.`,
      ),
    )
  }

  panels.push(
    panel(
      'Подматрачна рамка',
      m.sideLength,
      m.topWidth,
      1,
      band({ top: true, bottom: true, left: true, right: true }, 'mm2', { right: 'mm05' }),
      `Не се реже от плочата. Рамка ${BED_FRAME_HEIGHT_MM} мм, ${formatMm(m.sideLength)} × ${formatMm(m.topWidth)} мм. Ляга върху вътрешните страници. Кант 2 мм: отгоре и двете страни. Кант 0.5 мм: отдолу.`,
      { excludeFromCutting: true, billEdges: true },
    ),
  )

  const bottomOuterScrews = confirmatCount(m.sideLength) * 2
  const bottomInnerScrews = confirmatCount(m.sideLength) * 3
  const topScrews = confirmatCount(m.sideHeight) * 2
  const liftScrews = parsed.liftMechanism ? confirmatCount(m.liftLength) * 2 : 0
  const headScrews = parsed.headboard ? confirmatCount(m.sideHeight) * 2 : 0
  const brackets = BED_BRACKETS_PER_SUPPORT * 2
  const bracketScrews = brackets * SCREWS_PER_CORNER_BRACKET
  const screwPrice = hw.screw5x60_500PackEur || SCREW_5X60.packPriceEur

  const hardware = [
    fastenerLine(
      { ...SCREW_5X60, packPriceEur: screwPrice },
      bottomOuterScrews + bottomInnerScrews + topScrews + liftScrews + headScrews,
      `Дъно към страниците ${bottomOuterScrews} бр., към вътрешните и средната ${bottomInnerScrews} бр., плот ${topScrews} бр.${parsed.liftMechanism ? `, механизъм ${liftScrews} бр.` : ''}${parsed.headboard ? `, табла ${headScrews} бр.` : ''}`,
    ),
    pricedLine(CORNER_BRACKET, brackets, 'По 4 на всяка плоскост под рамката'),
    fastenerLine(SCREW_4X16, bracketScrews, 'Винтчета за ъгълчетата'),
    pricedLine(
      { id: 'bed-slat-frame', name: 'Подматрачна рамка', unitPriceEur: hw.bedSlatFrameEur },
      1,
      `Висока ${BED_FRAME_HEIGHT_MM} мм. Цената се слага в Настройки.`,
    ),
  ]
  if (parsed.liftMechanism) {
    hardware.push(
      pricedLine(
        { id: 'bed-lift', name: 'Механизъм за повдигане', unitPriceEur: hw.bedLiftMechanismEur },
        1,
        'Ляв и десен. Цената се слага в Настройки.',
      ),
    )
  }

  notes.push(
    `Матрак ${formatMm(parsed.mattressLength)} × ${formatMm(parsed.mattressWidth)} мм. Леглото е ${formatMm(m.length)} × ${formatMm(m.width)} мм — по ${BED_MATTRESS_ALLOWANCE_MM} мм отгоре.`,
  )
  notes.push(
    `Плотът е ${formatMm(m.topWidth)} мм и влиза между страниците. Дъното е ${formatMm(m.width)} мм, страниците влизат в него.`,
  )
  notes.push(
    `Вътрешните страници и средната са ${formatMm(m.innerHeight)} мм — със ${BED_INNER_DROP_MM} мм по-ниски. Рамката е ${BED_FRAME_HEIGHT_MM} мм и ляга отгоре им.`,
  )
  notes.push(
    `Двете плоскости под рамката са ${formatMm(supportEach)} × ${formatMm(m.innerHeight)} мм, с ${brackets} ъгълчета.`,
  )
  if (parsed.liftMechanism) {
    notes.push(
      `Механизмът се слага на двете плоскости ${formatMm(m.liftLength)} × ${formatMm(m.innerHeight)} мм от страната на плота.`,
    )
  }
  if (parsed.headboard) {
    notes.push(`Таблата е ${formatMm(m.width)} × ${formatMm(m.headboardHeight)} мм в горния край.`)
  }

  const steps = [
    { id: 'bed-bottom', label: 'Дъно към страниците', minutes: 20 },
    { id: 'bed-inner', label: 'Вътрешни страници и средна', minutes: 25 },
    { id: 'bed-supports', label: 'Плоскости под рамката', minutes: 15 },
    { id: 'bed-top', label: 'Плот между страниците', minutes: 10 },
    { id: 'bed-frame', label: 'Подматрачна рамка', minutes: 15 },
  ]
  if (parsed.liftMechanism) steps.push({ id: 'bed-lift', label: 'Механизъм за повдигане', minutes: 20 })
  if (parsed.headboard) steps.push({ id: 'bed-head', label: 'Табла', minutes: 15 })
  const assemblyMinutes = steps.reduce((sum, step) => sum + step.minutes, 0)

  return {
    panels,
    joinery: BED_JOINERY,
    hardware,
    labor: {
      ...emptyLabor(),
      assemblyMinutes,
      assemblySteps: steps,
    },
    notes,
  }
}

export function bedRuleBlock(): RuleBlock {
  const sample = DEFAULT_BED_PARAMS
  const m = measureBed(sample)
  return {
    title: 'Легло',
    lines: [
      `Матрак ${sample.mattressLength} × ${sample.mattressWidth} мм дава легло ${formatMm(m.length)} × ${formatMm(m.width)} мм.`,
      `Дъното е цялата широчина. Страниците влизат в него и са ${formatMm(m.sideLength)} мм. Плотът влиза между страниците и е ${formatMm(m.topWidth)} мм.`,
      `Вътрешните страници са със ${BED_INNER_DROP_MM} мм по-ниски. При страници ${sample.sideHeight} мм те са ${formatMm(m.innerHeight)} мм. Средната е същата и дели ляво и дясно.`,
      `Под рамката има две плоскости ${formatMm(Math.round(m.supportWidth))} × ${formatMm(m.innerHeight)} мм, с 4 ъгълчета на всяка.`,
      'По избор: механизъм с две плоскости 700 мм от страната на плота, и табла по широчината на леглото.',
    ],
  }
}

export const bedType: CabinetTypeDefinition = {
  id: BED_TYPE_ID,
  name: 'Легло',
  category: 'other',
  description:
    'Матракът плюс 50 мм дава леглото. Дъното е отвън, плотът влиза между страниците, вътрешните са по-ниски за рамката.',
  defaultParams: { ...DEFAULT_BED_PARAMS },
  generate: generateBed,
}
