import { kitchenBaseType } from './kitchen-base'
import type { CabinetGeneratorResult, CabinetTypeDefinition } from './types'

/**
 * Register new cabinet / wardrobe types here. Each type owns its default
 * params and a generate() that returns panels, joinery, hardware and notes.
 */
export const CABINET_TYPES: CabinetTypeDefinition[] = [kitchenBaseType]

export function getCabinetType(id: string): CabinetTypeDefinition | undefined {
  return CABINET_TYPES.find((t) => t.id === id)
}

export function generateCabinet(
  typeId: string,
  params: Record<string, unknown>,
  settings?: unknown,
): CabinetGeneratorResult {
  const type = getCabinetType(typeId)
  if (!type) {
    throw new Error(`Непознат тип шкаф: ${typeId}`)
  }
  return type.generate({ ...type.defaultParams, ...params }, settings)
}

export function scaleCabinetResult(
  result: CabinetGeneratorResult,
  quantity: number,
): CabinetGeneratorResult {
  const q = Math.max(1, Math.floor(quantity) || 1)
  if (q === 1) return result
  return {
    ...result,
    panels: result.panels.map((p) => ({ ...p, quantity: p.quantity * q })),
    hardware: result.hardware.map((h) => ({ ...h, quantity: h.quantity * q })),
  }
}

export function cabinetDisplayName(typeId: string, params: Record<string, unknown>): string {
  const type = getCabinetType(typeId)
  const width = typeof params.width === 'number' ? params.width : undefined
  const base = type?.name ?? 'Шкаф'
  return width ? `${base} ${width}` : base
}
