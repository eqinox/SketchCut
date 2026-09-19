import { pricedLine } from './hardware'
import { DOOR_EDGE_MM } from './materials'
import { edges, type GeneratedPanel, type HardwareItem } from './types'
import type { HardwareSettings } from '@/lib/settings'
import type { PartitionSpec } from './zones'

/** Inner partitions sit this far back so sliding doors can pass in front. */
export const SLIDING_PARTITION_SETBACK_MM = 90
/** Shelves are this much shallower than the inner partition. */
export const SLIDING_SHELF_FROM_PARTITION_MM = 10
/** Extra width so two doors overlap instead of meeting on the partition. */
export const SLIDING_DOOR_OVERLAP_MM = 10
/** Bottom track / strip on the sliding doors, mm. */
export const SLIDING_BOTTOM_TRACK_MM = 10
/** Extra gap so drawer fronts do not rub the bottom track. */
export const SLIDING_DRAWER_CLEARANCE_MM = 10
/** Lowest drawer front sits this far above the inner floor when there are sliding doors. */
export const SLIDING_DRAWER_FROM_BOTTOM_MM = SLIDING_BOTTOM_TRACK_MM + SLIDING_DRAWER_CLEARANCE_MM
/** Vertical handle profile (кант дръжка), mm added after the cut. */
export const SLIDING_HANDLE_PROFILE_MM = 20
/** Vertical end cap (тапа / лайсна без дръжка), mm added after the cut. */
export const SLIDING_CAP_PROFILE_MM = 20

export type DoorStyle = 'hinged' | 'sliding'
export type SlidingEdgeKind = 'handle' | 'cap'

export interface SlidingDoorEdges {
  left: SlidingEdgeKind
  right: SlidingEdgeKind
}

export function parseDoorStyle(raw: unknown): DoorStyle {
  return raw === 'sliding' ? 'sliding' : 'hinged'
}

export function parseSlidingEdgeKind(raw: unknown): SlidingEdgeKind {
  return raw === 'cap' ? 'cap' : 'handle'
}

export function defaultSlidingEdges(count: number): SlidingDoorEdges[] {
  return Array.from({ length: Math.max(0, count) }, () => ({ left: 'handle' as const, right: 'handle' as const }))
}

export function parseSlidingEdges(raw: unknown, count: number): SlidingDoorEdges[] {
  const fallback = defaultSlidingEdges(count)
  if (!Array.isArray(raw)) return fallback
  return fallback.map((d, i) => {
    const src = raw[i]
    if (!src || typeof src !== 'object' || Array.isArray(src)) return d
    const row = src as Record<string, unknown>
    return {
      left: parseSlidingEdgeKind(row.left),
      right: parseSlidingEdgeKind(row.right),
    }
  })
}

export function slidingEdgeLabel(kind: SlidingEdgeKind): string {
  return kind === 'handle' ? 'кант дръжка' : 'тапа'
}

export function slidingProfileMm(kind: SlidingEdgeKind): number {
  return kind === 'handle' ? SLIDING_HANDLE_PROFILE_MM : SLIDING_CAP_PROFILE_MM
}

/** Center divider: from the inner (right) face of the left side to the right face of the partition. */
export function centerSlidingPartition(width: number, thickness: number): PartitionSpec {
  const T = thickness
  const innerW = Math.max(T, width - 2 * T)
  return {
    from: 'left',
    offsetMm: Math.round((innerW + T) / 2),
    fromFace: 'right',
    toFace: 'right',
  }
}

export interface SlidingDoorLeaf {
  index: number
  side: 'left' | 'right'
  name: string
  /** Finished width with profiles, including the 10 mm overlap. */
  gabaritW: number
  /** Saw size — profiles are applied after cutting. */
  cutW: number
  cutH: number
  gabaritH: number
  edges: SlidingDoorEdges
  /** Inner-left origin of the finished door (x = 0 is the inner face of the left side). */
  x: number
}

function splitXLeft(
  innerW: number,
  thickness: number,
  partitions: { xLeft: number }[],
): { xLeft: number; thickness: number } {
  if (partitions.length === 0) {
    return { xLeft: innerW / 2, thickness: 0 }
  }
  const mid = innerW / 2
  let best = partitions[0]
  let bestDist = Math.abs(best.xLeft + thickness / 2 - mid)
  for (const p of partitions) {
    const dist = Math.abs(p.xLeft + thickness / 2 - mid)
    if (dist < bestDist) {
      best = p
      bestDist = dist
    }
  }
  return { xLeft: best.xLeft, thickness }
}

export function layoutSlidingDoors(input: {
  innerW: number
  innerH: number
  thickness: number
  partitions: { xLeft: number }[]
  edges: SlidingDoorEdges[]
}): SlidingDoorLeaf[] {
  const T = input.thickness
  const innerW = input.innerW
  const innerH = input.innerH
  if (!(innerW > 0) || !(innerH > 0)) return []
  const split = splitXLeft(innerW, T, input.partitions)
  const leftBase = split.xLeft + split.thickness
  const rightBase = innerW - split.xLeft
  const overlap = SLIDING_DOOR_OVERLAP_MM
  const gabaritH = innerH
  const cutH = Math.max(T, gabaritH - 2 * DOOR_EDGE_MM)
  const pair = input.edges.length >= 2 ? input.edges : defaultSlidingEdges(2)

  const make = (
    index: number,
    side: 'left' | 'right',
    base: number,
    edges: SlidingDoorEdges,
    x: number,
  ): SlidingDoorLeaf => {
    const gabaritW = base + overlap
    const cutW = Math.max(T, gabaritW - slidingProfileMm(edges.left) - slidingProfileMm(edges.right))
    return {
      index,
      side,
      name: side === 'left' ? 'Лява плъзгаща врата' : 'Дясна плъзгаща врата',
      gabaritW,
      cutW,
      cutH,
      gabaritH,
      edges,
      x,
    }
  }

  const left = make(0, 'left', leftBase, pair[0], 0)
  const right = make(1, 'right', rightBase, pair[1], innerW - (rightBase + overlap))
  return [left, right]
}

export function appendSlidingDoors(
  input: {
    innerW: number
    innerH: number
    thickness: number
    partitions: { xLeft: number }[]
    edges: SlidingDoorEdges[]
    externalDoors?: boolean
  },
  panels: GeneratedPanel[],
  hardware: HardwareItem[],
  notes: string[],
  hardwareSettings: HardwareSettings,
): void {
  const leaves = layoutSlidingDoors(input)
  if (leaves.length === 0) return
  const bought = input.externalDoors === true

  notes.push(
    `2 плъзгащи врати между страниците. Разделителните страници са с ${SLIDING_PARTITION_SETBACK_MM} мм по-плитки, рафтовете с още ${SLIDING_SHELF_FROM_PARTITION_MM} мм.`,
  )
  notes.push(
    `Вратите се препокриват с ${SLIDING_DOOR_OVERLAP_MM} мм. Габаритът включва кант дръжка/тапа; рязането е без профилите.`,
  )
  notes.push(
    `Долната лайсна е ${SLIDING_BOTTOM_TRACK_MM} мм. Чекмеджета отдолу започват на ${SLIDING_DRAWER_FROM_BOTTOM_MM} мм от дъното (${SLIDING_BOTTOM_TRACK_MM} мм лайсна + ${SLIDING_DRAWER_CLEARANCE_MM} мм да не търкат).`,
  )
  if (bought) {
    notes.push('Плъзгащите врати са външни: поръчват се по габарит, не влизат в разкроя и не се кантират при нас.')
  }

  let handleMm = 0
  let capMm = 0
  for (const leaf of leaves) {
    const leftL = slidingEdgeLabel(leaf.edges.left)
    const rightL = slidingEdgeLabel(leaf.edges.right)
    if (bought) {
      notes.push(
        `${leaf.name}: поръчай габарит ${Math.round(leaf.gabaritW)} × ${Math.round(leaf.gabaritH)} мм (ляво ${leftL}, дясно ${rightL}).`,
      )
      panels.push({
        role: 'sliding-door',
        name: `Поръчай: ${leaf.name}`,
        width: leaf.gabaritW,
        height: leaf.gabaritH,
        quantity: 1,
        canRotate: false,
        edges: edges({}),
        excludeFromCutting: true,
        highlightColor: 'order',
        note: `Външна плъзгаща врата. Готов габарит ${Math.round(leaf.gabaritW)} × ${Math.round(leaf.gabaritH)} мм. Не се реже и не се кантира при нас. Поръчай отделно.`,
      })
      continue
    }
    notes.push(
      `${leaf.name}: габарит ${Math.round(leaf.gabaritW)} × ${Math.round(leaf.gabaritH)} мм · рязане ${Math.round(leaf.cutW)} × ${Math.round(leaf.cutH)} мм (ляво ${leftL} ${slidingProfileMm(leaf.edges.left)} мм, дясно ${rightL} ${slidingProfileMm(leaf.edges.right)} мм, кант 2 мм горе и долу).`,
    )
    if (leaf.edges.left === 'handle') handleMm += leaf.cutH
    else capMm += leaf.cutH
    if (leaf.edges.right === 'handle') handleMm += leaf.cutH
    else capMm += leaf.cutH
    panels.push({
      role: 'sliding-door',
      name: leaf.name,
      width: leaf.cutW,
      height: leaf.cutH,
      quantity: 1,
      canRotate: false,
      edges: edges({ top: true, bottom: true }),
      note: `Плъзгаща врата. Рязане без вертикалните профили. След кант дръжка/тапа: ${Math.round(leaf.gabaritW)} мм. Кант 2 мм: горна и долна.`,
    })
  }

  if (bought) return

  const pushProfile = (id: string, name: string, mm: number, eurPerM: number) => {
    if (!(mm > 0)) return
    const metres = Math.round((mm / 1000) * 1000) / 1000
    notes.push(`${name}: ${Math.round(mm)} мм (${metres} м)${eurPerM > 0 ? ` · ${eurPerM} €/м` : ''}.`)
    hardware.push(
      pricedLine(
        { id, name, unitPriceEur: eurPerM },
        metres,
        `${Math.round(mm)} мм`,
      ),
    )
  }
  pushProfile('sliding-handle', 'Кант дръжка', handleMm, hardwareSettings.slidingHandleEurPerM ?? 0)
  pushProfile('sliding-cap', 'Тапа за плъзгаща врата', capMm, hardwareSettings.slidingCapEurPerM ?? 0)
}
