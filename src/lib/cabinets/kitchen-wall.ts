import { parsePartColors, DEFAULT_PART_COLORS } from './colors'
import {
  confirmatCount,
  fastenerLine,
  isSoftCloseSlide,
  SCREW_5X60,
} from './hardware'
import { KITCHEN_WALL_JOINERY, measureCarcass } from './joinery'
import { appendHardboard, appendZonedInterior, parseInteriorFittings } from './fronts'
import {
  DEFAULT_PANEL_THICKNESS,
  DEFAULT_SHELF_FRONT_INSET,
  emptyLabor,
  edges,
  panelHoleFits,
  panelHoleNote,
  type CabinetGeneratorResult,
  type CabinetTypeDefinition,
  type GeneratedPanel,
  type PanelHole,
} from './types'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import {
  collectCabinetAssembly,
  type AssemblyTimeSettings,
} from '@/lib/assembly-time'
import { DEFAULT_ASSEMBLY_TIME_SETTINGS } from '@/lib/assembly-time'
import type { CabinetPartColors } from './colors'
import type { InteriorFittings } from './fronts'

export const KITCHEN_WALL_TYPE_ID = 'kitchen-wall'

export const DEFAULT_HOOD_DIAMETER_MM = 150
export const DEFAULT_HOOD_RECT_W_MM = 250
export const DEFAULT_HOOD_RECT_D_MM = 170

export type HoodShape = 'round' | 'rect'

export interface KitchenWallParams extends InteriorFittings {
  width: number
  height: number
  depth: number
  thickness: number
  hasHood: boolean
  hoodShape: HoodShape
  /** Round opening on the bottom, and the duct hole on shelves. */
  hoodDiameter: number
  hoodRectW: number
  hoodRectD: number
  colors: CabinetPartColors
}

export const DEFAULT_KITCHEN_WALL_PARAMS: KitchenWallParams = {
  width: 600,
  height: 720,
  depth: 320,
  thickness: DEFAULT_PANEL_THICKNESS,
  hasHood: false,
  hoodShape: 'round',
  hoodDiameter: DEFAULT_HOOD_DIAMETER_MM,
  hoodRectW: DEFAULT_HOOD_RECT_W_MM,
  hoodRectD: DEFAULT_HOOD_RECT_D_MM,
  shelfCount: 0,
  hasBack: true,
  doorCount: 0,
  drawerFrontHeights: [],
  cutFromOneBoard: false,
  includeHandles: true,
  hasClothesRail: false,
  slideKind: 'roller',
  slideLength: 250,
  fixedShelves: [],
  partitions: [],
  doorSpan: 'full',
  zones: {},
  colors: { ...DEFAULT_PART_COLORS },
}

function parseHoodShape(raw: unknown): HoodShape {
  return raw === 'rect' ? 'rect' : 'round'
}

export function parseKitchenWallParams(raw: Record<string, unknown>): KitchenWallParams {
  const d = DEFAULT_KITCHEN_WALL_PARAMS
  const num = (key: keyof KitchenWallParams, fallback: number) => {
    const v = raw[key]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
  }
  const depth = num('depth', d.depth)
  return {
    width: num('width', d.width),
    height: num('height', d.height),
    depth,
    thickness: num('thickness', d.thickness),
    hasHood: raw.hasHood === true,
    hoodShape: parseHoodShape(raw.hoodShape),
    hoodDiameter: num('hoodDiameter', d.hoodDiameter),
    hoodRectW: num('hoodRectW', d.hoodRectW),
    hoodRectD: num('hoodRectD', d.hoodRectD),
    ...parseInteriorFittings(raw, depth),
    hasBack: typeof raw.hasBack === 'boolean' ? raw.hasBack : d.hasBack,
    colors: parsePartColors(raw.colors),
  }
}

export function wallBottomHole(p: KitchenWallParams, panelW: number, panelD: number): PanelHole | undefined {
  if (!p.hasHood) return undefined
  const hole: PanelHole =
    p.hoodShape === 'rect'
      ? { kind: 'rect', width: p.hoodRectW, height: p.hoodRectD }
      : { kind: 'round', diameter: p.hoodDiameter }
  return panelHoleFits(panelW, panelD, hole) ? hole : undefined
}

/** Shelves above the hood always get a round duct hole. */
export function wallShelfHole(p: KitchenWallParams, panelW: number, panelD: number): PanelHole | undefined {
  if (!p.hasHood) return undefined
  const hole: PanelHole = { kind: 'round', diameter: p.hoodDiameter }
  return panelHoleFits(panelW, panelD, hole) ? hole : undefined
}

export function generateKitchenWall(
  raw: Record<string, unknown>,
  settings?: unknown,
): CabinetGeneratorResult {
  const hardwareSettings = (settings as { hardware?: HardwareSettings; assemblyTime?: AssemblyTimeSettings })?.hardware ?? DEFAULT_HARDWARE_SETTINGS
  const assemblyTimeSettings = (settings as { hardware?: HardwareSettings; assemblyTime?: AssemblyTimeSettings })?.assemblyTime ?? DEFAULT_ASSEMBLY_TIME_SETTINGS
  const p = parseKitchenWallParams(raw)
  const m = measureCarcass(
    { width: p.width, height: p.height, depth: p.depth, thickness: p.thickness },
    KITCHEN_WALL_JOINERY,
  )

  const perEnd = confirmatCount(m.sideD)
  const bottomScrews = perEnd * 2
  const topScrews = perEnd * 2
  const bottomHole = wallBottomHole(p, m.bottomW, m.bottomD)
  const shelfDepth = Math.max(p.thickness, m.sideD - DEFAULT_SHELF_FRONT_INSET)
  const shelfHole = wallShelfHole(p, m.innerW, shelfDepth)

  const notes: string[] = [
    `Горен шкаф ${p.width} × ${p.height} × ${p.depth} мм, плоскост ${p.thickness} мм. Без крачета — окачва се на стената.`,
    `Страниците са външни: дъното и плотът влизат между тях (${m.bottomW} мм).`,
    'Кант: страници — горе, долу и отпред; плот, дъно и рафтове — само отпред.',
    `Сглобяване с винтове ${SCREW_5X60.name}: ${bottomScrews} на дъното и ${topScrews} на плота (${perEnd} на страница).`,
  ]

  if (p.hasHood) {
    if (bottomHole) {
      notes.push(
        p.hoodShape === 'rect'
          ? `Абсорбатор: ${panelHoleNote(bottomHole)} На рафтовете над него — кръгъл отвор Ø${Math.round(p.hoodDiameter)} мм за въздуховода.`
          : `Абсорбатор: ${panelHoleNote(bottomHole)} Същият кръгъл отвор минава и през рафтовете над него.`,
      )
    } else {
      notes.push(
        'Абсорбаторът е включен, но отворът не събира в дъното — увеличи шкафа или намалели отвора.',
      )
    }
    if (p.shelfCount + (p.fixedShelves?.length ?? 0) > 0 && !shelfHole) {
      notes.push('Отвор Ø' + Math.round(p.hoodDiameter) + ' мм не събира в рафтовете.')
    }
  }

  const hardware = [
    fastenerLine(
      { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur },
      bottomScrews,
      `Дъно — винтове през страниците (${perEnd} на страница)`,
    ),
    fastenerLine(
      { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur },
      topScrews,
      `Плот — винтове през страниците (${perEnd} на страница)`,
    ),
  ]

  const panels: GeneratedPanel[] = [
    {
      role: 'side',
      name: 'Страница',
      width: m.sideD,
      height: m.sideH,
      quantity: 2,
      canRotate: false,
      edges: edges({ top: true, bottom: true, left: true }),
      note: 'Кант: предна, горна и долна. Страницата захлупва плота и дъното.',
    },
    {
      role: 'bottom',
      name: 'Дъно',
      width: m.bottomW,
      height: m.bottomD,
      quantity: 1,
      canRotate: false,
      edges: edges({ top: true }),
      note: bottomHole
        ? `Кант: предна. Влиза между страниците (${m.bottomW} мм). ${panelHoleNote(bottomHole)}`
        : `Кант: предна. Влиза между страниците (${m.bottomW} мм).`,
      hole: bottomHole,
    },
    {
      role: 'top',
      name: 'Плот',
      width: m.railLength,
      height: m.sideD,
      quantity: 1,
      canRotate: false,
      edges: edges({ top: true }),
      note: `Кант: предна. Влиза между страниците (${m.railLength} мм). Хваща се с 5×60 през страниците.`,
    },
  ]

  const interior = appendZonedInterior(
    {
      fittings: p,
      innerW: m.innerW,
      innerH: m.innerH,
      sideD: m.sideD,
      sideH: m.innerH,
      thickness: p.thickness,
      width: p.width,
      frontHeight: p.height,
      coveringBottom: false,
      innerTop: true,
      overlayCovers: { top: true, bottom: true },
      shelfHole,
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
    hasLegs: false,
    hasTopRails: false,
    hasTop: true,
    isWallCabinet: true,
    plinthCount: 0,
    hasBack: p.hasBack,
    shelfCount: interior.shelfCount,
    doorCount: interior.doorCount,
    drawerCount: interior.drawerCount,
    hasClothesRail: interior.clothesRailCount > 0,
    clothesRailCount: interior.clothesRailCount,
    clothesRailLengthMm: m.innerW,
    fixedShelfCount: interior.fixedShelfCount,
    partitionCount: interior.partitionCount,
    softCloseDrawers: isSoftCloseSlide(p.slideKind),
  })

  return {
    joinery: KITCHEN_WALL_JOINERY,
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

export const kitchenWallType: CabinetTypeDefinition = {
  id: KITCHEN_WALL_TYPE_ID,
  name: 'Горен кухненски шкаф',
  category: 'kitchen-wall',
  description:
    'Окачен корпус: страниците захлупват плота и дъното. По избор фазер, рафтове, врати и отвор за абсорбатор.',
  defaultParams: { ...DEFAULT_KITCHEN_WALL_PARAMS },
  generate: generateKitchenWall,
}
