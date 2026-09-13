import { parsePartColors, DEFAULT_PART_COLORS } from './colors'
import {
  fastenerLine,
  KITCHEN_BASE_SCREWS_BOTTOM,
  KITCHEN_BASE_SCREWS_RAILS,
  KITCHEN_BASE_SCREWS_TOTAL,
  SCREW_5X60,
} from './hardware'
import { KITCHEN_BASE_JOINERY, measureCarcass } from './joinery'
import { appendHardboard, appendZonedInterior, parseInteriorFittings } from './fronts'
import {
  DEFAULT_LEG_HEIGHT,
  DEFAULT_PANEL_THICKNESS,
  DEFAULT_RAIL_WIDTH,
  emptyLabor,
  edges,
  type CabinetGeneratorResult,
  type CabinetTypeDefinition,
  type GeneratedPanel,
  type KitchenBaseParams,
} from './types'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import {
  collectCabinetAssembly,
  type AssemblyTimeSettings,
} from '@/lib/assembly-time'
import { DEFAULT_ASSEMBLY_TIME_SETTINGS } from '@/lib/assembly-time'

export const KITCHEN_BASE_TYPE_ID = 'kitchen-base'

export const DEFAULT_KITCHEN_BASE_PARAMS: KitchenBaseParams = {
  width: 600,
  height: 720,
  depth: 560,
  thickness: DEFAULT_PANEL_THICKNESS,
  legHeight: DEFAULT_LEG_HEIGHT,
  railWidth: DEFAULT_RAIL_WIDTH,
  shelfCount: 0,
  hasBack: true,
  doorCount: 0,
  drawerFrontHeights: [],
  cutFromOneBoard: false,
  includeHandles: true,
  hasClothesRail: false,
  slideKind: 'roller',
  slideLength: 500,
  fixedShelves: [],
  doorSpan: 'full',
  zones: {},
  colors: { ...DEFAULT_PART_COLORS },
}

export function parseKitchenBaseParams(raw: Record<string, unknown>): KitchenBaseParams {
  const d = DEFAULT_KITCHEN_BASE_PARAMS
  const num = (key: keyof KitchenBaseParams, fallback: number) => {
    const v = raw[key]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
  }
  const leg = num('legHeight', d.legHeight)
  const depth = num('depth', d.depth)
  const fittings = parseInteriorFittings(raw, depth)
  return {
    width: num('width', d.width),
    height: num('height', d.height),
    depth,
    thickness: num('thickness', d.thickness),
    legHeight: leg === 150 ? 150 : 100,
    railWidth: num('railWidth', d.railWidth),
    ...fittings,
    hasBack: typeof raw.hasBack === 'boolean' ? raw.hasBack : false,
    colors: parsePartColors(raw.colors),
  }
}

export function generateKitchenBase(
  raw: Record<string, unknown>,
  settings?: unknown,
): CabinetGeneratorResult {
  const hardwareSettings = (settings as { hardware?: HardwareSettings; assemblyTime?: AssemblyTimeSettings })?.hardware ?? DEFAULT_HARDWARE_SETTINGS
  const assemblyTimeSettings = (settings as { hardware?: HardwareSettings; assemblyTime?: AssemblyTimeSettings })?.assemblyTime ?? DEFAULT_ASSEMBLY_TIME_SETTINGS
  const p = parseKitchenBaseParams(raw)
  const m = measureCarcass(
    { width: p.width, height: p.height, depth: p.depth, thickness: p.thickness },
    KITCHEN_BASE_JOINERY,
  )

  const notes: string[] = [
    `Корпус ${p.width} × ${p.height} × ${p.depth} мм, плоскост ${p.thickness} мм.`,
    `Крачета ${p.legHeight} мм — обща височина от пода ${p.height + p.legHeight} мм.`,
    'Дъното покрива страниците: страниците сядат върху дъното, винтовете се виждат отдолу.',
    'Блендите влизат между страниците горе — по една отпред и отзад.',
    `Сглобяване с винтове ${SCREW_5X60.name}: ${KITCHEN_BASE_SCREWS_BOTTOM} на дъното и ${KITCHEN_BASE_SCREWS_RAILS} за блендите (${KITCHEN_BASE_SCREWS_TOTAL} бр.).`,
  ]

  if (p.depth < p.railWidth * 2) {
    notes.push('Внимание: дълбочината е по-малка от двете бленди една до друга.')
  }

  const hardware = [
    { name: `Краче ${p.legHeight} мм`, quantity: 4 },
    fastenerLine(
      { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur },
      KITCHEN_BASE_SCREWS_BOTTOM,
      'Дъно — винтове отдолу',
    ),
    fastenerLine(
      { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur },
      KITCHEN_BASE_SCREWS_RAILS,
      'Бленди горе',
    ),
  ]
  const panels: GeneratedPanel[] = [
    {
      role: 'bottom' as const,
      name: 'Дъно',
      width: m.bottomW,
      height: m.bottomD,
      quantity: 1,
      canRotate: false,
      edges: edges({ top: true, left: true, right: true }),
      note: 'Кант: предна + двете страни. Задната не се кантира.',
    },
    {
      role: 'side' as const,
      name: 'Страница',
      width: m.sideD,
      height: m.sideH,
      quantity: 2,
      canRotate: false,
      edges: edges({ top: true, left: true }),
      note: 'Кант: предна и горна. Долната сяда в дъното, задната не се вижда.',
    },
    {
      role: 'rail' as const,
      name: 'Бленда',
      width: m.railLength,
      height: p.railWidth,
      quantity: 2,
      canRotate: false,
      edges: edges({ top: true }),
      note: 'Кант: едната дълга страна. Предна и задна бленда са еднакви.',
    },
  ]

  const interior = appendZonedInterior(
    {
      fittings: p,
      innerW: m.innerW,
      innerH: m.innerH,
      sideD: m.sideD,
      thickness: p.thickness,
      width: p.width,
      frontHeight: p.height,
    },
    panels,
    hardware,
    notes,
    hardwareSettings,
  )

  if (p.hasBack) {
    appendHardboard({ width: p.width, height: p.height }, panels, notes)
  }

  const assembly = collectCabinetAssembly({
    settings: assemblyTimeSettings,
    panels,
    width: p.width,
    height: p.height,
    depth: p.depth,
    hasLegs: p.legHeight > 0,
    hasTopRails: true,
    hasTop: false,
    plinthCount: 0,
    hasBack: p.hasBack,
    shelfCount: interior.shelfCount,
    doorCount: interior.doorCount,
    drawerCount: interior.drawerCount,
    hasClothesRail: interior.clothesRailCount > 0,
    clothesRailCount: interior.clothesRailCount,
    clothesRailLengthMm: p.width - 2 * p.thickness,
    fixedShelfCount: interior.fixedShelfCount,
  })

  return {
    joinery: KITCHEN_BASE_JOINERY,
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

export const kitchenBaseType: CabinetTypeDefinition = {
  id: KITCHEN_BASE_TYPE_ID,
  name: 'Долен кухненски шкаф',
  category: 'kitchen-base',
  description:
    'Корпус на крачета. По избор фазер, врати и чекмеджета с различни височини.',
  defaultParams: { ...DEFAULT_KITCHEN_BASE_PARAMS },
  generate: generateKitchenBase,
}
