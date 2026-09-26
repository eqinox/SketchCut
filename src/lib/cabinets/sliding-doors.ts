import { pricedLine } from './hardware'
import { DOOR_EDGE_MM } from './materials'
import { edges, type GeneratedPanel, type HardwareItem } from './types'
import type { HardwareSettings } from '@/lib/settings'
import type { PartitionSpec } from './zones'
import { formatMm } from '../utils'
import {
  DEFAULT_SLIDING_LOWER_TRACK_EUR,
  DEFAULT_SLIDING_MVP005_KIT_EUR,
  DEFAULT_SLIDING_SOFT_CLOSE_EUR,
  DEFAULT_SLIDING_UPPER_TRACK_EUR,
  SLIDING_LOWER_TRACK_DEPTH_MM,
  SLIDING_LOWER_TRACK_HEIGHT_MM,
  SLIDING_LOWER_TRACK_INSET_MM,
  SLIDING_TRACK_COLOR_LABELS,
  SLIDING_TRACK_LENGTH_MM,
  SLIDING_UPPER_TRACK_CLEARANCE_MM,
  SLIDING_UPPER_TRACK_DEPTH_MM,
  SLIDING_UPPER_TRACK_HEIGHT_MM,
  pickSlidingSku,
  slidingSkuLabel,
  type SlidingTrackColor,
} from '@/lib/sliding-hardware'

/** Inner partitions sit this far back so sliding doors can pass in front (upper rail 80 + 10 spare). */
export const SLIDING_PARTITION_SETBACK_MM = SLIDING_UPPER_TRACK_DEPTH_MM + SLIDING_UPPER_TRACK_CLEARANCE_MM
/** Shelves are this much shallower than the inner partition. */
export const SLIDING_SHELF_FROM_PARTITION_MM = 10
/** Extra width so two doors overlap instead of meeting on the partition. */
export const SLIDING_DOOR_OVERLAP_MM = 10
/** Lower rail height (two channels). */
export const SLIDING_BOTTOM_TRACK_MM = SLIDING_LOWER_TRACK_HEIGHT_MM
export { SLIDING_LOWER_TRACK_DEPTH_MM, SLIDING_LOWER_TRACK_INSET_MM, SLIDING_UPPER_TRACK_DEPTH_MM, SLIDING_UPPER_TRACK_HEIGHT_MM }
/** Extra gap so drawer fronts do not rub the bottom track. */
export const SLIDING_DRAWER_CLEARANCE_MM = 10
/** Lowest drawer front sits this far above the inner floor when there are sliding doors. */
export const SLIDING_DRAWER_FROM_BOTTOM_MM = SLIDING_BOTTOM_TRACK_MM + SLIDING_DRAWER_CLEARANCE_MM
/** Vertical handle profile D1L, mm added after the cut. */
export const SLIDING_HANDLE_PROFILE_MM = 20
/** D2 aluminium cap does not add width — it sits on the 18 mm board edge. */
export const SLIDING_CAP_PROFILE_MM = 0

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
  return kind === 'handle' ? 'кант дръжка D1L' : 'профил D2'
}

export function bothSideSlidingEdges(): SlidingDoorEdges[] {
  return [
    { left: 'handle', right: 'handle' },
    { left: 'handle', right: 'handle' },
  ]
}

/** Handle on the outer edge of each door, D2 on the inner edge. */
export function oneSideSlidingEdges(): SlidingDoorEdges[] {
  return [
    { left: 'handle', right: 'cap' },
    { left: 'cap', right: 'handle' },
  ]
}

export function slidingHandlesOnBothSides(edges: SlidingDoorEdges[]): boolean {
  return edges.length >= 2 && edges.every((row) => row.left === 'handle' && row.right === 'handle')
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
    offsetMm: (innerW + T) / 2,
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
    upperTrackColor?: SlidingTrackColor
    lowerTrackColor?: SlidingTrackColor
    handleSkuId?: string
    capSkuId?: string
    softCloseLeft?: number
    softCloseRight?: number
  },
  panels: GeneratedPanel[],
  hardware: HardwareItem[],
  notes: string[],
  hardwareSettings: HardwareSettings,
): void {
  const leaves = layoutSlidingDoors(input)
  if (leaves.length === 0) return
  const bought = input.externalDoors === true
  const upperColor = input.upperTrackColor ?? 'black'
  const lowerColor = input.lowerTrackColor ?? 'black'
  const upperEur = hardwareSettings.slidingUpperTrackEur?.[upperColor] ?? DEFAULT_SLIDING_UPPER_TRACK_EUR[upperColor]
  const lowerEur = hardwareSettings.slidingLowerTrackEur?.[lowerColor] ?? DEFAULT_SLIDING_LOWER_TRACK_EUR[lowerColor]
  const kitEur = hardwareSettings.slidingMvp005KitEur ?? DEFAULT_SLIDING_MVP005_KIT_EUR
  const damperEur = hardwareSettings.slidingSoftCloseEur ?? DEFAULT_SLIDING_SOFT_CLOSE_EUR
  const softLeft = Math.max(0, input.softCloseLeft ?? 1)
  const softRight = Math.max(0, input.softCloseRight ?? 1)

  notes.push(
    `2 плъзгащи врати между страниците. Горната релса е ${SLIDING_UPPER_TRACK_DEPTH_MM} мм дълбока и ${SLIDING_UPPER_TRACK_HEIGHT_MM} мм висока, наравно с канта на плота. Вътрешните страници са с ${SLIDING_PARTITION_SETBACK_MM} мм по-плитки (${SLIDING_UPPER_TRACK_DEPTH_MM} мм релса + ${SLIDING_UPPER_TRACK_CLEARANCE_MM} мм запас), рафтовете с още ${SLIDING_SHELF_FROM_PARTITION_MM} мм.`,
  )
  notes.push(
    `Долната релса е ${SLIDING_LOWER_TRACK_DEPTH_MM} мм дълбока и ${SLIDING_BOTTOM_TRACK_MM} мм висока (два канала), ${SLIDING_LOWER_TRACK_INSET_MM} мм навътре от канта на дъното, за да пасне с горната.`,
  )
  notes.push(
    `Релсите се продават по ${formatMm(SLIDING_TRACK_LENGTH_MM)} мм — влиза цялата цена на пръта, дори да се отреже.`,
  )
  notes.push(
    `Вратите се препокриват с ${SLIDING_DOOR_OVERLAP_MM} мм. Кант дръжка D1L добавя ${SLIDING_HANDLE_PROFILE_MM} мм към широчината; профил D2 не добавя. Рязането е без вертикалните профили и без 2 мм кант горе и долу.`,
  )
  notes.push(
    `Чекмеджета отдолу започват на ${SLIDING_DRAWER_FROM_BOTTOM_MM} мм от дъното (${SLIDING_BOTTOM_TRACK_MM} мм релса + ${SLIDING_DRAWER_CLEARANCE_MM} мм да не търкат).`,
  )
  if (bought) {
    notes.push('Плъзгащите врати са външни: поръчват се по габарит, не влизат в разкроя и не се кантират при нас.')
  }

  for (const leaf of leaves) {
    const leftL = slidingEdgeLabel(leaf.edges.left)
    const rightL = slidingEdgeLabel(leaf.edges.right)
    if (bought) {
      notes.push(
        `${leaf.name}: поръчай габарит ${formatMm(leaf.gabaritW)} × ${formatMm(leaf.gabaritH)} мм (ляво ${leftL}, дясно ${rightL}).`,
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
        note: `Външна плъзгаща врата. Готов габарит ${formatMm(leaf.gabaritW)} × ${formatMm(leaf.gabaritH)} мм. Не се реже и не се кантира при нас. Поръчай отделно.`,
      })
      continue
    }
    notes.push(
      `${leaf.name}: габарит ${formatMm(leaf.gabaritW)} × ${formatMm(leaf.gabaritH)} мм · рязане ${formatMm(leaf.cutW)} × ${formatMm(leaf.cutH)} мм (ляво ${leftL} ${slidingProfileMm(leaf.edges.left)} мм, дясно ${rightL} ${slidingProfileMm(leaf.edges.right)} мм, кант 2 мм горе и долу).`,
    )
    panels.push({
      role: 'sliding-door',
      name: leaf.name,
      width: leaf.cutW,
      height: leaf.cutH,
      quantity: 1,
      canRotate: false,
      edges: edges({ top: true, bottom: true }),
      note: `Плъзгаща врата. Рязане без вертикалните профили. След D1L/D2: ${formatMm(leaf.gabaritW)} мм. Кант 2 мм: горна и долна.`,
    })
  }

  hardware.push(
    pricedLine(
      {
        id: `sliding-upper-track-${upperColor}`,
        name: `Горна релса MVP-005 3 м (${SLIDING_TRACK_COLOR_LABELS[upperColor]})`,
        unitPriceEur: upperEur,
      },
      1,
      `${formatMm(SLIDING_TRACK_LENGTH_MM)} мм прът`,
    ),
  )
  hardware.push(
    pricedLine(
      {
        id: `sliding-lower-track-${lowerColor}`,
        name: `Долна релса MVP-005 3 м (${SLIDING_TRACK_COLOR_LABELS[lowerColor]})`,
        unitPriceEur: lowerEur,
      },
      1,
      `${formatMm(SLIDING_TRACK_LENGTH_MM)} мм прът`,
    ),
  )
  hardware.push(
    pricedLine(
      {
        id: 'sliding-mvp005-kit',
        name: 'Механизъм MVP-005 (2 горни + 2 долни)',
        unitPriceEur: kitEur,
      },
      leaves.length,
      'комплект за 1 плъзгаща врата',
    ),
  )
  const dampers = softLeft + softRight
  if (dampers > 0) {
    hardware.push(
      pricedLine(
        {
          id: 'sliding-soft-close',
          name: 'Плавно прибиране MVP-005',
          unitPriceEur: damperEur,
        },
        dampers,
        `${softLeft} ляво + ${softRight} дясно`,
      ),
    )
  }

  if (bought) return

  const cutH = leaves[0]?.cutH ?? 0
  const handleCount = leaves.reduce(
    (n, leaf) => n + (leaf.edges.left === 'handle' ? 1 : 0) + (leaf.edges.right === 'handle' ? 1 : 0),
    0,
  )
  const capCount = leaves.reduce(
    (n, leaf) => n + (leaf.edges.left === 'cap' ? 1 : 0) + (leaf.edges.right === 'cap' ? 1 : 0),
    0,
  )
  const handleSku = handleCount > 0
    ? pickSlidingSku(hardwareSettings.slidingHandleSkus ?? [], cutH, input.handleSkuId)
    : null
  const capSku = capCount > 0
    ? pickSlidingSku(hardwareSettings.slidingCapSkus ?? [], cutH, input.capSkuId)
    : null
  if (handleSku && handleCount > 0) {
    if (handleSku.lengthMm < cutH) {
      notes.push(
        `Кант дръжка D1L ${handleSku.code} е ${formatMm(handleSku.lengthMm)} мм, а рязането е ${formatMm(cutH)} мм — избери по-дълъг профил.`,
      )
    }
    hardware.push(
      pricedLine(
        {
          id: `sliding-handle-${handleSku.id}`,
          name: `Кант дръжка D1L ${handleSku.code} (${handleSku.color})`,
          unitPriceEur: handleSku.priceEur,
        },
        handleCount,
        slidingSkuLabel(handleSku),
      ),
    )
  }
  if (capSku && capCount > 0) {
    if (capSku.lengthMm < cutH) {
      notes.push(
        `Профил D2 ${capSku.code} е ${formatMm(capSku.lengthMm)} мм, а рязането е ${formatMm(cutH)} мм — избери по-дълъг профил.`,
      )
    }
    hardware.push(
      pricedLine(
        {
          id: `sliding-cap-${capSku.id}`,
          name: `Алуминиев профил D2 ${capSku.code} (${capSku.color})`,
          unitPriceEur: capSku.priceEur,
        },
        capCount,
        slidingSkuLabel(capSku),
      ),
    )
  }
}
