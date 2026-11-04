import type { CabinetInstance, Part, PartEdgeBanding } from '@/types'
import { createDefaultEdgeBanding } from '@/lib/edge-banding'
import { generateId } from '@/lib/utils'
import { cabinetDisplayName, generateCabinet, scaleCabinetResult } from './catalog'
import { COMBINATION_TYPE, combinationReferences, type AttachedCabinet } from './compose'
import { edgeSideThickness, type GeneratedPanel, type PanelEdgePlan } from './types'

function bandingFromPlan(partId: string, plan: PanelEdgePlan): PartEdgeBanding {
  const band = createDefaultEdgeBanding(partId)
  for (const side of ['top', 'bottom', 'left', 'right'] as const) {
    if (!plan[side]) continue
    band[edgeSideThickness(plan, side)][side] = true
  }
  return band
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
    ...(panel.finishId ? { finishId: panel.finishId } : {}),
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

function nestablePanels(panels: GeneratedPanel[]): GeneratedPanel[] {
  return panels.filter((p) => !p.excludeFromCutting)
}

function insertGenerated(
  state: CabinetState,
  cabinet: Omit<CabinetInstance, 'partIds' | 'name'> & { name?: string },
  reuseIds: string[] = [],
  settings?: unknown,
): CabinetState {
  const result = scaleCabinetResult(
    generateCabinet(cabinet.typeId, cabinet.params, settings),
    cabinet.quantity,
  )
  const name = cabinet.name ?? cabinetDisplayName(cabinet.typeId, cabinet.params)
  const partIds: string[] = []
  const newParts: Part[] = []
  const newBanding: PartEdgeBanding[] = []

  nestablePanels(result.panels).forEach((panel, i) => {
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
  settings?: unknown,
  id?: string,
): CabinetState {
  return insertGenerated(state, {
    id: id ?? generateId(),
    typeId: input.typeId,
    quantity: Math.max(1, Math.floor(input.quantity) || 1),
    params: input.params,
  }, [], settings)
}

export function updateCabinet(
  state: CabinetState,
  cabinetId: string,
  input: { typeId: string; params: Record<string, unknown>; quantity: number },
  settings?: unknown,
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
    settings,
  )
}

export function removeCabinet(state: CabinetState, cabinetId: string): CabinetState {
  const existing = state.cabinets.find((c) => c.id === cabinetId)
  if (!existing) return state
  let stripped = stripCabinetParts(state, existing.partIds)
  const drop = stripped.cabinets.filter(
    (cabinet) => cabinet.typeId === COMBINATION_TYPE && combinationReferences(cabinet.params, cabinetId),
  )
  for (const combo of drop) stripped = stripCabinetParts(stripped, combo.partIds)
  const dropIds = new Set(drop.map((combo) => combo.id))
  return {
    ...stripped,
    cabinets: stripped.cabinets.filter((c) => c.id !== cabinetId && !dropIds.has(c.id)),
  }
}

export interface SavedCabinetGroup {
  host: { id: string | null; typeId: string; params: Record<string, unknown>; quantity: number }
  guests: {
    id: string
    typeId: string
    params: Record<string, unknown>
    quantity: number
    place: AttachedCabinet['place']
    joinScrews: boolean
    spanDoor: boolean
  }[]
  combinationId: string | null
}

/** Saves every cabinet in the drawing, then the combination itself with no parts and no price. */
export function saveCabinetGroup(state: CabinetState, group: SavedCabinetGroup, settings?: unknown): CabinetState {
  const attached: AttachedCabinet[] = group.guests.map((guest) => ({
    cabinetId: guest.id,
    place: guest.place,
    joinScrews: guest.joinScrews,
    spanDoor: guest.spanDoor,
  }))
  const hostParams = { ...group.host.params }
  delete hostParams.attached
  let next = state
  let hostId = group.host.id
  if (hostId && next.cabinets.some((cabinet) => cabinet.id === hostId)) {
    next = updateCabinet(
      next,
      hostId,
      { typeId: group.host.typeId, params: hostParams, quantity: group.host.quantity },
      settings,
    )
  } else {
    hostId = generateId()
    next = addCabinet(
      next,
      { typeId: group.host.typeId, params: hostParams, quantity: group.host.quantity },
      settings,
      hostId,
    )
  }
  for (const guest of group.guests) {
    if (!next.cabinets.some((cabinet) => cabinet.id === guest.id)) continue
    const params = { ...guest.params }
    delete params.attached
    next = updateCabinet(next, guest.id, { typeId: guest.typeId, params, quantity: guest.quantity }, settings)
  }
  if (attached.length === 0) {
    if (group.combinationId && next.cabinets.some((cabinet) => cabinet.id === group.combinationId)) {
      next = removeCabinet(next, group.combinationId)
    }
    return relabelCabinetParts(next, settings)
  }
  const combinationParams = {
    hostId,
    members: [
      { cabinetId: hostId, place: 'host', joinScrews: false, spanDoor: false },
      ...attached,
    ],
  }
  const existingId =
    (group.combinationId && next.cabinets.some((cabinet) => cabinet.id === group.combinationId)
      ? group.combinationId
      : null) ??
    next.cabinets.find((cabinet) => cabinet.typeId === COMBINATION_TYPE && cabinet.params.hostId === hostId)?.id ??
    null
  if (existingId) {
    next = updateCabinet(
      next,
      existingId,
      { typeId: COMBINATION_TYPE, params: combinationParams, quantity: 1 },
      settings,
    )
  } else {
    next = addCabinet(next, { typeId: COMBINATION_TYPE, params: combinationParams, quantity: 1 }, settings)
  }
  return relabelCabinetParts(next, settings)
}

/** Renumber labels after add/remove so they stay free sequential: "1 Дъно", "2 Страница". */
export function relabelCabinetParts(state: CabinetState, settings?: unknown): CabinetState {
  const parts = state.parts.map((p) => {
    if (!p.cabinetId) return p
    const cabinet = state.cabinets.find((c) => c.id === p.cabinetId)
    if (!cabinet) return p
    const idx = cabinet.partIds.indexOf(p.id)
    if (idx < 0) return p
    const result = generateCabinet(cabinet.typeId, cabinet.params, settings)
    const panel = nestablePanels(result.panels)[idx]
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

export function rebuildCabinets(state: CabinetState, settings?: unknown): CabinetState {
  let next = state
  for (const c of state.cabinets) {
    next = updateCabinet(next, c.id, {
      typeId: c.typeId,
      params: c.params,
      quantity: c.quantity,
    }, settings)
  }
  return relabelCabinetParts(next, settings)
}

export function addCabinetAndLabel(
  state: CabinetState,
  input: { typeId: string; params: Record<string, unknown>; quantity: number },
  settings?: unknown,
): CabinetState {
  return relabelCabinetParts(addCabinet(state, input, settings), settings)
}

export function updateCabinetAndLabel(
  state: CabinetState,
  cabinetId: string,
  input: { typeId: string; params: Record<string, unknown>; quantity: number },
  settings?: unknown,
): CabinetState {
  return relabelCabinetParts(updateCabinet(state, cabinetId, input, settings), settings)
}

export function removeCabinetAndLabel(state: CabinetState, cabinetId: string, settings?: unknown): CabinetState {
  return relabelCabinetParts(removeCabinet(state, cabinetId), settings)
}
