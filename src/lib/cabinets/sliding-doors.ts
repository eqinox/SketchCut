import { pricedLine, SLIDE_REAR_CLEARANCE_MM } from './hardware'
import { DOOR_CLEARANCE_TOP, DOOR_SIDE_GAP_EACH, INNER_DRAWER_SIDE_GAP_EACH } from './materials'
import { DEFAULT_PANEL_THICKNESS, edges, type GeneratedPanel, type HardwareItem } from './types'
import type { HardwareSettings } from '@/lib/settings'
import type { PartitionSpec } from './zones'
import { formatMm } from '../utils'
import type { RuleSection } from './rule-text'
import {
  DEFAULT_SLIDING_LOWER_TRACK_EUR,
  DEFAULT_SLIDING_MVP005_KIT_EUR,
  DEFAULT_SLIDING_SOFT_CLOSE_EUR,
  DEFAULT_SLIDING_CAP_SKUS,
  DEFAULT_SLIDING_HANDLE_SKUS,
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
/**
 * Lowest drawer front sits this far above the inner floor when drawers start
 * from the bottom of a sliding wardrobe. Advance over the 4 mm lower track —
 * the front starts here as if it were 0, with no extra 3 mm bottom фуга.
 */
export const SLIDING_DRAWER_FROM_BOTTOM_MM = 20
/** Vertical handle profile D1L, mm added after the cut. */
export const SLIDING_HANDLE_PROFILE_MM = 20
/** Soft-close dampers assumed on each side when the count is left unset. */
export const DEFAULT_SLIDING_SOFT_CLOSE_PER_SIDE = 1
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

/**
 * Three equal doors. Two sit on the rear rail, one on the front rail.
 * Closed: left rear, middle front, right rear.
 * The front door has a handle on both edges. Each rear door has a handle
 * only on its outer edge and a D2 cap toward the middle.
 */
export function threeDoorSlidingEdges(): SlidingDoorEdges[] {
  return [
    { left: 'handle', right: 'cap' },
    { left: 'handle', right: 'handle' },
    { left: 'cap', right: 'handle' },
  ]
}

export function parseSlidingDoorCount(raw: unknown): 2 | 3 {
  return raw === 3 ? 3 : 2
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
  side: 'left' | 'middle' | 'right'
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

/** Finished width of each of three equal doors. They overlap by SLIDING_DOOR_OVERLAP_MM at each joint. */
export function threeDoorGabarit(innerW: number): number {
  return Math.round((innerW + 2 * SLIDING_DOOR_OVERLAP_MM) / 3)
}

/** Clear opening when the two rear doors and the front door are stacked to one side. */
export function threeDoorClearOpening(innerW: number): number {
  return innerW - 2 * threeDoorGabarit(innerW)
}

/** A door may cover the bay by this much and the bay is still usable for shelves or a rail. */
export const SLIDING_ACCESS_INTRUSION_MM = 20
/** Extra room past the drawer front so it can be pulled out. */
export const SLIDING_DRAWER_PASS_LUFT_MM = 20

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
  if (input.edges.length >= 3) return layoutThreeSlidingDoors(innerW, innerH, T)
  const split = splitXLeft(innerW, T, input.partitions)
  const leftBase = split.xLeft + split.thickness
  const rightBase = innerW - split.xLeft
  const overlap = SLIDING_DOOR_OVERLAP_MM
  const gabaritH = innerH
  const cutH = gabaritH
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

function layoutThreeSlidingDoors(innerW: number, innerH: number, thickness: number): SlidingDoorLeaf[] {
  const gabaritW = threeDoorGabarit(innerW)
  const edges = threeDoorSlidingEdges()
  const names = ['Лява задна врата', 'Средна предна врата', 'Дясна задна врата'] as const
  const sides = ['left', 'middle', 'right'] as const
  const xs = [0, (innerW - gabaritW) / 2, innerW - gabaritW]
  return edges.map((edge, index) => ({
    index,
    side: sides[index],
    name: names[index],
    gabaritW,
    cutW: Math.max(thickness, gabaritW - slidingProfileMm(edge.left) - slidingProfileMm(edge.right)),
    cutH: innerH,
    gabaritH: innerH,
    edges: edge,
    x: xs[index],
  }))
}

export type ThreeDoorColumn = {
  x0: number
  x1: number
  frontX0: number
  frontX1: number
}

/** Where to put the two dividers so each side can be reached. xLeft of each page, from the inner left. */
export function threeDoorPartitionOffsets(
  innerW: number,
  thickness: number,
  drawerColumns: number[],
  insetDrawers: boolean,
): [number, number] | null {
  const T = thickness
  const gabarit = threeDoorGabarit(innerW)
  const clear = threeDoorClearOpening(innerW)
  const intrusion = SLIDING_ACCESS_INTRUSION_MM
  const luft = SLIDING_DRAWER_PASS_LUFT_MM
  const gap = insetDrawers ? INNER_DRAWER_SIDE_GAP_EACH : DOOR_SIDE_GAP_EACH
  if (!(clear > intrusion) || !(innerW > 2 * T + 120)) return null
  const p1Min = gabarit - intrusion - T
  const p1Max = clear + intrusion
  const p2Min = innerW - clear - intrusion - T
  const p2Max = innerW - gabarit + intrusion
  if (p1Min > p1Max + 0.5 || p2Min > p2Max + 0.5) return null
  let p1Lo = p1Min
  let p1Hi = p1Max
  let p2Lo = p2Min
  let p2Hi = p2Max
  const wants = new Set(drawerColumns)
  if (wants.has(0)) {
    const limit = insetDrawers ? clear - luft + gap : clear - luft - T + gap
    p1Hi = Math.min(p1Hi, limit)
  }
  if (wants.has(2)) {
    const limit = insetDrawers ? innerW - (clear - luft + gap) : innerW - (clear - luft - T + gap)
    p2Lo = Math.max(p2Lo, limit - T)
  }
  if (wants.has(1)) {
    const midLeft = gabarit + luft - (insetDrawers ? gap : gap - T)
    const midRight = innerW - gabarit - luft - (insetDrawers ? 0 : T) + gap
    p1Lo = Math.max(p1Lo, insetDrawers ? midLeft - T - gap : midLeft - gap)
    p2Hi = Math.min(p2Hi, midRight)
  }
  if (p1Lo > p1Hi + 0.5 || p2Lo > p2Hi + 0.5) {
    const bay = (innerW - 2 * T) / 3
    return [bay, 2 * bay + T]
  }
  const bay = (innerW - 2 * T) / 3
  const p1 = Math.min(p1Hi, Math.max(p1Lo, bay))
  const p2 = Math.min(p2Hi, Math.max(p2Lo, 2 * bay + T))
  if (p2 < p1 + T + 40) {
    return [bay, 2 * bay + T]
  }
  return [p1, p2]
}

export function assessThreeSlidingDoors(input: {
  innerW: number
  thickness: number
  columns: ThreeDoorColumn[]
  drawerColumns: number[]
  fullWidthDrawers: boolean
  insetDrawers: boolean
}): { issues: string[]; offsets: [number, number] | null } {
  const innerW = input.innerW
  const gabarit = threeDoorGabarit(innerW)
  const clear = threeDoorClearOpening(innerW)
  const intrusion = SLIDING_ACCESS_INTRUSION_MM
  const luft = SLIDING_DRAWER_PASS_LUFT_MM
  const gap = input.insetDrawers ? INNER_DRAWER_SIDE_GAP_EACH : DOOR_SIDE_GAP_EACH
  const shelfWindows = [
    { x0: 0, x1: clear + intrusion },
    { x0: gabarit - intrusion, x1: innerW - gabarit + intrusion },
    { x0: innerW - clear - intrusion, x1: innerW },
  ]
  const issues: string[] = []
  if (input.fullWidthDrawers) {
    issues.push('Чекмеджето е на целия гардероб. Сложи го в една страна, за да мине през отвора на вратите.')
  }
  input.columns.forEach((col, index) => {
    const name = input.columns.length === 1 ? 'Гардеробът' : `Страна ${index + 1}`
    const fitsShelf = shelfWindows.some((w) => col.x0 >= w.x0 - 0.5 && col.x1 <= w.x1 + 0.5)
    if (!fitsShelf) {
      issues.push(
        `${name} се закрива от вратата с повече от ${intrusion} мм и не се обслужва. Отворът пред вратите е ${formatMm(clear)} мм.`,
      )
    }
    if (!input.drawerColumns.includes(index)) return
    const span = input.insetDrawers
      ? { left: col.x0 + gap, right: col.x1 - gap }
      : { left: col.frontX0 + gap, right: col.frontX1 - gap }
    const width = span.right - span.left
    const fitsLeft = span.right <= clear - luft + 0.5
    const fitsMiddle = span.left >= gabarit + luft - 0.5 && span.right <= innerW - gabarit - luft + 0.5
    const fitsRight = span.left >= innerW - clear + luft - 0.5
    if (fitsLeft || fitsMiddle || fitsRight) return
    issues.push(
      `${name}: чекмеджето е ${formatMm(width)} мм и трябва още ${luft} мм луфт. Отворът, когато вратите са събрани встрани, е ${formatMm(clear)} мм.` +
        (input.insetDrawers ? '' : ' Външното чело покрива страницата и не минава — сложи вътрешно чело.'),
    )
  })
  return {
    issues,
    offsets: threeDoorPartitionOffsets(innerW, input.thickness, input.drawerColumns, input.insetDrawers),
  }
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
  const softLeft = Math.max(0, input.softCloseLeft ?? DEFAULT_SLIDING_SOFT_CLOSE_PER_SIDE)
  const softRight = Math.max(0, input.softCloseRight ?? DEFAULT_SLIDING_SOFT_CLOSE_PER_SIDE)

  notes.push(
    leaves.length >= 3
      ? `3 еднакви плъзгащи врати. Двете задни са на задната релса, средната е на предната. Затворено: лява отляво, средна по средата, дясна отдясно. Средната е с кант дръжка от двете страни. Лявата задна е с дръжка отляво и профил отдясно, дясната задна — с дръжка отдясно и профил отляво.`
      : `2 плъзгащи врати между страниците.`,
  )
  notes.push(
    `Горната релса е ${SLIDING_UPPER_TRACK_DEPTH_MM} мм дълбока и ${SLIDING_UPPER_TRACK_HEIGHT_MM} мм висока, наравно с канта на плота. Вътрешните страници са с ${SLIDING_PARTITION_SETBACK_MM} мм по-плитки (${SLIDING_UPPER_TRACK_DEPTH_MM} мм релса + ${SLIDING_UPPER_TRACK_CLEARANCE_MM} мм запас).`,
  )
  notes.push(
    `Долната релса е ${SLIDING_LOWER_TRACK_DEPTH_MM} мм дълбока и ${SLIDING_BOTTOM_TRACK_MM} мм висока (два канала), ${SLIDING_LOWER_TRACK_INSET_MM} мм навътре от канта на дъното, за да пасне с горната.`,
  )
  notes.push(
    `Релсите се продават по ${formatMm(SLIDING_TRACK_LENGTH_MM)} мм — влиза цялата цена на пръта, дори да се отреже.`,
  )
  notes.push(
    `Вратите се препокриват с ${SLIDING_DOOR_OVERLAP_MM} мм. Кант дръжка D1L добавя ${SLIDING_HANDLE_PROFILE_MM} мм към широчината; профил D2 не добавя. Рязането е без вертикалните профили. Височината е равна на габарита. Горе и долу се лепи тънък кант 0,5 мм.`,
  )
  notes.push(
    `Чекмеджета отдолу започват на ${SLIDING_DRAWER_FROM_BOTTOM_MM} мм от дъното — аванс над долната релса. Челото сяда там, без още 3 мм фуга отдолу.`,
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
      `${leaf.name}: габарит ${formatMm(leaf.gabaritW)} × ${formatMm(leaf.gabaritH)} мм · рязане ${formatMm(leaf.cutW)} × ${formatMm(leaf.cutH)} мм (ляво ${leftL} ${slidingProfileMm(leaf.edges.left)} мм, дясно ${rightL} ${slidingProfileMm(leaf.edges.right)} мм, тънък кант 0,5 мм горе и долу).`,
    )
    panels.push({
      role: 'sliding-door',
      name: leaf.name,
      width: leaf.cutW,
      height: leaf.cutH,
      quantity: 1,
      canRotate: false,
      edges: edges({ top: true, bottom: true }, 'mm05'),
      note: `Плъзгаща врата. Рязане без вертикалните профили. След D1L/D2: ${formatMm(leaf.gabaritW)} мм. Тънък кант 0,5 мм: горна и долна.`,
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

export function slidingDoorRuleSection(): RuleSection {
  const T = DEFAULT_PANEL_THICKNESS
  const innerW = 1000
  const innerH = 2000
  const both = layoutSlidingDoors({
    innerW,
    innerH,
    thickness: T,
    partitions: [],
    edges: bothSideSlidingEdges(),
  })
  const oneSide = layoutSlidingDoors({
    innerW,
    innerH,
    thickness: T,
    partitions: [],
    edges: oneSideSlidingEdges(),
  })
  const handleLeaf = both[0]
  const capLeaf = oneSide[0]
  const barLengths = [...new Set(DEFAULT_SLIDING_HANDLE_SKUS.concat(DEFAULT_SLIDING_CAP_SKUS).map((sku) => sku.lengthMm))]
    .sort((a, b) => a - b)
    .map((mm) => formatMm(mm))
    .join(', ')
  return {
    id: 'sliding',
    title: 'Плъзгащи врати',
    blocks: [
      {
        title: 'Релси',
        lines: [
          `Горна релса: ${SLIDING_UPPER_TRACK_DEPTH_MM} мм дълбока, ${SLIDING_UPPER_TRACK_HEIGHT_MM} мм висока, наравно с канта на плота.`,
          `Долна релса: ${SLIDING_LOWER_TRACK_DEPTH_MM} мм дълбока, ${SLIDING_LOWER_TRACK_HEIGHT_MM} мм висока (два канала), ${SLIDING_LOWER_TRACK_INSET_MM} мм навътре от канта на дъното.`,
          `Продават се само по ${formatMm(SLIDING_TRACK_LENGTH_MM / 1000)} м. В цената влиза целият прът. Цветът и цената са в Настройки.`,
        ],
      },
      {
        title: 'Корпусът зад вратите',
        lines: [
          `Написаната дълбочина е заедно с механизма. Вътрешните страници и разделителите са с ${SLIDING_PARTITION_SETBACK_MM} мм по-плитки (${SLIDING_UPPER_TRACK_DEPTH_MM} мм релса + ${SLIDING_UPPER_TRACK_CLEARANCE_MM} мм запас).`,
          `Рафтовете са още по-плитки от вътрешната страница. По подразбиране с ${SLIDING_SHELF_FROM_PARTITION_MM} мм.`,
          `Водачът се слага на вътрешната страница и е по-къс от нея с ${SLIDE_REAR_CLEARANCE_MM} мм луфт отзад. Външно чело вади още дебелината на челото.`,
          `Двете врати се препокриват с ${SLIDING_DOOR_OVERLAP_MM} мм.`,
          `Три врати са еднакви: габарит (отвор + 2×${SLIDING_DOOR_OVERLAP_MM}) / 3. Две на задната релса, една на предната. Страната се обслужва, ако вратата я закрива с най-много ${SLIDING_ACCESS_INTRUSION_MM} мм. Чекмеджето минава, ако отворът е по-широк от челото с ${SLIDING_DRAWER_PASS_LUFT_MM} мм.`,
        ],
      },
      {
        title: 'Размер на една врата',
        lines: [
          `Рязане по височина = светъл отвор. Горе и долу се лепи тънък кант 0,5 мм и размерът не се скъсява.`,
          `Кант дръжка D1L добавя ${SLIDING_HANDLE_PROFILE_MM} мм. Профил D2 за ${T} мм плоскост добавя ${SLIDING_CAP_PROFILE_MM} мм.`,
          handleLeaf
            ? `Отвор ${innerW} × ${innerH} мм, D1L от двете страни: габарит ${formatMm(handleLeaf.gabaritW)} × ${formatMm(handleLeaf.gabaritH)} мм, рязане ${formatMm(handleLeaf.cutW)} × ${formatMm(handleLeaf.cutH)} мм.`
            : '',
          capLeaf
            ? `Същият отвор, D1L отвън и D2 отвътре: рязане ${formatMm(capLeaf.cutW)} × ${formatMm(capLeaf.cutH)} мм.`
            : '',
          `Профилите се купуват на цял прът: ${barLengths} мм.`,
          'Ако вратите са външни, в разкроя не влизат: поръчва се габаритът.',
        ].filter((line) => line !== ''),
      },
      {
        title: 'Обков на врата',
        lines: [
          'Механизъм MVP-005: 1 комплект (2 горни + 2 долни ролки) на врата.',
          `Плавно прибиране по подразбиране: ${DEFAULT_SLIDING_SOFT_CLOSE_PER_SIDE} отляво и ${DEFAULT_SLIDING_SOFT_CLOSE_PER_SIDE} отдясно.`,
        ],
      },
      {
        title: 'Чекмеджета от дъното',
        lines: [
          `Най-долното чело сяда на ${SLIDING_DRAWER_FROM_BOTTOM_MM} мм от дъното. Това е новият нула, без още ${DOOR_CLEARANCE_TOP} мм фуга отдолу.`,
          `Горе остава фугата ${DOOR_CLEARANCE_TOP} мм. Над фиксиран рафт тези ${SLIDING_DRAWER_FROM_BOTTOM_MM} мм не важат.`,
        ],
      },
    ],
  }
}
