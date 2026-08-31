import { parsePartColors, DEFAULT_PART_COLORS } from './colors'
import {
  fastenerLine,
  KITCHEN_BASE_SCREWS_BOTTOM,
  KITCHEN_BASE_SCREWS_RAILS,
  KITCHEN_BASE_SCREWS_TOTAL,
  pricedLine,
  SCREW_5X60,
  SHELF_PIN,
  SHELF_PINS_PER_SHELF,
  HINGE_SOFT_CLOSE,
  HINGE_SCREW,
  SCREWS_PER_HINGE,
  HINGES_PER_SMALL_DOOR,
  fastenerUnitPriceEur,
} from './hardware'
import { evenShelfBottoms, KITCHEN_BASE_JOINERY, measureCarcass } from './joinery'
import {
  DEFAULT_HARDBOARD_THICKNESS,
  doorCutSize,
  drawerFrontCutSize,
  doorWithDrawerCutSize,
  parseDoorCount,
} from './materials'
import {
  DEFAULT_LEG_HEIGHT,
  DEFAULT_PANEL_THICKNESS,
  DEFAULT_RAIL_WIDTH,
  DEFAULT_SHELF_FRONT_INSET,
  emptyLabor,
  edges,
  type CabinetGeneratorResult,
  type CabinetTypeDefinition,
  type GeneratedPanel,
  type KitchenBaseParams,
} from './types'

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
  drawerFrontHeight: 0,
  cutFromOneBoard: false,
  colors: { ...DEFAULT_PART_COLORS },
}

export function parseKitchenBaseParams(raw: Record<string, unknown>): KitchenBaseParams {
  const d = DEFAULT_KITCHEN_BASE_PARAMS
  const num = (key: keyof KitchenBaseParams, fallback: number) => {
    const v = raw[key]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
  }
  const leg = num('legHeight', d.legHeight)
  return {
    width: num('width', d.width),
    height: num('height', d.height),
    depth: num('depth', d.depth),
    thickness: num('thickness', d.thickness),
    legHeight: leg === 150 ? 150 : 100,
    railWidth: num('railWidth', d.railWidth),
    shelfCount: parseShelfCount(raw.shelfCount),
    hasBack: typeof raw.hasBack === 'boolean' ? raw.hasBack : false,
    doorCount: parseDoorCount(raw.doorCount),
    drawerFrontHeight: typeof raw.drawerFrontHeight === 'number' && raw.drawerFrontHeight >= 0 ? raw.drawerFrontHeight : 0,
    cutFromOneBoard: typeof raw.cutFromOneBoard === 'boolean' ? raw.cutFromOneBoard : false,
    colors: parsePartColors(raw.colors),
  }
}

function parseShelfCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(3, Math.floor(n))
}

export function generateKitchenBase(raw: Record<string, unknown>): CabinetGeneratorResult {
  const p = parseKitchenBaseParams(raw)
  const m = measureCarcass(
    { width: p.width, height: p.height, depth: p.depth, thickness: p.thickness },
    KITCHEN_BASE_JOINERY,
  )

  const notes: string[] = [
    `Корпус ${p.width} × ${p.height} × ${p.depth} мм, плоскост ${p.thickness} мм.`,
    `Крачета ${p.legHeight} мм — обща височина от пода ${p.height + p.legHeight} мм.`,
    'Дъното покрива страниците: страниците сядат върху дъното, винтовете се виждат отдолу.',
    'Царгите влизат между страниците горе — по една отпред и отзад.',
    `Сглобяване с винтове ${SCREW_5X60.name}: ${KITCHEN_BASE_SCREWS_BOTTOM} на дъното и ${KITCHEN_BASE_SCREWS_RAILS} за царгите (${KITCHEN_BASE_SCREWS_TOTAL} бр.).`,
  ]

  if (p.depth < p.railWidth * 2) {
    notes.push('Внимание: дълбочината е по-малка от двете царги една до друга.')
  }

  const hardware = [
    { name: `Краче ${p.legHeight} мм`, quantity: 4 },
    fastenerLine(SCREW_5X60, KITCHEN_BASE_SCREWS_BOTTOM, 'Дъно — винтове отдолу'),
    fastenerLine(SCREW_5X60, KITCHEN_BASE_SCREWS_RAILS, 'Царги горе'),
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
      name: 'Царга',
      width: m.railLength,
      height: p.railWidth,
      quantity: 2,
      canRotate: false,
      edges: edges({ top: true }),
      note: 'Кант: едната дълга страна. Предна и задна царга са еднакви.',
    },
  ]

  if (p.shelfCount > 0) {
    const bottoms = evenShelfBottoms(m.innerH, p.shelfCount, p.thickness)
    const gap = bottoms[0] ?? 0
    const shelfDepth = m.sideD - DEFAULT_SHELF_FRONT_INSET
    notes.push(
      `${p.shelfCount} ${p.shelfCount === 1 ? 'рафт' : 'рафта'} с еднакви празнини по ${Math.round(gap)} мм.`,
    )
    notes.push(
      `Рафтът е с ${DEFAULT_SHELF_FRONT_INSET} мм по-къс от дълбочината (${shelfDepth} мм) — започва на 5 см отпред и стига дозад.`,
    )
    notes.push(
      `Рафтоносачи: ${p.shelfCount * SHELF_PINS_PER_SHELF} бр. (по ${SHELF_PINS_PER_SHELF} на рафт, 5 цента/бр.).`,
    )
    hardware.push(
      pricedLine(
        SHELF_PIN,
        p.shelfCount * SHELF_PINS_PER_SHELF,
        `по ${SHELF_PINS_PER_SHELF} на рафт`,
      ),
    )
    panels.push({
      role: 'shelf',
      name: 'Рафт',
      width: m.innerW,
      height: shelfDepth,
      quantity: p.shelfCount,
      canRotate: false,
      edges: edges({ top: true }),
      note: `Кант: предната видима страна. Дълбочина ${shelfDepth} мм (корпусът минус 50 мм отпред).`,
    })
  }

  if (p.hasBack) {
    notes.push(
      `Фазер ${DEFAULT_HARDBOARD_THICKNESS} мм на гърба: ${m.innerW} × ${m.sideH} мм, отделен разкрой.`,
    )
    panels.push({
      role: 'back',
      name: 'Фазер',
      width: m.innerW,
      height: m.sideH,
      quantity: 1,
      canRotate: true,
      edges: edges({}),
      material: 'hardboard',
      note: `Фазер ${DEFAULT_HARDBOARD_THICKNESS} мм. Без кант. Разкроява се отделно от ПДЧ.`,
    })
  }

  if (p.doorCount === 1 || p.doorCount === 2) {
    const hasDrawer = p.drawerFrontHeight > 0
    const door = hasDrawer 
      ? doorWithDrawerCutSize(p.width, p.height, p.drawerFrontHeight, p.doorCount)
      : doorCutSize(p.width, p.height, p.doorCount)
    const doorWord = p.doorCount === 1 ? 'една врата' : 'две врати'
    const totalHinges = p.doorCount * HINGES_PER_SMALL_DOOR
    const totalScrews = totalHinges * SCREWS_PER_HINGE
    const screwUnitPrice = fastenerUnitPriceEur(HINGE_SCREW)
    
    if (hasDrawer) {
      const drawerFront = drawerFrontCutSize(p.width, p.drawerFrontHeight)
      
      if (p.cutFromOneBoard) {
        notes.push(
          `Чекмедже + врата: рязане от една плоча за продължена фладера. Първо рязане: ${Math.round(drawerFront.width)} × ${Math.round(drawerFront.height + door.height + 3)} мм. След кантиране се реже отново.`,
        )
      }
      
      notes.push(
        `Чело на чекмедже: рязане ${Math.round(drawerFront.width)} × ${Math.round(drawerFront.height)} мм (кант 2 мм от 4 страни).`,
      )
      notes.push(
        `${p.doorCount === 1 ? 'Една врата' : 'Две врати'}: рязане ${Math.round(door.width)} × ${Math.round(door.height)} мм (фуга 5 мм отгоре, 3 мм между чело и врата, кант 2 мм от 4 страни).`,
      )
      
      panels.push({
        role: 'drawer-front',
        name: 'Чело на чекмедже',
        width: drawerFront.width,
        height: drawerFront.height,
        quantity: 1,
        canRotate: false,
        edges: edges({ top: true, bottom: true, left: true, right: true }),
        note: `Кант 2 мм от 4 страни. Размерът е за рязане (без канта).`,
      })
    } else {
      notes.push(
        `${p.doorCount === 1 ? 'Една врата' : 'Две врати'}: рязане ${Math.round(door.width)} × ${Math.round(door.height)} мм (фуга 5 мм само отгоре, кант 2 мм от 4 страни).`,
      )
    }
    
    notes.push(
      `Панти: ${totalHinges} бр. (по ${HINGES_PER_SMALL_DOOR} на врата) · винтчета ${totalScrews} бр. (по ${SCREWS_PER_HINGE} на панта).`,
    )
    
    hardware.push(
      pricedLine(
        HINGE_SOFT_CLOSE,
        totalHinges,
        `по ${HINGES_PER_SMALL_DOOR} на врата`,
      ),
    )
    hardware.push(
      pricedLine(
        { id: HINGE_SCREW.id, name: HINGE_SCREW.name, unitPriceEur: screwUnitPrice },
        totalScrews,
        `по ${SCREWS_PER_HINGE} на панта`,
      ),
    )
    
    panels.push({
      role: 'door',
      name: p.doorCount === 1 ? 'Врата' : 'Врата',
      width: door.width,
      height: door.height,
      quantity: p.doorCount,
      canRotate: false,
      edges: edges({ top: true, bottom: true, left: true, right: true }),
      note: `Кант 2 мм от 4 страни. ${doorWord}. Размерът е за рязане (без канта).`,
    })
  }

  return {
    joinery: KITCHEN_BASE_JOINERY,
    labor: emptyLabor(),
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
    'Корпус на крачета. По избор фазер на гърба и една или две врати.',
  defaultParams: { ...DEFAULT_KITCHEN_BASE_PARAMS },
  generate: generateKitchenBase,
}
