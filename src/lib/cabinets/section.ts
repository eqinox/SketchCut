import {
  DEFAULT_NIGHTSTAND_PARAMS,
  generatePlinthCabinet,
  parseNightstandParams,
  type NightstandParams,
} from './nightstand'
import type { CabinetGeneratorResult, CabinetTypeDefinition } from './types'

export const SECTION_TYPE_ID = 'section'

export type SectionParams = NightstandParams

export const DEFAULT_SECTION_PARAMS: SectionParams = {
  ...DEFAULT_NIGHTSTAND_PARAMS,
  width: 800,
  height: 800,
  depth: 400,
  useLegs: false,
}

export function parseSectionParams(raw: Record<string, unknown>): SectionParams {
  return { ...parseNightstandParams({ ...DEFAULT_SECTION_PARAMS, ...raw }), useLegs: false }
}

export function generateSection(
  raw: Record<string, unknown>,
  settings?: unknown,
): CabinetGeneratorResult {
  return generatePlinthCabinet({ ...DEFAULT_SECTION_PARAMS, ...raw, useLegs: false }, settings, {
    topInner: true,
    label: 'Секция',
    forcePlinth: true,
  })
}

export const sectionType: CabinetTypeDefinition = {
  id: SECTION_TYPE_ID,
  name: 'Секция',
  category: 'wardrobe',
  description:
    'Като нощното шкафче с цокъл, но плотът влиза между страниците. По избор рафтове, врата и чекмеджета.',
  defaultParams: { ...DEFAULT_SECTION_PARAMS },
  generate: generateSection,
}
