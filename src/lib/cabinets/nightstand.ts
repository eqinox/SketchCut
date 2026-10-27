import { parsePartColors, DEFAULT_PART_COLORS } from './colors'
import {
  isSoftCloseSlide,
  confirmatCount,
  defaultSlideLength,
  fastenerLine,
  pricedLine,
  SCREW_5X60,
  SCREW_4X16,
  SLIDE_REAR_CLEARANCE_MM,
  slideRunnerDepth,
} from './hardware'
import {
  DEFAULT_LEG_HEIGHT,
  DEFAULT_PANEL_THICKNESS,
  DEFAULT_RAIL_WIDTH,
  emptyLabor,
  edges,
  flushCarcassDepth,
  frontDoorOverhang,
  FASCIA_SETBACK_MM,
  TOP_EDGE_BAND_MM,
  kitchenClearInnerH,
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
  clothesRailLengthMm,
  shelfFrontInsetMm,
  shelfPanelDepth,
  type InteriorFittings,
} from './fronts'
import {
  CLOTHES_RAIL_SECTION_MM,
  DEFAULT_CLOTHES_RAIL_FROM_TOP_MM,
  MAX_CLOTHES_RAILS,
  MIN_CLOTHES_RAIL_TO_SHELF_MM,
  cabinetColumns,
  evenLowerRailY,
  fittingsCountsFromParams,
  resolvePartitions,
} from './zones'
import { SLIDING_PARTITION_SETBACK_MM, SLIDING_UPPER_TRACK_HEIGHT_MM } from './sliding-doors'
import { formatMm } from '../utils'
import type { RuleSection } from './rule-text'
export const NIGHTSTAND_TYPE_ID = 'nightstand'

/** Corner brackets holding an outer top from the inside. Extra ones at each divider. */
export const CORNER_BRACKETS = 4
export const CORNER_BRACKETS_PER_PARTITION = 2
export const SCREWS_PER_CORNER_BRACKET = 4

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
  movableShelves: [],
  hasBack: false,
  nailBack: false,
  doorCount: 0,
  doorStyle: 'hinged',
  slidingEdges: [],
  slidingDoorCount: 2,
  slidingUpperTrackColor: 'black',
  slidingLowerTrackColor: 'black',
  slidingHandleSkuId: '',
  slidingCapSkuId: '',
  slidingSoftCloseLeft: 1,
  slidingSoftCloseRight: 1,
  drawerFrontHeights: [],
  cutFromOneBoard: false,
  includeHandles: true,
  hasClothesRail: false,
  clothesRails: [],
  slideKind: 'roller',
  slideLength: 300,
  fixedShelves: [],
  partitions: [],
  doorSpan: 'full',
  zones: {},
  externalDoors: false,
  innerDrawerFronts: false,
  innerDoors: false,
  dimFontScale: 1,
  colors: { ...DEFAULT_PART_COLORS },
}

/**
 * Overlay door or drawer front sits in front of the sides.
 * Inner fronts and an open cabinet do not, so the sides keep the full depth.
 */
export function plinthFrontOverhang(
  f: Parameters<typeof fittingsCountsFromParams>[0] & {
    doorStyle?: string
    innerDoors?: boolean
    innerDrawerFronts?: boolean
    depthMode?: 'without-door' | 'with-door' | 'no-doors'
  },
  thickness: number,
): number {
  if (f.doorStyle === 'sliding') return 0
  const counts = fittingsCountsFromParams(f)
  const overlayDoor = !f.innerDoors && counts.doorCount > 0
  const overlayDrawer = !f.innerDrawerFronts && counts.drawerCount > 0
  if (f.depthMode === 'with-door') {
    if (f.innerDoors && overlayDoor && !overlayDrawer) return 0
    return frontDoorOverhang(thickness)
  }
  if (f.depthMode === 'without-door' || f.depthMode === 'no-doors') {
    return overlayDrawer ? frontDoorOverhang(thickness) : 0
  }
  return overlayDoor || overlayDrawer ? frontDoorOverhang(thickness) : 0
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
  const provisional = parseInteriorFittings(raw, Math.max(thickness, depth))
  const boxDepth = sliding ? depth : flushCarcassDepth(depth, thickness, provisional.depthMode)
  const sideD = Math.max(thickness, boxDepth - plinthFrontOverhang(provisional, thickness))
  const partitionD = sliding ? Math.max(thickness, sideD - SLIDING_PARTITION_SETBACK_MM) : sideD
  const overlayFront =
    sliding && !provisional.innerDrawerFronts && provisional.drawerFrontHeights.some((h) => h > 0)
      ? frontDoorOverhang(thickness)
      : 0
  const slideDepth = slideRunnerDepth(sliding ? partitionD : sideD, sliding, overlayFront)
  const fittings =
    slideDepth === Math.max(thickness, depth) ? provisional : parseInteriorFittings(raw, slideDepth)
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
    ...fittings,
    colors: parsePartColors(raw.colors),
  }
}

export function measureNightstand(p: NightstandParams, topInner = false) {
  const T = p.thickness
  const hasTopPanel = p.topStyle === 'panel'
  const coveringTop = hasTopPanel && !topInner
  const innerTopPanel = hasTopPanel && topInner
  const sliding = p.doorStyle === 'sliding'
  const boxDepth = sliding ? p.depth : flushCarcassDepth(p.depth, T, p.depthMode)
  const frontOverhang = plinthFrontOverhang(p, T)
  const sideD = Math.max(T, boxDepth - frontOverhang)
  const partitionD = sliding ? Math.max(T, sideD - SLIDING_PARTITION_SETBACK_MM) : sideD
  const shelfD = shelfPanelDepth(sliding ? partitionD : sideD, T, shelfFrontInsetMm(p))
  const topW = innerTopPanel ? p.width - 2 * T : p.width
  const topD = innerTopPanel ? sideD : boxDepth
  const bottomW = p.useLegs ? p.width : p.width - 2 * T
  const bottomD = p.useLegs ? boxDepth : sideD
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

function sideDepthNote(
  p: NightstandParams,
  m: ReturnType<typeof measureNightstand>,
  coveringTop: boolean,
): string {
  if (m.sliding) {
    return `Дълбочината ${p.depth} мм е заедно с плъзгащите врати. Страниците са ${m.sideD} мм. Вътрешните страници и разделителите са ${m.partitionD} мм и почват ${SLIDING_PARTITION_SETBACK_MM} мм навътре. Рафтовете са ${m.shelfD} мм.`
  }
  if (m.frontOverhang > 0) {
    return `Страниците са ${m.sideD} мм дълбоки — общата дълбочина ${p.depth} мм включва врата/чело ${p.thickness} мм + 2 мм кант${coveringTop ? ' на плота' : ''}.`
  }
  return `Страниците са ${m.sideD} мм дълбоки — без наложена врата и чело отпред, дълбочината ${p.depth} мм е на корпуса.`
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
      sideDepthNote(p, m, coveringTop),
    )
    if (coveringTop) {
      notes.push(`Плотът е външен върху страниците (${m.topW} × ${m.topD} мм).`)
      if (m.frontOverhang > 0) {
        notes.push(
          'Плотът и дъното стърчат отпред — вратата/челото стига до долната страна на плота и до горната на дъното, кантовете остават видими.',
        )
      }
      notes.push(`Плотът се хваща отвътре с ${CORNER_BRACKETS} ъгълчета, без винтове 5×60 през горната страна.`)
    } else if (m.frontOverhang > 0) {
      notes.push('Дъното стърчи отпред — вратата/челото стига до горната му страна, кантът остава видим.')
    }
    notes.push(`4 крачета ${p.legHeight} мм под дъното. Винтове 5×60 отдолу през дъното в страниците.`)
  } else if (opts.topInner) {
    notes.push(
      hasTopPanel
        ? `Страниците са външни на дъното и на плота (${m.bottomW} мм между тях). Плотът влиза между страниците (${m.topW} × ${m.topD} мм).`
        : `Страниците са външни на дъното (${m.bottomW} мм между тях). Без плот — отворен корпус отгоре.`,
      sideDepthNote(p, m, false),
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
      sideDepthNote(p, m, coveringTop),
    )
    if (coveringTop) {
      if (m.frontOverhang > 0) {
        notes.push('Плотът стърчи отпред — вратата/челото стига до долната му страна, кантът на плота остава видим.')
      }
      notes.push(`Плотът се хваща отвътре с ${CORNER_BRACKETS} ъгълчета, без винтове 5×60 през горната страна.`)
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
  const cornerBrackets = coveringTop ? CORNER_BRACKETS + CORNER_BRACKETS_PER_PARTITION * nPart : 0
  const bracketScrews = cornerBrackets * SCREWS_PER_CORNER_BRACKET

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
          (coveringTop ? `, плот с ${cornerBrackets} ъгълчета × ${SCREWS_PER_CORNER_BRACKET} винтчета 4×16 = ${bracketScrews} винтчета.` : '.')
        : `Сглобяване: цокъл към дъно с ${plinthScrewsTotal} винта 5×60 (${plinthScrewsEach} на цокъл),` +
          ` после дъното към страниците с ${bottomScrewsTotal} винта 5×60 (${bottomScrewsPerSide} на страница)` +
          (coveringTop ? `, плот с ${cornerBrackets} ъгълчета × ${SCREWS_PER_CORNER_BRACKET} винтчета 4×16 = ${bracketScrews} винтчета.` : '.'),
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

  const sideEdges = edges(
    { top: innerTop || !hasTopPanel, bottom: !p.useLegs, left: true, right: false },
    'mm05',
  )
  if (m.sliding) sideEdges.sideThickness = { left: 'mm2' }
  const sideNote = m.sliding
    ? p.useLegs
      ? `Кант 2 мм: предна (вратата се удря в страницата)${!hasTopPanel ? '. Кант 0.5 мм: горна' : ''}. Долната сяда в дъното. Дълбочина ${m.sideD} мм.`
      : innerTop
        ? `Кант 2 мм: предна (вратата се удря в страницата). Кант 0.5 мм: горна и долна (страниците захлупват плота и опират в земята). Дълбочина ${m.sideD} мм.`
        : hasTopPanel
          ? `Кант 2 мм: предна (вратата се удря в страницата). Кант 0.5 мм: долна (долу опира в земята). Дълбочина ${m.sideD} мм.`
          : `Кант 2 мм: предна (вратата се удря в страницата). Кант 0.5 мм: горна и долна (отворен корпус отгоре, долу опира в земята). Дълбочина ${m.sideD} мм.`
    : p.useLegs
      ? `Кант 0.5 мм: предна${!hasTopPanel ? ' и горна' : ''}. Долната сяда в дъното. Дълбочина ${m.sideD} мм.`
      : innerTop
        ? `Кант 0.5 мм: предна, горна и долна (страниците захлупват плота и опират в земята). Дълбочина ${m.sideD} мм.`
        : hasTopPanel
          ? `Кант 0.5 мм: предна и долна (долу опира в земята). Дълбочина ${m.sideD} мм.`
          : `Кант 0.5 мм: предна, горна и долна (отворен корпус отгоре, долу опира в земята). Дълбочина ${m.sideD} мм.`
  const panels: GeneratedPanel[] = [
    {
      role: 'side' as const,
      name: 'Страница',
      width: m.sideD,
      height: m.sideH,
      quantity: 2,
      canRotate: false,
      edges: sideEdges,
      note: sideNote,
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
        dividerCentersMm: interior.backNails.dividerCentersMm,
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
    nailBack: p.nailBack === true,
    backDividerCentersMm: interior.backNails.dividerCentersMm,
    backPartialLengthsMm: interior.backNails.partialLengthsMm,
    backShelfLengthsMm: interior.backNails.shelfLengthsMm,
    backPlinthMm: p.useLegs ? 0 : p.plinthHeight,
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
    slidingDoorCount: m.sliding && interior.doorCount === 2 ? 2 : 0,
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

export function depthRuleSection(): RuleSection {
  const T = DEFAULT_PANEL_THICKNESS
  const depth = 400
  const overhang = frontDoorOverhang(T)
  const flush = flushCarcassDepth(depth, T, 'with-door')
  const withDoor = plinthFrontOverhang({ doorCount: 1, doorStyle: 'hinged', depthMode: 'with-door', shelfCount: 0, drawerFrontHeights: [] }, T)
  const withoutDoor = plinthFrontOverhang({ doorCount: 1, doorStyle: 'hinged', depthMode: 'without-door', shelfCount: 0, drawerFrontHeights: [] }, T)
  const drawersOnly = plinthFrontOverhang(
    { doorCount: 0, doorStyle: 'hinged', depthMode: 'without-door', shelfCount: 0, drawerFrontHeights: [150] },
    T,
  )
  const slidingDepth = 590
  const slidingBox = measureNightstand(
    {
      ...DEFAULT_NIGHTSTAND_PARAMS,
      depth: slidingDepth,
      doorStyle: 'sliding',
      doorCount: 2,
      depthMode: 'with-door',
    },
    true,
  )
  const frontMm = frontDoorOverhang(T)
  const innerRunner = slideRunnerDepth(slidingBox.partitionD, true, 0)
  const overlayRunner = slideRunnerDepth(slidingBox.partitionD, true, frontMm)
  const innerSlide = defaultSlideLength(innerRunner, 'roller')
  const overlaySlide = defaultSlideLength(overlayRunner, 'roller')
  return {
    id: 'depth',
    title: 'Дълбочина',
    blocks: [
      {
        title: 'Трите отметки',
        lines: [
          'Записаната дълбочина е числото, което си написал. От него не се вади нищо предварително.',
          `„Заедно с вратата“: наложената врата стърчи с ${formatMm(overhang)} мм (дебелина ${T} + кант ${TOP_EDGE_BAND_MM}). При нощно страниците стават дълбочина − ${formatMm(withDoor)}. При кухня корпусът става ${formatMm(flush)} мм, ако е написано ${depth}.`,
          `„Без вратата“: числото е корпусът. Наложена врата на панти не скъсява страниците (вади се ${formatMm(withoutDoor)} мм). Наложено чело вади ${formatMm(drawersOnly)} мм.`,
          '„Шкафът е без врати“: броят врати става 0. Страниците са с пълната дълбочина, освен ако има наложени чела.',
          'Стар шкаф без тази отметка: ако има наложена врата, се смята като „заедно с вратата“.',
        ],
      },
      {
        title: 'Плъзгащи врати',
        lines: [
          'Написаната дълбочина е заедно с механизма. Трите отметки не се сменят.',
          `Вътрешните страници са с ${SLIDING_PARTITION_SETBACK_MM} мм по-плитки. При ${slidingDepth} мм те са ${formatMm(slidingBox.partitionD)} мм, а външните страници остават ${formatMm(slidingBox.sideD)} мм.`,
          `Разделителят почва от вътрешната страница. Рафтът е още ${formatMm(slidingBox.partitionD - slidingBox.shelfD)} мм по-навътре (${formatMm(slidingBox.shelfD)} мм).`,
          `Водачът също ляга на вътрешната страница (${formatMm(slidingBox.partitionD)} мм) и спира ${SLIDE_REAR_CLEARANCE_MM} мм преди задния ръб. Влиза до ${formatMm(innerRunner)} мм, затова най-дългият е ${formatMm(innerSlide)} мм.`,
          `Външно чело вади още ${formatMm(frontMm)} мм. Тогава водачът влиза до ${formatMm(overlayRunner)} мм и най-дългият е ${formatMm(overlaySlide)} мм.`,
        ],
      },
    ],
  }
}

export function carcassRuleSection(): RuleSection {
  const sample = {
    ...DEFAULT_NIGHTSTAND_PARAMS,
    width: 500,
    height: 500,
    depth: 400,
    topStyle: 'panel' as const,
    doorCount: 0 as const,
    depthMode: 'no-doors' as const,
  }
  const box = measureNightstand(sample, false)
  const section = measureNightstand(sample, true)
  const kitchenH = 720
  const T = sample.thickness
  return {
    id: 'carcass',
    title: 'Корпус',
    blocks: [
      {
        title: 'Кой захлупва кого',
        lines: [
          `Външна плоскост захлупва вътрешна. Пример широчина ${sample.width} мм: вътрешната е ${formatMm(box.innerW)} мм.`,
          `Външен плот: ${CORNER_BRACKETS} ъгълчета отвътре, по ${SCREWS_PER_CORNER_BRACKET} винтчета 4×16. На всеки разделител още ${CORNER_BRACKETS_PER_PARTITION}.`,
          'Вътрешен плот се хваща с 5×60 през страниците, без ъгълчета.',
        ],
      },
      {
        title: 'Нощно шкафче',
        lines: [
          `По подразбиране: 2 външни страници, вътрешно дъно ${formatMm(box.bottomW)} мм широко, външен плот ${formatMm(box.topW)} × ${formatMm(box.topD)} мм.`,
          'С крачета дъното е външно, страниците влизат в него, винтовете 5×60 са отдолу.',
          'Или цокъл, или крачета — не и двете.',
        ],
      },
      {
        title: 'Секция и гардероб',
        lines: [
          `Секция: плотът е вътрешен, ${formatMm(section.topW)} мм при широчина ${sample.width} (широчина − 2 × дебелина).`,
          'Гардеробът с плъзгащи врати е същата конструкция. Разделителите са по-плитки заради релсата.',
        ],
      },
      {
        title: 'Кухня',
        lines: [
          'Долният шкаф: дъното захлупва страниците. От пода е височината на корпуса плюс крачетата.',
          `Крачета по подразбиране ${DEFAULT_LEG_HEIGHT} мм.`,
          `Височина ${kitchenH} мм: две бленди дават светъл отвор ${formatMm(kitchenClearInnerH(kitchenH, T, 'rails'))} мм, една бленда или плот — ${formatMm(kitchenClearInnerH(kitchenH, T, 'panel'))} мм.`,
          `Блендата е висока ${DEFAULT_RAIL_WIDTH} мм. Бленда надолу е ${FASCIA_SETBACK_MM} мм навътре от предния край.`,
          'Горен шкаф: страниците са външни. Дъното и плотът влизат между тях и се хващат с 5×60.',
        ],
      },
      {
        title: 'Цокъл',
        lines: [
          `Цокълът е между страниците, на ${PLINTH_INSET} мм навътре от канта на дъното. При широчина ${sample.width} мм е дълъг ${formatMm(box.plinthLength)} мм.`,
          'Един цокъл е отпред. Два са отпред и отзад.',
        ],
      },
    ],
  }
}

export function clothesRailRuleSection(): RuleSection {
  const sample = {
    ...DEFAULT_NIGHTSTAND_PARAMS,
    width: 2000,
    height: 2400,
    depth: 600,
    plinthHeight: 100,
    topStyle: 'panel' as const,
    doorStyle: 'sliding' as const,
    doorCount: 2 as const,
    depthMode: 'with-door' as const,
  }
  const measured = measureNightstand(sample, true)
  const yUpper = measured.innerH - DEFAULT_CLOTHES_RAIL_FROM_TOP_MM
  const floorDrop = measured.supportH + sample.thickness
  const yLower = evenLowerRailY(yUpper, floorDrop) ?? 0
  const pairGap = yUpper - yLower
  return {
    id: 'rail',
    title: 'Лост за дрехи',
    blocks: [
      {
        title: 'Къде се мери',
        lines: [
          `По подразбиране ${DEFAULT_CLOTHES_RAIL_FROM_TOP_MM} мм от долната страна на плоскостта над отвора до горната страна на лоста.`,
          `Тръбата е ${CLOTHES_RAIL_SECTION_MM} мм. Дължината при широчина ${sample.width} мм е ${formatMm(clothesRailLengthMm(sample.width, sample.thickness))} мм.`,
          `Рафт над лоста е поне ${MIN_CLOTHES_RAIL_TO_SHELF_MM} мм над горната страна на лоста.`,
          `Най-много ${MAX_CLOTHES_RAILS} лоста в една част.`,
        ],
      },
      {
        title: '2 лоста на еднакво разстояние',
        lines: [
          `Горният лост остава на зададеното разстояние. Ако няма лост, се слага на ${DEFAULT_CLOTHES_RAIL_FROM_TOP_MM} мм отгоре.`,
          'Долният се слага така, че разстоянието от лост до лост е равно на разстоянието от долния лост до пода. Мери се до горната страна на тръбата.',
          `Пример гардероб ${sample.height} мм, цокъл ${sample.plinthHeight} мм, плоскост ${sample.thickness} мм: светъл отвор ${formatMm(measured.innerH)} мм, горен лост на ${formatMm(yUpper)} мм от дъното, до пода има още ${formatMm(floorDrop)} мм, долен лост на ${formatMm(yLower)} мм. Между лостовете и до пода: ${formatMm(pairGap)} мм.`,
          'Повторно натискане мести долния лост, не добавя трети.',
          `На чертежа при плъзгащи врати горният лост се рисува на ${SLIDING_UPPER_TRACK_HEIGHT_MM} мм под лайсната. Краищата опират в страниците или в разделителя. Числото ${DEFAULT_CLOTHES_RAIL_FROM_TOP_MM} си остава от плоскостта.`,
        ],
      },
    ],
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
