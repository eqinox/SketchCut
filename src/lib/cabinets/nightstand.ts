import { parsePartColors, DEFAULT_PART_COLORS } from './colors'
import {
  fastenerLine,
  pricedLine,
  SCREW_5X60,
  SCREW_4X16,
} from './hardware'
import {
  DEFAULT_PANEL_THICKNESS,
  emptyLabor,
  edges,
  type CabinetGeneratorResult,
  type CabinetTypeDefinition,
  type GeneratedPanel,
  type JoineryConfig,
} from './types'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import {
  calculatePanelEdgeBandingTime,
  type AssemblyTimeSettings,
} from '@/lib/assembly-time'
import { DEFAULT_ASSEMBLY_TIME_SETTINGS } from '@/lib/assembly-time'
import type { CabinetPartColors } from './colors'

export const NIGHTSTAND_TYPE_ID = 'nightstand'

/** Corner bracket for attaching top to sides. */
const CORNER_BRACKET = {
  id: 'corner-bracket',
  name: 'Ъгълче',
  unitPriceEur: 0.05,
}

/** Plinth inset from front/back edges (mm). */
const PLINTH_INSET = 20

/** Joinery: sides are full height, bottom fits between them, top sits on top. */
export const NIGHTSTAND_JOINERY: JoineryConfig = {
  bottomSides: 'sides-cover-bottom',
  topSides: 'rails-cover-sides',
  depth: 'flush',
}

export interface NightstandParams {
  width: number
  height: number
  depth: number
  thickness: number
  /** Number of plinths (1 or 2). */
  plinthCount: 1 | 2
  /** Plinth height in mm. */
  plinthHeight: number
  colors: CabinetPartColors
}

export const DEFAULT_NIGHTSTAND_PARAMS: NightstandParams = {
  width: 400,
  height: 500,
  depth: 400,
  thickness: DEFAULT_PANEL_THICKNESS,
  plinthCount: 2,
  plinthHeight: 100,
  colors: { ...DEFAULT_PART_COLORS },
}

export function parseNightstandParams(raw: Record<string, unknown>): NightstandParams {
  const d = DEFAULT_NIGHTSTAND_PARAMS
  const num = (key: keyof NightstandParams, fallback: number) => {
    const v = raw[key]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
  }
  const plinthCount = raw.plinthCount === 1 ? 1 : 2
  return {
    width: num('width', d.width),
    height: num('height', d.height),
    depth: num('depth', d.depth),
    thickness: num('thickness', d.thickness),
    plinthCount,
    plinthHeight: num('plinthHeight', d.plinthHeight),
    colors: parsePartColors(raw.colors),
  }
}

function measureNightstand(p: NightstandParams) {
  // Sides are full height
  const sideH = p.height
  const sideD = p.depth
  
  // Bottom fits between sides
  const bottomW = p.width - 2 * p.thickness
  const bottomD = p.depth
  
  // Top sits on top of sides (full width)
  const topW = p.width
  const topD = p.depth
  
  // Plinth length (fits under bottom, inset from edges)
  const plinthLength = p.width - 2 * PLINTH_INSET
  
  return {
    sideH,
    sideD,
    bottomW,
    bottomD,
    topW,
    topD,
    plinthLength,
    plinthHeight: p.plinthHeight,
  }
}

function screwCount(dimension: number): number {
  return dimension > 500 ? 3 : 2
}

export function generateNightstand(
  raw: Record<string, unknown>,
  settings?: unknown,
): CabinetGeneratorResult {
  const hardwareSettings = (settings as { hardware?: HardwareSettings; assemblyTime?: AssemblyTimeSettings })?.hardware ?? DEFAULT_HARDWARE_SETTINGS
  const assemblyTimeSettings = (settings as { hardware?: HardwareSettings; assemblyTime?: AssemblyTimeSettings })?.assemblyTime ?? DEFAULT_ASSEMBLY_TIME_SETTINGS
  const p = parseNightstandParams(raw)
  const m = measureNightstand(p)

  const notes: string[] = [
    `Нощно шкафче ${p.width} × ${p.height} × ${p.depth} мм, плоскост ${p.thickness} мм.`,
    'Страниците са пълна височина, дъното влиза между тях.',
    'Плотът седи отгоре върху страниците и се захваща с 4 ъгълчета.',
    `${p.plinthCount} цокъла ${p.plinthHeight} мм под дъното, на ${PLINTH_INSET} мм навътре от канта.`,
  ]

  // Calculate screw counts
  const bottomScrewsPerSide = screwCount(p.depth)
  const bottomScrewsTotal = bottomScrewsPerSide * 2 // both sides
  const plinthScrewsEach = screwCount(p.width)
  const plinthScrewsTotal = plinthScrewsEach * p.plinthCount
  const cornerBrackets = 4
  const bracketScrews = cornerBrackets * 4 // 4 screws per bracket

  notes.push(
    `Сглобяване: дъното с ${bottomScrewsTotal} винта 5×60 (${bottomScrewsPerSide} на страница),` +
    ` цокли с ${plinthScrewsTotal} винта 5×60 (${plinthScrewsEach} на цокъл),` +
    ` плот с 4 ъгълчета × ${bracketScrews} винтчета 4×16 = ${bracketScrews} винтчета.`,
  )

  const hardware = [
    fastenerLine(
      { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur },
      bottomScrewsTotal,
      'Дъно — винтове от страниците',
    ),
    fastenerLine(
      { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur },
      plinthScrewsTotal,
      `Цокли — ${plinthScrewsEach} на цокъл`,
    ),
    pricedLine(
      CORNER_BRACKET,
      cornerBrackets,
      'Ъгълчета за плота',
    ),
    fastenerLine(
      { ...SCREW_4X16, packPriceEur: hardwareSettings.smallScrew1000PackEur },
      bracketScrews,
      'Винтчета за ъгълчетата',
    ),
  ]

  const panels: GeneratedPanel[] = [
    {
      role: 'side' as const,
      name: 'Страница',
      width: m.sideD,
      height: m.sideH,
      quantity: 2,
      canRotate: false,
      edges: edges({ top: false, bottom: true, left: true, right: false }, 'mm05'),
      note: 'Кант 0.5 мм: предна и долна страна.',
    },
    {
      role: 'bottom' as const,
      name: 'Дъно',
      width: m.bottomW,
      height: m.bottomD,
      quantity: 1,
      canRotate: false,
      edges: edges({ top: true, bottom: false, left: false, right: false }, 'mm05'),
      note: `Кант 0.5 мм: само предната страна. Влиза между страниците.`,
    },
    {
      role: 'top' as const,
      name: 'Плот',
      width: m.topW,
      height: m.topD,
      quantity: 1,
      canRotate: false,
      edges: edges({ top: true, left: true, right: true, bottom: false }),
      note: 'Кант 2 мм: предна и две странични. Седи отгоре върху страниците.',
    },
    {
      role: 'plinth' as const,
      name: 'Цокъл',
      width: m.plinthLength,
      height: m.plinthHeight,
      quantity: p.plinthCount,
      canRotate: false,
      edges: edges({ bottom: true, top: false, left: false, right: false }),
      note: `Кант 2 мм: само долната дълга страна. Хваща се ${PLINTH_INSET} мм навътре от канта.`,
    },
  ]

  // Calculate assembly time
  let assemblyMinutes = 0
  
  // Add time for assembling sides
  assemblyMinutes += assemblyTimeSettings.assembleSidesMinutes
  
  // Add time for edge banding processing for all panels
  for (const panel of panels) {
    if (panel.excludeFromCutting) continue
    const edgeTime = calculatePanelEdgeBandingTime(
      panel.width,
      panel.height,
      panel.edges,
      panel.quantity,
      assemblyTimeSettings.edgeBanding,
    )
    assemblyMinutes += edgeTime
  }

  return {
    joinery: NIGHTSTAND_JOINERY,
    labor: {
      ...emptyLabor(),
      assemblyMinutes: Math.round(assemblyMinutes * 10) / 10,
    },
    hardware,
    notes,
    panels,
  }
}

export const nightstandType: CabinetTypeDefinition = {
  id: NIGHTSTAND_TYPE_ID,
  name: 'Нощно шкафче',
  category: 'other',
  description: 'Нощно шкафче с цокли вместо крачета. Плот, дъно, 2 страници.',
  defaultParams: { ...DEFAULT_NIGHTSTAND_PARAMS },
  generate: generateNightstand,
}
