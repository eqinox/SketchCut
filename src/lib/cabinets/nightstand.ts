import { parsePartColors, DEFAULT_PART_COLORS } from './colors'
import {
  confirmatCount,
  fastenerLine,
  pricedLine,
  SCREW_5X60,
  SCREW_4X16,
} from './hardware'
import {
  DEFAULT_LEG_HEIGHT,
  DEFAULT_PANEL_THICKNESS,
  emptyLabor,
  edges,
  frontDoorOverhang,
  type CabinetGeneratorResult,
  type CabinetTypeDefinition,
  type GeneratedPanel,
  type JoineryConfig,
} from './types'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import {
  collectCabinetAssembly,
  type AssemblyTimeSettings,
} from '@/lib/assembly-time'
import { DEFAULT_ASSEMBLY_TIME_SETTINGS } from '@/lib/assembly-time'
import type { CabinetPartColors } from './colors'
import {
  appendHardboard,
  appendZonedInterior,
  parseInteriorFittings,
  type InteriorFittings,
} from './fronts'

export const NIGHTSTAND_TYPE_ID = 'nightstand'

/** Corner bracket for attaching an outer top to the sides from the inside. */
const CORNER_BRACKET = {
  id: 'corner-bracket',
  name: 'Ъгълче',
  unitPriceEur: 0.05,
}

/** Plinth inset from the front/back kant of the bottom (mm). */
export const PLINTH_INSET = 20

/**
 * Plinth: sides are outer to the bottom.
 * Legs: bottom is outer (sides sit in it). Nightstand top is outer to the sides.
 */
export const NIGHTSTAND_JOINERY: JoineryConfig = {
  bottomSides: 'sides-cover-bottom',
  topSides: 'rails-cover-sides',
  depth: 'flush',
}

export const NIGHTSTAND_LEGS_JOINERY: JoineryConfig = {
  bottomSides: 'bottom-covers-sides',
  topSides: 'rails-cover-sides',
  depth: 'flush',
}

export const SECTION_JOINERY: JoineryConfig = {
  bottomSides: 'sides-cover-bottom',
  topSides: 'rails-between-sides',
  depth: 'flush',
}

export interface NightstandParams extends InteriorFittings {
  width: number
  height: number
  depth: number
  thickness: number
  /** false = цокъл + дъно (default). true = 4 крачета, без цокъл. */
  useLegs: boolean
  /** Number of plinths (1 front, or front+back). Ignored when useLegs. */
  plinthCount: 1 | 2
  /** Plinth height in mm. Ignored when useLegs. */
  plinthHeight: number
  /** Leg height in mm. Used only when useLegs. */
  legHeight: number
  colors: CabinetPartColors
}

export const DEFAULT_NIGHTSTAND_PARAMS: NightstandParams = {
  width: 500,
  height: 500,
  depth: 400,
  thickness: DEFAULT_PANEL_THICKNESS,
  useLegs: false,
  plinthCount: 1,
  plinthHeight: 100,
  legHeight: DEFAULT_LEG_HEIGHT,
  shelfCount: 0,
  hasBack: false,
  doorCount: 0,
  drawerFrontHeights: [],
  cutFromOneBoard: false,
  includeHandles: true,
  hasClothesRail: false,
  slideKind: 'roller',
  slideLength: 300,
  fixedShelves: [],
  doorSpan: 'full',
  zones: {},
  colors: { ...DEFAULT_PART_COLORS },
}

export function parseNightstandParams(raw: Record<string, unknown>): NightstandParams {
  const d = DEFAULT_NIGHTSTAND_PARAMS
  const num = (key: keyof NightstandParams, fallback: number) => {
    const v = raw[key]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
  }
  const leg = num('legHeight', d.legHeight)
  const depth = num('depth', d.depth)
  const thickness = num('thickness', d.thickness)
  const sideD = Math.max(thickness, depth - frontDoorOverhang(thickness))
  return {
    width: num('width', d.width),
    height: num('height', d.height),
    depth,
    thickness,
    useLegs: raw.useLegs === true,
    plinthCount: raw.plinthCount === 2 ? 2 : 1,
    plinthHeight: num('plinthHeight', d.plinthHeight),
    legHeight: leg === 150 ? 150 : 100,
    ...parseInteriorFittings(raw, sideD),
    colors: parsePartColors(raw.colors),
  }
}

export function measureNightstand(p: NightstandParams, topInner = false) {
  const T = p.thickness
  const frontOverhang = frontDoorOverhang(T)
  const sideD = Math.max(T, p.depth - frontOverhang)
  const topW = topInner ? p.width - 2 * T : p.width
  const topD = topInner ? sideD : p.depth
  const bottomW = p.useLegs ? p.width : p.width - 2 * T
  const bottomD = p.useLegs ? p.depth : sideD
  const supportH = p.useLegs ? p.legHeight : p.plinthHeight
  const sideH = topInner
    ? p.height
    : Math.max(T, p.height - T - (p.useLegs ? p.legHeight + T : 0))
  const innerW = p.width - 2 * T
  const innerH = Math.max(T, p.height - 2 * T - supportH)
  const plinthLength = p.width - 2 * T
  const plinthZ = frontOverhang + PLINTH_INSET
  const backPlinthZ = frontOverhang + sideD - PLINTH_INSET - T
  /** Door stops at the underside when the top overhangs the sides (edge banding stays visible). */
  const frontCoversTop = topD <= sideD
  /** Same at the bottom when the bottom also overhangs (legs + outer bottom). */
  const frontCoversBottom = bottomD <= sideD
  const frontHeight = innerH + (frontCoversTop ? T : 0) + (frontCoversBottom ? T : 0)

  return {
    thickness: T,
    frontOverhang,
    sideH,
    sideD,
    bottomW,
    bottomD,
    topW,
    topD,
    innerW,
    innerH,
    supportH,
    plinthLength,
    plinthHeight: p.plinthHeight,
    plinthZ,
    backPlinthZ,
    plinthInset: PLINTH_INSET,
    topInner,
    frontCoversTop,
    frontCoversBottom,
    frontHeight,
  }
}

export function generateNightstand(
  raw: Record<string, unknown>,
  settings?: unknown,
): CabinetGeneratorResult {
  return generatePlinthCabinet(raw, settings, {
    topInner: false,
    label: 'Нощно шкафче',
  })
}

export function generatePlinthCabinet(
  raw: Record<string, unknown>,
  settings: unknown,
  opts: { topInner: boolean; label: string; forcePlinth?: boolean },
): CabinetGeneratorResult {
  const hardwareSettings = (settings as { hardware?: HardwareSettings; assemblyTime?: AssemblyTimeSettings })?.hardware ?? DEFAULT_HARDWARE_SETTINGS
  const assemblyTimeSettings = (settings as { hardware?: HardwareSettings; assemblyTime?: AssemblyTimeSettings })?.assemblyTime ?? DEFAULT_ASSEMBLY_TIME_SETTINGS
  const parsed = parseNightstandParams(raw)
  const p: NightstandParams = opts.forcePlinth ? { ...parsed, useLegs: false } : parsed
  const m = measureNightstand(p, opts.topInner)

  const notes: string[] = [
    `${opts.label} ${p.width} × ${p.height} × ${p.depth} мм, плоскост ${p.thickness} мм.`,
  ]

  if (p.useLegs) {
    notes.push(
      `Дъното е външно (${m.bottomW} × ${m.bottomD} мм), страниците влизат в него. Плотът е външен върху страниците (${m.topW} × ${m.topD} мм).`,
      `Страниците са ${m.sideD} мм дълбоки — общата дълбочина ${p.depth} мм включва врата/чело ${p.thickness} мм + 2 мм кант.`,
      'Плотът и дъното стърчат отпред — вратата/челото стига до долната страна на плота и до горната на дъното, кантовете остават видими.',
      'Плотът се хваща отвътре с 4 ъгълчета, без винтове 5×60 през горната страна.',
      `4 крачета ${p.legHeight} мм под дъното. Винтове 5×60 отдолу през дъното в страниците.`,
    )
  } else if (opts.topInner) {
    notes.push(
      `Страниците са външни на дъното и на плота (${m.bottomW} мм между тях). Плотът влиза между страниците (${m.topW} × ${m.topD} мм).`,
      `Страниците са ${m.sideD} мм дълбоки — общата дълбочина ${p.depth} мм включва врата/чело ${p.thickness} мм + 2 мм кант.`,
      'Плотът се хваща с винтове 5×60 през страниците, без ъгълчета.',
      'Цокъл с канта надолу, дъното върху него, пробив отгоре през дъното. После дъното между страниците.',
      `Дъното е на ${p.plinthHeight} мм от земята. Долу опират само двете страници и цокълът.`,
      p.plinthCount === 1
        ? `1 цокъл ${p.plinthHeight} мм, ${m.plinthLength} мм, на ${PLINTH_INSET} мм навътре от предния кант на дъното.`
        : `2 цокъла ${p.plinthHeight} мм, ${m.plinthLength} мм, на ${PLINTH_INSET} мм навътре от предния и задния кант.`,
    )
  } else {
    notes.push(
      `Страниците са външни на дъното (${m.bottomW} мм между тях). Плотът е външен върху страниците (${m.topW} × ${m.topD} мм).`,
      `Страниците са ${m.sideD} мм дълбоки — общата дълбочина ${p.depth} мм включва врата/чело ${p.thickness} мм + 2 мм кант на плота.`,
      'Плотът стърчи отпред — вратата/челото стига до долната му страна, кантът на плота остава видим.',
      'Плотът се хваща отвътре с 4 ъгълчета, без винтове 5×60 през горната страна.',
      'Цокъл с канта надолу, дъното върху него, пробив отгоре през дъното. После дъното между страниците.',
      `Дъното е на ${p.plinthHeight} мм от земята. Долу опират само двете страници и цокълът.`,
      p.plinthCount === 1
        ? `1 цокъл ${p.plinthHeight} мм, ${m.plinthLength} мм, на ${PLINTH_INSET} мм навътре от предния кант на дъното.`
        : `2 цокъла ${p.plinthHeight} мм, ${m.plinthLength} мм, на ${PLINTH_INSET} мм навътре от предния и задния кант.`,
    )
  }

  const bottomScrewsPerSide = confirmatCount(p.useLegs ? m.bottomD : m.sideD)
  const bottomScrewsTotal = bottomScrewsPerSide * 2
  const plinthScrewsEach = confirmatCount(m.plinthLength)
  const plinthScrewsTotal = p.useLegs ? 0 : plinthScrewsEach * p.plinthCount
  const topScrewsPerSide = confirmatCount(m.topD)
  const topScrewsTotal = topScrewsPerSide * 2
  const cornerBrackets = opts.topInner ? 0 : 4
  const bracketScrews = cornerBrackets * 4

  if (opts.topInner) {
    notes.push(
      `Сглобяване: цокъл към дъно с ${plinthScrewsTotal} винта 5×60 (${plinthScrewsEach} на цокъл),` +
        ` после дъното към страниците с ${bottomScrewsTotal} винта 5×60 (${bottomScrewsPerSide} на страница),` +
        ` плот към страниците с ${topScrewsTotal} винта 5×60 (${topScrewsPerSide} на страница).`,
    )
  } else {
    notes.push(
      p.useLegs
        ? `Сглобяване: дъното с ${bottomScrewsTotal} винта 5×60 отдолу (${bottomScrewsPerSide} на страница),` +
          ` плот с 4 ъгълчета × 4 винтчета 4×16 = ${bracketScrews} винтчета.`
        : `Сглобяване: цокъл към дъно с ${plinthScrewsTotal} винта 5×60 (${plinthScrewsEach} на цокъл),` +
          ` после дъното към страниците с ${bottomScrewsTotal} винта 5×60 (${bottomScrewsPerSide} на страница),` +
          ` плот с 4 ъгълчета × 4 винтчета 4×16 = ${bracketScrews} винтчета.`,
    )
  }

  const hardware = [
    ...(p.useLegs ? [{ name: `Краче ${p.legHeight} мм`, quantity: 4 }] : []),
    fastenerLine(
      { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur },
      bottomScrewsTotal,
      p.useLegs ? 'Дъно — винтове отдолу в страниците' : 'Дъно — винтове през страниците',
    ),
    ...(p.useLegs
      ? []
      : [
          fastenerLine(
            { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur },
            plinthScrewsTotal,
            `Цокъл — ${plinthScrewsEach} на цокъл, пробив през дъното`,
          ),
        ]),
    ...(opts.topInner
      ? [
          fastenerLine(
            { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur },
            topScrewsTotal,
            `Плот — винтове през страниците (${topScrewsPerSide} на страница)`,
          ),
        ]
      : [
          pricedLine(CORNER_BRACKET, cornerBrackets, 'Ъгълчета за плота'),
          fastenerLine(
            { ...SCREW_4X16, packPriceEur: hardwareSettings.smallScrew1000PackEur },
            bracketScrews,
            'Винтчета за ъгълчетата',
          ),
        ]),
  ]

  const panels: GeneratedPanel[] = [
    {
      role: 'side' as const,
      name: 'Страница',
      width: m.sideD,
      height: m.sideH,
      quantity: 2,
      canRotate: false,
      edges: edges({ top: opts.topInner, bottom: !p.useLegs, left: true, right: false }, 'mm05'),
      note: p.useLegs
        ? `Кант 0.5 мм: предна. Долната сяда в дъното. Дълбочина ${m.sideD} мм.`
        : opts.topInner
          ? `Кант 0.5 мм: предна, горна и долна (страниците захлупват плота и опират в земята). Дълбочина ${m.sideD} мм.`
          : `Кант 0.5 мм: предна и долна (долу опира в земята). Дълбочина ${m.sideD} мм.`,
    },
    {
      role: 'bottom' as const,
      name: 'Дъно',
      width: m.bottomW,
      height: m.bottomD,
      quantity: 1,
      canRotate: false,
      edges: p.useLegs
        ? edges({ top: true, left: true, right: true })
        : edges({ top: true, bottom: false, left: false, right: false }, 'mm05'),
      note: p.useLegs
        ? `Кант 2 мм: предна и две странични. Външно ${m.bottomW} × ${m.bottomD} мм, страниците сядат в него, винтове отдолу.`
        : `Кант 0.5 мм: предна. Влиза между страниците (${m.bottomW} мм). Хваща се първо за цокъла, после за страниците.`,
    },
    {
      role: 'top' as const,
      name: 'Плот',
      width: m.topW,
      height: m.topD,
      quantity: 1,
      canRotate: false,
      edges: opts.topInner
        ? edges({ top: true })
        : edges({ top: true, left: true, right: true, bottom: false }),
      note: opts.topInner
        ? `Кант 2 мм: предна. Влиза между страниците (${m.topW} × ${m.topD} мм). Хваща се с 5×60 през страниците.`
        : 'Кант 2 мм: предна и две странични. Седи отгоре върху страниците. Хваща се с ъгълчета отвътре.',
    },
  ]

  if (!p.useLegs) {
    panels.push({
      role: 'plinth' as const,
      name: 'Цокъл',
      width: m.plinthLength,
      height: m.plinthHeight,
      quantity: p.plinthCount,
      canRotate: false,
      edges: edges({ bottom: true, top: false, left: false, right: false }),
      note: `Кант 2 мм: само долната дълга страна (кантът е надолу към земята). ${PLINTH_INSET} мм навътре от канта на дъното.`,
    })
  }

  const interior = appendZonedInterior(
    {
      fittings: p,
      innerW: m.innerW,
      innerH: m.innerH,
      sideD: m.sideD,
      thickness: p.thickness,
      width: p.width,
      frontHeight: m.frontHeight,
      overlayCovers: { top: m.frontCoversTop, bottom: m.frontCoversBottom },
    },
    panels,
    hardware,
    notes,
    hardwareSettings,
  )

  if (p.hasBack) {
    appendHardboard(
      {
        width: p.width,
        height: p.height,
        plinthHeight: p.useLegs ? 0 : p.plinthHeight,
      },
      panels,
      notes,
    )
  }

  const assembly = collectCabinetAssembly({
    settings: assemblyTimeSettings,
    panels,
    width: p.width,
    height: p.height,
    depth: p.depth,
    hasLegs: p.useLegs,
    hasTopRails: false,
    hasTop: true,
    plinthCount: p.useLegs ? 0 : p.plinthCount,
    hasBack: p.hasBack,
    shelfCount: interior.shelfCount,
    doorCount: interior.doorCount,
    drawerCount: interior.drawerCount,
    hasClothesRail: interior.clothesRailCount > 0,
    clothesRailCount: interior.clothesRailCount,
    clothesRailLengthMm: m.innerW,
    fixedShelfCount: interior.fixedShelfCount,
  })

  return {
    joinery: opts.topInner ? SECTION_JOINERY : p.useLegs ? NIGHTSTAND_LEGS_JOINERY : NIGHTSTAND_JOINERY,
    labor: {
      ...emptyLabor(),
      assemblyMinutes: assembly.minutes,
      assemblySteps: assembly.steps,
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
  description: 'По подразбиране: външни страници, дъно с цокъл, плот с ъгълчета. По избор рафтове, врата и чекмеджета.',
  defaultParams: { ...DEFAULT_NIGHTSTAND_PARAMS },
  generate: generateNightstand,
}
