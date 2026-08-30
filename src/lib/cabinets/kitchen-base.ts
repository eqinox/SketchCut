import { KITCHEN_BASE_JOINERY, measureCarcass } from './joinery'
import {
  DEFAULT_LEG_HEIGHT,
  DEFAULT_PANEL_THICKNESS,
  DEFAULT_RAIL_WIDTH,
  emptyLabor,
  edges,
  type CabinetGeneratorResult,
  type CabinetTypeDefinition,
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
    shelfCount: Math.max(0, Math.floor(num('shelfCount', 0))),
  }
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
  ]

  if (p.depth < p.railWidth * 2) {
    notes.push('Внимание: дълбочината е по-малка от двете царги една до друга.')
  }

  return {
    joinery: KITCHEN_BASE_JOINERY,
    labor: emptyLabor(),
    hardware: [{ name: `Краче ${p.legHeight} мм`, quantity: 4 }],
    notes,
    panels: [
      {
        role: 'bottom',
        name: 'Дъно',
        width: m.bottomW,
        height: m.bottomD,
        quantity: 1,
        canRotate: false,
        // width = cabinet width (front edge), height = depth (left/right edges)
        edges: edges({ top: true, left: true, right: true }),
        note: 'Кант: предна + двете страни. Задната не се кантира.',
      },
      {
        role: 'side',
        name: 'Страница',
        width: m.sideD,
        height: m.sideH,
        quantity: 2,
        canRotate: false,
        // width = depth (top edge of the panel), height = side height (front edge)
        edges: edges({ top: true, left: true }),
        note: 'Кант: предна и горна. Долната сяда в дъното, задната не се вижда.',
      },
      {
        role: 'rail',
        name: 'Царга',
        width: m.railLength,
        height: p.railWidth,
        quantity: 2,
        canRotate: false,
        // one long side only (the visible long edge)
        edges: edges({ top: true }),
        note: 'Кант: едната дълга страна. Предна и задна царга са еднакви.',
      },
    ],
  }
}

export const kitchenBaseType: CabinetTypeDefinition = {
  id: KITCHEN_BASE_TYPE_ID,
  name: 'Долен кухненски шкаф',
  category: 'kitchen-base',
  description:
    'Корпус на крачета, без врата. Дъно под страниците, две царги по 10 см отпред и отзад горе.',
  defaultParams: { ...DEFAULT_KITCHEN_BASE_PARAMS },
  generate: generateKitchenBase,
}
