import { parsePartColors, DEFAULT_PART_COLORS } from './colors'
import {
  isSoftCloseSlide,
  confirmatCount,
  fastenerLine,
  pricedLine,
  SCREW_5X60,
  SCREW_4X16,
} from './hardware'
import {
  DEFAULT_LEG_HEIGHT,
  DEFAULT_PANEL_THICKNESS,
  DEFAULT_RAIL_WIDTH,
  DEFAULT_SHELF_FRONT_INSET,
  emptyLabor,
  edges,
  frontDoorOverhang,
  parseBoxTopStyle,
  type CabinetGeneratorResult,
  type CabinetTopStyle,
  type CabinetTypeDefinition,
  type GeneratedPanel,
  type JoineryConfig,
} from './types'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS, omitsCuttingEdgingLabor } from '@/lib/settings'
import {
  collectCabinetAssembly,
  type AssemblyTimeSettings,
} from '@/lib/assembly-time'
import { DEFAULT_ASSEMBLY_TIME_SETTINGS } from '@/lib/assembly-time'
import type { CabinetPartColors } from './colors'
import {
  appendHardboard,
  appendHangingFascias,
  appendZonedInterior,
  parseInteriorFittings,
  type InteriorFittings,
} from './fronts'
import { cabinetColumns, resolvePartitions } from './zones'
import {
  SLIDING_PARTITION_SETBACK_MM,
  SLIDING_SHELF_FROM_PARTITION_MM,
} from './sliding-doors'

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
  /** Default `panel`. `none` = open top. `fascia` = hanging rail (sink-style). */
  topStyle: CabinetTopStyle
  /** Height of the hanging fascia when topStyle is fascia. */
  railWidth: number
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
  topStyle: 'panel',
  railWidth: DEFAULT_RAIL_WIDTH,
  shelfCount: 0,
  hasBack: false,
  doorCount: 0,
  doorStyle: 'hinged',
  slidingEdges: [],
  drawerFrontHeights: [],
  cutFromOneBoard: false,
  includeHandles: true,
  hasClothesRail: false,
  slideKind: 'roller',
  slideLength: 300,
  fixedShelves: [],
  partitions: [],
  doorSpan: 'full',
  zones: {},
  externalDoors: false,
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
  const sliding = raw.doorStyle === 'sliding'
  const sideD = sliding ? Math.max(thickness, depth) : Math.max(thickness, depth - frontDoorOverhang(thickness))
  const slideDepth = sliding ? Math.max(thickness, sideD - SLIDING_PARTITION_SETBACK_MM) : sideD
  return {
    width: num('width', d.width),
    height: num('height', d.height),
    depth,
    thickness,
    useLegs: raw.useLegs === true,
    plinthCount: raw.plinthCount === 2 ? 2 : 1,
    plinthHeight: num('plinthHeight', d.plinthHeight),
    legHeight: leg === 150 ? 150 : 100,
    topStyle: parseBoxTopStyle(raw.topStyle),
    railWidth: num('railWidth', d.railWidth),
    ...parseInteriorFittings(raw, slideDepth),
    colors: parsePartColors(raw.colors),
  }
}

export function measureNightstand(p: NightstandParams, topInner = false) {
  const T = p.thickness
  const hasTopPanel = p.topStyle === 'panel'
  const coveringTop = hasTopPanel && !topInner
  const innerTopPanel = hasTopPanel && topInner
  const sliding = p.doorStyle === 'sliding'
  const frontOverhang = sliding ? 0 : frontDoorOverhang(T)
  const sideD = sliding ? Math.max(T, p.depth) : Math.max(T, p.depth - frontOverhang)
  const partitionD = sliding ? Math.max(T, sideD - SLIDING_PARTITION_SETBACK_MM) : sideD
  const shelfD = sliding
    ? Math.max(T, partitionD - SLIDING_SHELF_FROM_PARTITION_MM)
    : Math.max(T, sideD - DEFAULT_SHELF_FRONT_INSET)
  const topW = innerTopPanel ? p.width - 2 * T : p.width
  const topD = innerTopPanel ? sideD : p.depth
  const bottomW = p.useLegs ? p.width : p.width - 2 * T
  const bottomD = p.useLegs ? p.depth : sideD
  const supportH = p.useLegs ? p.legHeight : p.plinthHeight
  const sideH = innerTopPanel
    ? p.height
    : coveringTop
      ? Math.max(T, p.height - T - (p.useLegs ? p.legHeight + T : 0))
      : Math.max(T, p.height - (p.useLegs ? p.legHeight + T : 0))
  const innerW = p.width - 2 * T
  const innerH = Math.max(T, p.height - (hasTopPanel ? 2 * T : T) - supportH)
  const plinthLength = p.width - 2 * T
  const plinthZ = frontOverhang + PLINTH_INSET
  const backPlinthZ = frontOverhang + sideD - PLINTH_INSET - T
  /** Door stops at the underside when a covering top overhangs the sides (edge banding stays visible). */
  const frontCoversTop = innerTopPanel
  /** Same at the bottom when the bottom also overhangs (legs + outer bottom). */
  const frontCoversBottom = bottomD <= sideD
  const frontHeight = innerH + (frontCoversTop ? T : 0) + (frontCoversBottom ? T : 0)

  return {
    thickness: T,
    frontOverhang,
    sideH,
    sideD,
    partitionD,
    shelfD,
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
    hasTopPanel,
    coveringTop,
    innerTopPanel,
    frontCoversTop,
    frontCoversBottom,
    frontHeight,
    sliding,
  }
}

export function generateNightstand(
  raw: Record<string, unknown>,
  settings?: unknown,
): CabinetGeneratorResult {
  return generatePlinthCabinet({ ...raw, doorStyle: 'hinged' }, settings, {
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
  const coveringTop = m.coveringTop
  const innerTop = m.innerTopPanel
  const hasTopPanel = m.hasTopPanel

  if (p.useLegs) {
    notes.push(
      `Дъното е външно (${m.bottomW} × ${m.bottomD} мм), страниците влизат в него.`,
      `Страниците са ${m.sideD} мм дълбоки — общата дълбочина ${p.depth} мм включва врата/чело ${p.thickness} мм + 2 мм кант.`,
    )
    if (coveringTop) {
      notes.push(
        `Плотът е външен върху страниците (${m.topW} × ${m.topD} мм).`,
        'Плотът и дъното стърчат отпред — вратата/челото стига до долната страна на плота и до горната на дъното, кантовете остават видими.',
        'Плотът се хваща отвътре с 4 ъгълчета, без винтове 5×60 през горната страна.',
      )
    } else {
      notes.push('Дъното стърчи отпред — вратата/челото стига до горната му страна, кантът остава видим.')
    }
    notes.push(`4 крачета ${p.legHeight} мм под дъното. Винтове 5×60 отдолу през дъното в страниците.`)
  } else if (opts.topInner) {
    notes.push(
      hasTopPanel
        ? `Страниците са външни на дъното и на плота (${m.bottomW} мм между тях). Плотът влиза между страниците (${m.topW} × ${m.topD} мм).`
        : `Страниците са външни на дъното (${m.bottomW} мм между тях). Без плот — отворен корпус отгоре.`,
      `Страниците са ${m.sideD} мм дълбоки — ${
        m.sliding
          ? `плъзгащите врати минават отпред между тях (разделители ${m.partitionD} мм, рафтове ${m.shelfD} мм).`
          : `общата дълбочина ${p.depth} мм включва врата/чело ${p.thickness} мм + 2 мм кант.`
      }`,
    )
    if (innerTop) {
      notes.push('Плотът се хваща с винтове 5×60 през страниците, без ъгълчета.')
    }
    notes.push(
      'Цокъл с канта надолу, дъното върху него, пробив отгоре през дъното. После дъното между страниците.',
      `Дъното е на ${p.plinthHeight} мм от земята. Долу опират само двете страници и цокълът.`,
      p.plinthCount === 1
        ? `1 цокъл ${p.plinthHeight} мм, ${m.plinthLength} мм, на ${PLINTH_INSET} мм навътре от предния кант на дъното.`
        : `2 цокъла ${p.plinthHeight} мм, ${m.plinthLength} мм, на ${PLINTH_INSET} мм навътре от предния и задния кант.`,
    )
  } else {
    notes.push(
      coveringTop
        ? `Страниците са външни на дъното (${m.bottomW} мм между тях). Плотът е външен върху страниците (${m.topW} × ${m.topD} мм).`
        : `Страниците са външни на дъното (${m.bottomW} мм между тях). Без плот — отворен корпус отгоре.`,
      `Страниците са ${m.sideD} мм дълбоки — ${
        m.sliding
          ? `плъзгащите врати минават отпред между тях (разделители ${m.partitionD} мм, рафтове ${m.shelfD} мм).`
          : `общата дълбочина ${p.depth} мм включва врата/чело ${p.thickness} мм + 2 мм кант${coveringTop ? ' на плота' : ''}.`
      }`,
    )
    if (coveringTop) {
      notes.push(
        'Плотът стърчи отпред — вратата/челото стига до долната му страна, кантът на плота остава видим.',
        'Плотът се хваща отвътре с 4 ъгълчета, без винтове 5×60 през горната страна.',
      )
    }
    notes.push(
      'Цокъл с канта надолу, дъното върху него, пробив отгоре през дъното. После дъното между страниците.',
      `Дъното е на ${p.plinthHeight} мм от земята. Долу опират само двете страници и цокълът.`,
      p.plinthCount === 1
        ? `1 цокъл ${p.plinthHeight} мм, ${m.plinthLength} мм, на ${PLINTH_INSET} мм навътре от предния кант на дъното.`
        : `2 цокъла ${p.plinthHeight} мм, ${m.plinthLength} мм, на ${PLINTH_INSET} мм навътре от предния и задния кант.`,
    )
  }

  const nPart = p.partitions?.length ?? 0
  const { partitions } = resolvePartitions(p.partitions ?? [], m.innerW, p.thickness)
  const columns = cabinetColumns(partitions, m.innerW, p.thickness)
  const bayCount = Math.max(1, columns.length)
  const bottomScrewsPerSide = confirmatCount(p.useLegs ? m.bottomD : m.sideD)
  const bottomScrewsTotal = bottomScrewsPerSide * 2
  const plinthScrewsEach = confirmatCount(m.plinthLength)
  const plinthScrewsTotal = p.useLegs ? 0 : plinthScrewsEach * p.plinthCount
  const topScrewsPerSide = confirmatCount(m.topD)
  const topScrewsTotal = topScrewsPerSide * 2
  const cornerBrackets = coveringTop ? 4 + 2 * nPart : 0
  const bracketScrews = cornerBrackets * 4

  if (innerTop) {
    notes.push(
      `Сглобяване: цокъл към дъно с ${plinthScrewsTotal} винта 5×60 (${plinthScrewsEach} на цокъл),` +
        ` после дъното към страниците с ${bottomScrewsTotal} винта 5×60 (${bottomScrewsPerSide} на страница)` +
        (hasTopPanel
          ? `, плот към страниците с ${topScrewsTotal} винта 5×60 (${topScrewsPerSide} на страница).`
          : '.'),
    )
  } else {
    notes.push(
      p.useLegs
        ? `Сглобяване: дъното с ${bottomScrewsTotal} винта 5×60 отдолу (${bottomScrewsPerSide} на страница)` +
          (coveringTop ? `, плот с 4 ъгълчета × 4 винтчета 4×16 = ${bracketScrews} винтчета.` : '.')
        : `Сглобяване: цокъл към дъно с ${plinthScrewsTotal} винта 5×60 (${plinthScrewsEach} на цокъл),` +
          ` после дъното към страниците с ${bottomScrewsTotal} винта 5×60 (${bottomScrewsPerSide} на страница)` +
          (coveringTop ? `, плот с 4 ъгълчета × 4 винтчета 4×16 = ${bracketScrews} винтчета.` : '.'),
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
    ...(innerTop
      ? [
          fastenerLine(
            { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur },
            topScrewsTotal,
            `Плот — винтове през страниците (${topScrewsPerSide} на страница)`,
          ),
        ]
      : coveringTop
        ? [
            pricedLine(CORNER_BRACKET, cornerBrackets, 'Ъгълчета за плота'),
            fastenerLine(
              { ...SCREW_4X16, packPriceEur: hardwareSettings.smallScrew1000PackEur },
              bracketScrews,
              'Винтчета за ъгълчетата',
            ),
          ]
        : []),
  ]

  const panels: GeneratedPanel[] = [
    {
      role: 'side' as const,
      name: 'Страница',
      width: m.sideD,
      height: m.sideH,
      quantity: 2,
      canRotate: false,
      edges: edges({ top: innerTop || !hasTopPanel, bottom: !p.useLegs, left: true, right: false }, 'mm05'),
      note: p.useLegs
        ? `Кант 0.5 мм: предна${!hasTopPanel ? ' и горна' : ''}. Долната сяда в дъното. Дълбочина ${m.sideD} мм.`
        : innerTop
          ? `Кант 0.5 мм: предна, горна и долна (страниците захлупват плота и опират в земята). Дълбочина ${m.sideD} мм.`
          : hasTopPanel
            ? `Кант 0.5 мм: предна и долна (долу опира в земята). Дълбочина ${m.sideD} мм.`
            : `Кант 0.5 мм: предна, горна и долна (отворен корпус отгоре, долу опира в земята). Дълбочина ${m.sideD} мм.`,
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
    ...(hasTopPanel
      ? [
          {
            role: 'top' as const,
            name: 'Плот',
            width: m.topW,
            height: m.topD,
            quantity: 1,
            canRotate: false,
            edges: innerTop
              ? edges({ top: true })
              : edges({ top: true, left: true, right: true, bottom: false }),
            note: innerTop
              ? `Кант 2 мм: предна. Влиза между страниците (${m.topW} × ${m.topD} мм). Хваща се с 5×60 през страниците.`
              : 'Кант 2 мм: предна и две странични. Седи отгоре върху страниците. Хваща се с ъгълчета отвътре.',
          } satisfies GeneratedPanel,
        ]
      : []),
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

  if (p.topStyle === 'fascia') {
    appendHangingFascias(
      {
        columns,
        railWidth: p.railWidth,
        fallbackInnerW: m.innerW,
        hardwareSettings,
      },
      panels,
      hardware,
      notes,
    )
  }

  const interior = appendZonedInterior(
    {
      fittings: p,
      innerW: m.innerW,
      innerH: m.innerH,
      sideD: m.sideD,
      sideH: m.innerH,
      thickness: p.thickness,
      width: p.width,
      overlayCovers: m.sliding
        ? { top: false, bottom: false }
        : { top: m.frontCoversTop, bottom: m.frontCoversBottom },
      coveringBottom: p.useLegs,
      innerTop,
      partitionD: m.partitionD,
      shelfD: m.shelfD,
      frontHeight: m.sliding ? m.innerH : m.frontHeight,
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
    hasFrontFascia: p.topStyle === 'fascia',
    frontFasciaCount: bayCount,
    hasTop: hasTopPanel,
    topWithCorners: coveringTop,
    plinthCount: p.useLegs ? 0 : p.plinthCount,
    hasBack: p.hasBack,
    shelfCount: interior.shelfCount,
    doorCount: m.sliding ? 0 : interior.doorCount,
    drawerCount: interior.drawerCount,
    hasClothesRail: interior.clothesRailCount > 0,
    clothesRailCount: interior.clothesRailCount,
    clothesRailLengthMm: m.innerW,
    fixedShelfCount: interior.fixedShelfCount,
    partitionCount: interior.partitionCount,
    softCloseDrawers: isSoftCloseSlide(p.slideKind),
    externalDoors: p.externalDoors === true || hardwareSettings.externalDoors,
    skipEdgeFinishing: omitsCuttingEdgingLabor(hardwareSettings),
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
