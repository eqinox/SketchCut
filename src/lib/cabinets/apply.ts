import type { CabinetInstance, Part, PartEdgeBanding } from '@/types'
import { createDefaultEdgeBanding } from '@/lib/edge-banding'
import { generateId } from '@/lib/utils'
import { cabinetDisplayName, generateCabinet, scaleCabinetResult } from './catalog'
import { EMPTY_EDGES, type GeneratedPanel, type PanelEdgePlan } from './types'

function bandingFromPlan(partId: string, plan: PanelEdgePlan): PartEdgeBanding {
  const band = createDefaultEdgeBanding(partId)
  const sides = { ...EMPTY_EDGES }
  sides.top = plan.top
  sides.bottom = plan.bottom
  sides.left = plan.left
  sides.right = plan.right
  return { ...band, [plan.thickness]: sides }
}

function panelToPart(
  panel: GeneratedPanel,
  cabinetId: string,
  index: number,
  existingId?: string,
): { part: Part; banding: PartEdgeBanding } {
  const id = existingId ?? generateId()
  const part: Part = {
    id,
    width: panel.width,
    height: panel.height,
    quantity: panel.quantity,
    canRotate: panel.canRotate,
    label: `${index + 1} ${panel.name}`,
    cabinetId,
    kind: panel.material === 'hardboard' ? 'hardboard' : 'chipboard',
  }
  return { part, banding: bandingFromPlan(id, panel.edges) }
}

export interface CabinetState {
  cabinets: CabinetInstance[]
  parts: Part[]
  edgeBanding: PartEdgeBanding[]
}

function stripCabinetParts(state: CabinetState, partIds: string[]): CabinetState {
  const remove = new Set(partIds)
  return {
    cabinets: state.cabinets,
    parts: state.parts.filter((p) => !remove.has(p.id)),
    edgeBanding: state.edgeBanding.filter((b) => !remove.has(b.partId)),
  }
}

function insertGenerated(
  state: CabinetState,
  cabinet: Omit<CabinetInstance, 'partIds' | 'name'> & { name?: string },
  reuseIds: string[] = [],
): CabinetState {
  const result = scaleCabinetResult(
    generateCabinet(cabinet.typeId, cabinet.params),
    cabinet.quantity,
  )
  const name = cabinet.name ?? cabinetDisplayName(cabinet.typeId, cabinet.params)
  const partIds: string[] = []
  const newParts: Part[] = []
  const newBanding: PartEdgeBanding[] = []

  result.panels.forEach((panel, i) => {
    const { part, banding } = panelToPart(panel, cabinet.id, i, reuseIds[i])
    partIds.push(part.id)
    newParts.push(part)
    newBanding.push(banding)
  })

  const instance: CabinetInstance = {
    id: cabinet.id,
    typeId: cabinet.typeId,
    name,
    quantity: cabinet.quantity,
    params: cabinet.params,
    partIds,
  }

  const existingIdx = state.cabinets.findIndex((c) => c.id === cabinet.id)
  const cabinets =
    existingIdx >= 0
      ? state.cabinets.map((c, i) => (i === existingIdx ? instance : c))
      : [...state.cabinets, instance]

  return {
    cabinets,
    parts: [...state.parts, ...newParts],
    edgeBanding: [...state.edgeBanding, ...newBanding],
  }
}

export function addCabinet(
  state: CabinetState,
  input: { typeId: string; params: Record<string, unknown>; quantity: number },
): CabinetState {
  return insertGenerated(state, {
    id: generateId(),
    typeId: input.typeId,
    quantity: Math.max(1, Math.floor(input.quantity) || 1),
    params: input.params,
  })
}

export function updateCabinet(
  state: CabinetState,
  cabinetId: string,
  input: { typeId: string; params: Record<string, unknown>; quantity: number },
): CabinetState {
  const existing = state.cabinets.find((c) => c.id === cabinetId)
  if (!existing) return state
  const stripped = stripCabinetParts(state, existing.partIds)
  return insertGenerated(
    stripped,
    {
      id: existing.id,
      typeId: input.typeId,
      quantity: Math.max(1, Math.floor(input.quantity) || 1),
      params: input.params,
    },
    existing.partIds,
  )
}

export function removeCabinet(state: CabinetState, cabinetId: string): CabinetState {
  const existing = state.cabinets.find((c) => c.id === cabinetId)
  if (!existing) return state
  const stripped = stripCabinetParts(state, existing.partIds)
  return {
    ...stripped,
    cabinets: stripped.cabinets.filter((c) => c.id !== cabinetId),
  }
}

/** Renumber labels after add/remove so they stay Ш-free sequential: "1 Дъно", "2 Страница". */
export function relabelCabinetParts(state: CabinetState): CabinetState {
  const parts = state.parts.map((p) => {
    if (!p.cabinetId) return p
    const cabinet = state.cabinets.find((c) => c.id === p.cabinetId)
    if (!cabinet) return p
    const idx = cabinet.partIds.indexOf(p.id)
    if (idx < 0) return p
    const result = generateCabinet(cabinet.typeId, cabinet.params)
    const panel = result.panels[idx]
    if (!panel) return p
    const prefix = state.cabinets.length > 1 ? `${cabinetShortIndex(state.cabinets, cabinet.id)} ` : ''
    return { ...p, label: `${prefix}${panel.name}` }
  })
  return { ...state, parts }
}

function cabinetShortIndex(cabinets: CabinetInstance[], id: string): string {
  const i = cabinets.findIndex((c) => c.id === id)
  return `Ш${i + 1}`
}

export function addCabinetAndLabel(
  state: CabinetState,
  input: { typeId: string; params: Record<string, unknown>; quantity: number },
): CabinetState {
  return relabelCabinetParts(addCabinet(state, input))
}

export function updateCabinetAndLabel(
  state: CabinetState,
  cabinetId: string,
  input: { typeId: string; params: Record<string, unknown>; quantity: number },
): CabinetState {
  return relabelCabinetParts(updateCabinet(state, cabinetId, input))
}

export function removeCabinetAndLabel(state: CabinetState, cabinetId: string): CabinetState {
  return relabelCabinetParts(removeCabinet(state, cabinetId))
}
