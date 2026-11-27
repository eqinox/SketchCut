import { stampPanelFinishes } from '@/lib/board-finishes'
import { applyCabinetMirrors } from './mirror'
import { COMBINATION_TYPE } from './compose'
import { kitchenBaseType } from './kitchen-base'
import { kitchenWallType } from './kitchen-wall'
import { nightstandType } from './nightstand'
import { sectionType } from './section'
import { bedType } from './bed'
import { vanityType } from './vanity'
import { wardrobeType } from './wardrobe'
import type { CabinetGeneratorResult, CabinetTypeDefinition } from './types'
import {
  assemblyMinutesFromSteps,
  rescaleProjectScopedStep,
  replaceShelfPinMarking,
  shelfPinMarkingSteps,
  type AssemblyStep,
} from '@/lib/assembly-time'

/**
 * Register new cabinet / wardrobe types here. Each type owns its default
 * params and a generate() that returns panels, joinery, hardware and notes.
 */
export const CABINET_TYPES: CabinetTypeDefinition[] = [kitchenBaseType, kitchenWallType, nightstandType, vanityType, bedType, sectionType, wardrobeType]

export function getCabinetType(id: string): CabinetTypeDefinition | undefined {
  return CABINET_TYPES.find((t) => t.id === id)
}

export function generateCabinet(
  typeId: string,
  params: Record<string, unknown>,
  settings?: unknown,
): CabinetGeneratorResult {
  if (typeId === COMBINATION_TYPE) {
    return {
      panels: [],
      joinery: { bottomSides: 'sides-cover-bottom', topSides: 'rails-between-sides', depth: 'flush' },
      hardware: [],
      labor: { cuttingMinutes: 0, edgingMinutes: 0, assemblyMinutes: 0, assemblySteps: [] },
      notes: [],
    }
  }
  const type = getCabinetType(typeId)
  if (!type) {
    throw new Error(`Непознат тип шкаф: ${typeId}`)
  }
  const result = type.generate({ ...type.defaultParams, ...params }, settings)
  return applyCabinetMirrors(
    {
      ...result,
      panels: stampPanelFinishes(
        result.panels,
        params.carcassFinishId,
        params.frontFinishId,
        params.pieceFinishes,
      ),
    },
    params,
    settings,
  )
}

export function scaleCabinetResult(
  result: CabinetGeneratorResult,
  quantity: number,
): CabinetGeneratorResult {
  const q = Math.max(1, Math.floor(quantity) || 1)
  if (q === 1) return result
  const scaled = (result.labor.assemblySteps ?? []).map((step: AssemblyStep) => {
    // Shelf-pin marking is priced again below: the copies after the first repeat the first.
    if (step.id === 'mark-shelf-pins-calc' || step.pinRows) return step
    if (step.projectFirstExtra && step.quantity != null) {
      return rescaleProjectScopedStep(step, step.quantity * q)
    }
    return {
      ...step,
      minutes: Math.round(step.minutes * q * 10) / 10,
      quantity: step.quantity != null ? step.quantity * q : undefined,
      calc: undefined,
    }
  })
  const rows = scaled.find((step) => step.pinRows)?.pinRows
  const assemblySteps = rows ? replaceShelfPinMarking(scaled, shelfPinMarkingSteps(rows, new Set(), q).steps) : scaled
  return {
    ...result,
    panels: result.panels.map((p) => ({
      ...p,
      quantity: p.quantity * q,
      ...(p.pieceKeys ? { pieceKeys: Array.from({ length: q }, () => p.pieceKeys!).flat() } : {}),
    })),
    hardware: result.hardware.map((h) => ({ ...h, quantity: h.quantity * q })),
    labor: {
      ...result.labor,
      assemblyMinutes: assemblyMinutesFromSteps(assemblySteps),
      assemblySteps,
    },
  }
}

/** The shelf-pin spots a cabinet marks (see `shelfPinMarkingSteps`). */
export function shelfPinSpots(result: CabinetGeneratorResult): string[] {
  const rows = result.labor.assemblySteps?.find((step) => step.pinRows)?.pinRows ?? []
  return rows.map((row) => row.key)
}

/**
 * Prices the cabinet's shelf-pin marking again, knowing the spots already marked on cabinets
 * before it in the project: those skip the working-out and are marked 30 seconds quicker.
 */
export function repriceShelfPins(result: CabinetGeneratorResult, known: ReadonlySet<string>): CabinetGeneratorResult {
  const steps = result.labor.assemblySteps ?? []
  const mark = steps.find((step) => step.pinRows)
  if (!mark?.pinRows || known.size === 0) return result
  const next = shelfPinMarkingSteps(mark.pinRows, known, mark.pinCopies ?? 1).steps
  const assemblySteps = replaceShelfPinMarking(steps, next)
  return {
    ...result,
    labor: { ...result.labor, assemblySteps, assemblyMinutes: assemblyMinutesFromSteps(assemblySteps) },
  }
}

/**
 * Cabinets of a project in list order, each priced with the shelf-pin spots of the ones before it.
 * `stopAt` ends the walk before that cabinet and returns the spots known up to it.
 */
export function walkShelfPinSpots<T extends { id: string; typeId: string; params: Record<string, unknown>; quantity: number }>(
  cabinets: T[],
  settings: unknown,
  stopAt: string | null,
): Set<string> {
  const known = new Set<string>()
  for (const cabinet of cabinets) {
    if (cabinet.id === stopAt) break
    if (cabinet.typeId === COMBINATION_TYPE) continue
    try {
      for (const key of shelfPinSpots(generateCabinet(cabinet.typeId, cabinet.params, settings))) known.add(key)
    } catch {
      // A cabinet that fails to build marks nothing.
    }
  }
  return known
}

export function cabinetDisplayName(typeId: string, params: Record<string, unknown>): string {
  if (typeId === COMBINATION_TYPE) return 'Комбинация'
  const type = getCabinetType(typeId)
  const width = typeof params.width === 'number' ? params.width : undefined
  const base = type?.name ?? 'Шкаф'
  return width ? `${base} ${width}` : base
}
