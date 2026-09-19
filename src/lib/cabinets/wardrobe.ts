import {
  DEFAULT_NIGHTSTAND_PARAMS,
  generatePlinthCabinet,
  parseNightstandParams,
  type NightstandParams,
} from './nightstand'
import { DEFAULT_PANEL_THICKNESS } from './types'
import { centerSlidingPartition, defaultSlidingEdges, parseSlidingEdges } from './sliding-doors'
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
  partitions: [centerSlidingPartition(2000, DEFAULT_PANEL_THICKNESS)],
}

export function parseWardrobeParams(raw: Record<string, unknown>): WardrobeParams {
  const merged = { ...DEFAULT_WARDROBE_PARAMS, ...raw }
  return {
    ...parseNightstandParams(merged),
    useLegs: false,
    doorStyle: 'sliding',
    doorCount: 2,
    slidingEdges: parseSlidingEdges(raw.slidingEdges ?? merged.slidingEdges, 2),
  }
}

export function generateWardrobe(
  raw: Record<string, unknown>,
  settings?: unknown,
): CabinetGeneratorResult {
  return generatePlinthCabinet({ ...DEFAULT_WARDROBE_PARAMS, ...raw, useLegs: false, doorStyle: 'sliding', doorCount: 2 }, settings, {
    topInner: true,
    label: 'Гардероб с плъзгащи врати',
    forcePlinth: true,
  })
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
