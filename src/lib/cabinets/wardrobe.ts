import {
  DEFAULT_NIGHTSTAND_PARAMS,
  generatePlinthCabinet,
  parseNightstandParams,
  type NightstandParams,
} from './nightstand'
import { DEFAULT_PANEL_THICKNESS } from './types'
import { defaultSlidingEdges, parseSlidingDoorCount, parseSlidingEdges, threeDoorSlidingEdges } from './sliding-doors'
import type { CabinetGeneratorResult, CabinetTypeDefinition } from './types'

export const WARDROBE_TYPE_ID = 'wardrobe'

export type WardrobeParams = NightstandParams

export const DEFAULT_WARDROBE_PARAMS: WardrobeParams = {
  ...DEFAULT_NIGHTSTAND_PARAMS,
  width: 2000,
  height: 2400,
  depth: 600,
  thickness: DEFAULT_PANEL_THICKNESS,
  useLegs: false,
  plinthCount: 1,
  plinthHeight: 100,
  topStyle: 'panel',
  doorCount: 2,
  doorStyle: 'sliding',
  slidingEdges: defaultSlidingEdges(2),
  doorSpan: 'full',
  partitions: [],
}

export function parseWardrobeParams(raw: Record<string, unknown>): WardrobeParams {
  const noDoors = raw.depthMode === 'no-doors'
  const slidingDoorCount = noDoors ? 2 : parseSlidingDoorCount(raw.slidingDoorCount)
  const merged = {
    ...DEFAULT_WARDROBE_PARAMS,
    ...raw,
    doorStyle: noDoors ? 'hinged' : 'sliding',
    doorCount: noDoors ? 0 : 2,
    slidingDoorCount,
  }
  return {
    ...parseNightstandParams(merged),
    useLegs: false,
    doorStyle: noDoors ? 'hinged' : 'sliding',
    doorCount: noDoors ? 0 : 2,
    slidingDoorCount,
    slidingEdges: noDoors
      ? []
      : slidingDoorCount === 3
        ? threeDoorSlidingEdges()
        : parseSlidingEdges(raw.slidingEdges ?? merged.slidingEdges, 2),
  }
}

export function generateWardrobe(
  raw: Record<string, unknown>,
  settings?: unknown,
): CabinetGeneratorResult {
  const noDoors = raw.depthMode === 'no-doors'
  return generatePlinthCabinet(
    {
      ...DEFAULT_WARDROBE_PARAMS,
      ...raw,
      useLegs: false,
      doorStyle: noDoors ? 'hinged' : 'sliding',
      doorCount: noDoors ? 0 : 2,
    },
    settings,
    {
      topInner: true,
      label: 'Гардероб с плъзгащи врати',
      forcePlinth: true,
    },
  )
}

export const wardrobeType: CabinetTypeDefinition = {
  id: WARDROBE_TYPE_ID,
  name: 'Гардероб с плъзгащи врати',
  category: 'wardrobe',
  description:
    'Дъно с цокъл, плот между страниците. Разделителните страници са по-плитки, за да минават плъзгащите врати отпред.',
  defaultParams: { ...DEFAULT_WARDROBE_PARAMS },
  generate: generateWardrobe,
}
