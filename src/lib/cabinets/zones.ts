import {
  DOOR_CLEARANCE_TOP,
  DRAWER_DOOR_GAP,
  parseDoorCount,
  parseDrawerFrontHeights,
  parseShelfCount,
  remainingFrontHeight,
  type DoorCount,
} from './materials'

export const MAX_FIXED_SHELVES = 2
/** Minimum clear opening of a compartment, mm. */
export const MIN_ZONE_CLEAR_MM = 40

export type FixedShelfFrom = 'bottom' | 'top'
/** Which face of a board: горна or долна. */
export type PanelFace = 'top' | 'bottom'
export type CabinetZoneId = 'bottom' | 'middle' | 'top'
export type DoorSpan = 'full' | 'zones'

export interface FixedShelfSpec {
  from: FixedShelfFrom
  offsetMm: number
  /** Face of the carcass board we measure from (горна / долна). */
  fromFace: PanelFace
  /** Face of the fixed shelf we measure to (горна / долна). */
  toFace: PanelFace
}

export interface ZoneFittings {
  shelfCount: number
  doorCount: DoorCount
  drawerFrontHeights: number[]
  cutFromOneBoard: boolean
  hasClothesRail: boolean
}

export const EMPTY_ZONE_FITTINGS: ZoneFittings = {
  shelfCount: 0,
  doorCount: 0,
  drawerFrontHeights: [],
  cutFromOneBoard: false,
  hasClothesRail: false,
}

export interface ResolvedFixedShelf extends FixedShelfSpec {
  /** Inner-floor → bottom face of the shelf. */
  yBottom: number
  /** Inner-floor → top face of the shelf. */
  yTop: number
  /** Inner-floor coords of the two measure endpoints (start on carcass, end on shelf). */
  startY: number
  endY: number
}

/** Inner faces: from the inside of the carcass to the facing face of the shelf. */
export function defaultShelfFaces(from: FixedShelfFrom): { fromFace: PanelFace; toFace: PanelFace } {
  return from === 'bottom'
    ? { fromFace: 'top', toFace: 'bottom' }
    : { fromFace: 'bottom', toFace: 'top' }
}

function parseFace(raw: unknown, fallback: PanelFace): PanelFace {
  return raw === 'top' || raw === 'bottom' ? raw : fallback
}

/**
 * Convert a user offset into inner-floor coordinates.
 * y = 0 is the top of the bottom; y = innerH is the underside of the top.
 * Outer faces sit at -thickness (bottom) and innerH + thickness (top).
 */
export function measureFixedShelf(
  spec: FixedShelfSpec,
  innerH: number,
  thickness: number,
): { startY: number; endY: number; yBottom: number; yTop: number; fromFace: PanelFace; toFace: PanelFace } {
  const T = thickness
  const faces = defaultShelfFaces(spec.from)
  const fromFace = spec.fromFace ?? faces.fromFace
  const toFace = spec.toFace ?? faces.toFace
  let startY: number
  let endY: number
  if (spec.from === 'bottom') {
    startY = fromFace === 'bottom' ? -T : 0
    endY = startY + spec.offsetMm
  } else {
    startY = fromFace === 'top' ? innerH + T : innerH
    endY = startY - spec.offsetMm
  }
  const yBottom = toFace === 'top' ? endY - T : endY
  return { startY, endY, yBottom, yTop: yBottom + T, fromFace, toFace }
}

export function fixedShelfMeasureLabel(spec: FixedShelfSpec, topBoardName = 'горната плоскост'): string {
  const faces = defaultShelfFaces(spec.from)
  const fromFace = spec.fromFace ?? faces.fromFace
  const toFace = spec.toFace ?? faces.toFace
  const fromPanel = spec.from === 'bottom' ? 'дъното' : topBoardName
  const fromWord = fromFace === 'top' ? 'горната' : 'долната'
  const toWord = toFace === 'top' ? 'горната' : 'долната'
  return `${spec.offsetMm} мм от ${fromWord} страна на ${fromPanel} до ${toWord} страна на рафта`
}

export interface ResolvedZone {
  id: CabinetZoneId
  label: string
  /** Clear height between the boards that bound this compartment. */
  innerH: number
  /** Inner-floor → bottom of this opening. */
  y0: number
  /** Inner-floor → top of this opening. */
  y1: number
  isFirst: boolean
  isLast: boolean
  /**
   * Overlay front in inner-floor coords.
   * Bottom zone: outer bottom (−T) or top of a covering bottom (0) → top face of the shelf above.
   * Top zone: bottom face of the shelf below → outer top (innerH + T), or underside of a covering top (innerH).
   * Middle: bottom face of the shelf below → top face of the shelf above.
   */
  frontY0: number
  frontY1: number
  /** Outer front height allocated to this part. */
  frontHeight: number
}

export const ZONE_LABELS: Record<CabinetZoneId, string> = {
  bottom: 'Долна част',
  middle: 'Средна част',
  top: 'Горна част',
}

export function parseDoorSpan(raw: unknown): DoorSpan {
  return raw === 'zones' ? 'zones' : 'full'
}

export function parseFixedShelves(raw: unknown): FixedShelfSpec[] {
  if (!Array.isArray(raw)) return []
  const out: FixedShelfSpec[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const src = item as Record<string, unknown>
    const from: FixedShelfFrom = src.from === 'top' ? 'top' : 'bottom'
    const n = typeof src.offsetMm === 'number' ? src.offsetMm : Number.parseInt(String(src.offsetMm ?? ''), 10)
    if (!Number.isFinite(n) || n <= 0) continue
    const faces = defaultShelfFaces(from)
    out.push({
      from,
      offsetMm: Math.round(n),
      fromFace: parseFace(src.fromFace, faces.fromFace),
      toFace: parseFace(src.toFace, faces.toFace),
    })
    if (out.length >= MAX_FIXED_SHELVES) break
  }
  return out
}

export function parseZoneFittings(raw: unknown): ZoneFittings {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    shelfCount: parseShelfCount(src.shelfCount),
    doorCount: parseDoorCount(src.doorCount),
    drawerFrontHeights: parseDrawerFrontHeights(src.drawerFrontHeights),
    cutFromOneBoard: src.cutFromOneBoard === true,
    hasClothesRail: src.hasClothesRail === true,
  }
}

export function parseZoneMap(raw: unknown): Partial<Record<CabinetZoneId, ZoneFittings>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const src = raw as Record<string, unknown>
  const out: Partial<Record<CabinetZoneId, ZoneFittings>> = {}
  for (const id of ['bottom', 'middle', 'top'] as const) {
    if (src[id] != null) out[id] = parseZoneFittings(src[id])
  }
  return out
}

export function defaultFixedOffsetMm(innerH: number, thickness: number, already: number): number {
  const gaps = already + 2
  const clear = innerH - (already + 1) * thickness
  const piece = Math.round(clear / gaps)
  return Math.max(MIN_ZONE_CLEAR_MM, piece)
}

export function resolveFixedShelves(
  specs: FixedShelfSpec[],
  innerH: number,
  thickness: number,
): { shelves: ResolvedFixedShelf[]; error: string | null } {
  const T = thickness
  if (!(innerH > T + MIN_ZONE_CLEAR_MM * 2) || specs.length === 0) {
    return { shelves: [], error: specs.length === 0 ? null : 'Няма място за фиксиран рафт.' }
  }

  const resolved: ResolvedFixedShelf[] = specs.map((s) => {
    const m = measureFixedShelf(s, innerH, T)
    return {
      ...s,
      fromFace: m.fromFace,
      toFace: m.toFace,
      yBottom: m.yBottom,
      yTop: m.yTop,
      startY: m.startY,
      endY: m.endY,
    }
  })
  resolved.sort((a, b) => a.yBottom - b.yBottom)

  for (const s of resolved) {
    if (s.yBottom < MIN_ZONE_CLEAR_MM) {
      return {
        shelves: [],
        error:
          s.from === 'bottom'
            ? `Разстоянието отдолу трябва да е поне ${MIN_ZONE_CLEAR_MM} мм.`
            : 'Фиксираният рафт влиза в долната част.',
      }
    }
    if (s.yTop > innerH - MIN_ZONE_CLEAR_MM) {
      return {
        shelves: [],
        error:
          s.from === 'top'
            ? `Разстоянието отгоре трябва да е поне ${MIN_ZONE_CLEAR_MM} мм.`
            : 'Фиксираният рафт влиза в горната част.',
      }
    }
  }

  for (let i = 1; i < resolved.length; i++) {
    const gap = resolved[i].yBottom - resolved[i - 1].yTop
    if (gap < MIN_ZONE_CLEAR_MM) {
      return { shelves: [], error: `Между фиксираните рафтове трябва да има поне ${MIN_ZONE_CLEAR_MM} мм.` }
    }
  }

  return { shelves: resolved, error: null }
}

export function zoneHasOverlayFronts(z: {
  doorCount: DoorCount
  drawerFrontHeights: number[]
}): boolean {
  return z.doorCount > 0 || z.drawerFrontHeights.some((h) => h > 0)
}

/**
 * When neighbouring parts both have doors/fronts, they must not overlap on the
 * shelf: meet at the lower part's top (top face of the shelf). The 3 mm фуга
 * at the top of the lower stack is then the gap between the two parts.
 */
export function joinAdjacentZoneFronts(zones: LaidOutZone[]): void {
  for (let i = 0; i < zones.length - 1; i++) {
    const lower = zones[i]
    const upper = zones[i + 1]
    if (!zoneHasOverlayFronts(lower) || !zoneHasOverlayFronts(upper)) continue
    upper.frontY0 = lower.frontY1
    upper.frontHeight = Math.max(0, upper.frontY1 - upper.frontY0)
  }
}

export type ZoneFrontStackKind = 'empty' | 'full' | 'half' | 'mixed'

/** Same-width overlay pieces in a part: full-width (чела / 1 врата) or half (2 врати). */
export function zoneFrontStackKind(z: {
  doorCount: DoorCount
  drawerFrontHeights: number[]
}): ZoneFrontStackKind {
  const drawers = z.drawerFrontHeights.filter((h) => h > 0)
  if (z.doorCount === 0 && drawers.length === 0) return 'empty'
  if (z.doorCount === 2 && drawers.length > 0) return 'mixed'
  if (z.doorCount === 2) return 'half'
  return 'full'
}

/** Consecutive parts that both have fronts, bottom → top. */
export function consecutiveZoneFrontRuns(zones: LaidOutZone[]): LaidOutZone[][] {
  const runs: LaidOutZone[][] = []
  let current: LaidOutZone[] = []
  for (const z of zones) {
    if (zoneHasOverlayFronts(z)) {
      current.push(z)
    } else if (current.length > 0) {
      runs.push(current)
      current = []
    }
  }
  if (current.length > 0) runs.push(current)
  return runs
}

function fullWidthPieceCount(z: { doorCount: DoorCount; drawerFrontHeights: number[] }): number {
  return z.drawerFrontHeights.filter((h) => h > 0).length + (z.doorCount === 1 ? 1 : 0)
}

/** Neighbouring parts can share one first-cut board for continuous grain. */
export function canCombineZoneFrontRun(zones: LaidOutZone[]): boolean {
  if (zones.length < 2) return false
  const kinds = zones.map(zoneFrontStackKind)
  if (kinds.some((k) => k === 'mixed' || k === 'empty')) return false
  if (kinds.every((k) => k === 'full')) {
    return zones.reduce((n, z) => n + fullWidthPieceCount(z), 0) >= 2
  }
  if (kinds.every((k) => k === 'half')) return true
  return false
}

export function canCombineAdjacentZoneFronts(zones: LaidOutZone[]): boolean {
  return consecutiveZoneFrontRuns(zones).some(canCombineZoneFrontRun)
}

/**
 * Whether an overlay door / front covers the front edge of the top or bottom panel.
 * Default is cover both (kitchen carcass, inner top). Set `top: false` when the top
 * overhangs the sides — the door stops at the underside so the top's edge banding stays visible.
 */
export interface OverlayFrontCovers {
  top?: boolean
  bottom?: boolean
}

/** Inner-floor span of the overlay front for the whole carcass. */
export function overlayFrontExtent(
  innerH: number,
  thickness: number,
  covers?: OverlayFrontCovers,
): { frontY0: number; frontY1: number; frontHeight: number } {
  const coverTop = covers?.top !== false
  const coverBottom = covers?.bottom !== false
  const frontY0 = coverBottom ? -thickness : 0
  const frontY1 = coverTop ? innerH + thickness : innerH
  return { frontY0, frontY1, frontHeight: Math.max(0, frontY1 - frontY0) }
}

export function cabinetZones(
  shelves: ResolvedFixedShelf[],
  innerH: number,
  thickness: number,
  overlayCovers?: OverlayFrontCovers,
): ResolvedZone[] {
  const openings: { y0: number; y1: number }[] = []
  let cursor = 0
  for (const s of shelves) {
    openings.push({ y0: cursor, y1: s.yBottom })
    cursor = s.yTop
  }
  openings.push({ y0: cursor, y1: innerH })

  const ids: CabinetZoneId[] =
    openings.length === 1 ? ['bottom'] : openings.length === 2 ? ['bottom', 'top'] : ['bottom', 'middle', 'top']
  const extent = overlayFrontExtent(innerH, thickness, overlayCovers)

  return openings.map((o, i) => {
    const isFirst = i === 0
    const isLast = i === openings.length - 1
    const inner = Math.max(0, o.y1 - o.y0)
    const shelfBelow = i > 0 ? shelves[i - 1] : undefined
    const shelfAbove = i < shelves.length ? shelves[i] : undefined
    const frontY0 = isFirst ? extent.frontY0 : (shelfBelow?.yBottom ?? o.y0)
    const frontY1 = isLast ? extent.frontY1 : (shelfAbove?.yTop ?? o.y1)
    const id = ids[i] ?? 'bottom'
    return {
      id,
      label: openings.length === 1 ? 'Шкаф' : ZONE_LABELS[id],
      innerH: inner,
      y0: o.y0,
      y1: o.y1,
      isFirst,
      isLast,
      frontY0,
      frontY1,
      frontHeight: Math.max(0, frontY1 - frontY0),
    }
  })
}

export interface LaidOutZone extends ResolvedZone, ZoneFittings {}

export interface InteriorLayout {
  shelves: ResolvedFixedShelf[]
  zones: LaidOutZone[]
  doorSpan: DoorSpan
  fullDoorCount: DoorCount
  /** Drawers stacked on the whole carcass (not in a zone). */
  fullDrawerFrontHeights: number[]
  error: string | null
}

export function zoneFittingsOf(
  zones: Partial<Record<CabinetZoneId, ZoneFittings>> | undefined,
  id: CabinetZoneId,
): ZoneFittings {
  return { ...EMPTY_ZONE_FITTINGS, ...(zones?.[id] ?? {}) }
}

export function layoutInterior(input: {
  innerH: number
  thickness: number
  fixedShelves: FixedShelfSpec[]
  doorSpan: DoorSpan
  doorCount: DoorCount
  shelfCount: number
  drawerFrontHeights: number[]
  cutFromOneBoard: boolean
  hasClothesRail: boolean
  zones?: Partial<Record<CabinetZoneId, ZoneFittings>>
  overlayCovers?: OverlayFrontCovers
}): InteriorLayout {
  const { shelves, error } = resolveFixedShelves(input.fixedShelves, input.innerH, input.thickness)
  const rawZones = cabinetZones(shelves, input.innerH, input.thickness, input.overlayCovers)
  const zoned = shelves.length > 0
  const doorSpan: DoorSpan = zoned ? input.doorSpan : 'full'

  const zones: LaidOutZone[] = rawZones.map((z) => {
    if (!zoned) {
      return {
        ...z,
        shelfCount: input.shelfCount,
        doorCount: input.doorCount,
        drawerFrontHeights: input.drawerFrontHeights,
        cutFromOneBoard: input.cutFromOneBoard,
        hasClothesRail: input.hasClothesRail,
      }
    }
    const f = zoneFittingsOf(input.zones, z.id)
    return {
      ...z,
      ...f,
      doorCount: doorSpan === 'zones' ? f.doorCount : 0,
    }
  })
  joinAdjacentZoneFronts(zones)

  return {
    shelves,
    zones,
    doorSpan,
    fullDoorCount: zoned && doorSpan === 'full' ? input.doorCount : 0,
    fullDrawerFrontHeights: zoned ? input.drawerFrontHeights.filter((h) => h > 0) : [],
    error,
  }
}

export function layoutCounts(layout: InteriorLayout): {
  fixedShelves: number
  shelfCount: number
  doorCount: number
  drawerCount: number
  clothesRailCount: number
} {
  let shelfCount = 0
  let doorCount = layout.fullDoorCount
  let drawerCount = layout.fullDrawerFrontHeights.length
  let clothesRailCount = 0
  for (const z of layout.zones) {
    shelfCount += z.shelfCount
    doorCount += z.doorCount
    drawerCount += z.drawerFrontHeights.length
    if (z.hasClothesRail) clothesRailCount += 1
  }
  return {
    fixedShelves: layout.shelves.length,
    shelfCount,
    doorCount,
    drawerCount,
    clothesRailCount,
  }
}

export function allDrawerFrontHeights(layout: InteriorLayout): number[] {
  return [...layout.fullDrawerFrontHeights, ...layout.zones.flatMap((z) => z.drawerFrontHeights)]
}

export function zoneFrontBox(
  zone: ResolvedZone,
  opts: { innerFloorY: number; carcassTopY: number; carcassBotY: number; thickness: number },
): { y: number; h: number } {
  if (zone.isFirst && zone.isLast) {
    return { y: opts.carcassTopY, h: Math.max(1, opts.carcassBotY - opts.carcassTopY) }
  }
  const y = opts.innerFloorY - zone.frontY1
  return { y, h: Math.max(1, zone.frontHeight) }
}

export interface StackedFront {
  kind: 'drawer' | 'door'
  yFromFrontTop: number
  height: number
  index: number
  doorIndex?: number
  doorCount?: DoorCount
}

/** Finished front rectangles inside a zone (or the whole carcass), top → bottom. */
export function stackFronts(input: {
  frontHeight: number
  doorCount: DoorCount
  drawerFrontHeights: number[]
}): StackedFront[] {
  const drawers = input.drawerFrontHeights.filter((h) => h > 0)
  const hasDoor = input.doorCount === 1 || input.doorCount === 2
  const out: StackedFront[] = []
  let y = DOOR_CLEARANCE_TOP
  if (!hasDoor && drawers.length > 0) {
    const leftover = remainingFrontHeight(input.frontHeight, drawers, false)
    if (leftover > 0) y += leftover
  }
  drawers.forEach((h, i) => {
    out.push({ kind: 'drawer', yFromFrontTop: y, height: h, index: i })
    y += h + DRAWER_DOOR_GAP
  })
  if (hasDoor) {
    const leftover = remainingFrontHeight(input.frontHeight, drawers, true)
    if (leftover > 0) {
      out.push({
        kind: 'door',
        yFromFrontTop: y,
        height: leftover,
        index: 0,
        doorCount: input.doorCount,
      })
    }
  }
  return out
}

export function validateZoneFronts(layout: InteriorLayout, carcassFrontHeight: number): string | null {
  if (layout.error) return layout.error
  for (const z of layout.zones) {
    const leftover = remainingFrontHeight(z.frontHeight, z.drawerFrontHeights, z.doorCount > 0)
    if (leftover < 0) {
      return `${z.label}: челата не събират във височината.`
    }
    if (z.doorCount > 0 && leftover < 80) {
      return `${z.label}: останалата височина за вратата е твърде малка.`
    }
  }
  if (layout.fullDoorCount > 0 || layout.fullDrawerFrontHeights.length > 0) {
    const leftover = remainingFrontHeight(
      carcassFrontHeight,
      layout.fullDrawerFrontHeights,
      layout.fullDoorCount > 0,
    )
    if (leftover < 0) return 'Челата на целия шкаф не събират във височината.'
    if (layout.fullDoorCount > 0 && leftover < 80) return 'Височината за вратите на целия шкаф е твърде малка.'
  }
  return null
}

export function fittingsCountsFromParams(p: {
  fixedShelves?: FixedShelfSpec[]
  doorSpan?: DoorSpan
  doorCount: DoorCount
  shelfCount: number
  drawerFrontHeights: number[]
  hasClothesRail?: boolean
  zones?: Partial<Record<CabinetZoneId, ZoneFittings>>
}): {
  fixedShelves: number
  shelfCount: number
  doorCount: number
  drawerCount: number
  clothesRailCount: number
} {
  const fixed = p.fixedShelves?.length ?? 0
  if (fixed === 0) {
    return {
      fixedShelves: 0,
      shelfCount: p.shelfCount,
      doorCount: p.doorCount,
      drawerCount: p.drawerFrontHeights.length,
      clothesRailCount: p.hasClothesRail ? 1 : 0,
    }
  }
  const ids: CabinetZoneId[] = fixed === 1 ? ['bottom', 'top'] : ['bottom', 'middle', 'top']
  let shelfCount = 0
  let doorCount = p.doorSpan === 'full' ? p.doorCount : 0
  let drawerCount = p.drawerFrontHeights.length
  let clothesRailCount = 0
  for (const id of ids) {
    const z = zoneFittingsOf(p.zones, id)
    shelfCount += z.shelfCount
    if (p.doorSpan !== 'full') doorCount += z.doorCount
    drawerCount += z.drawerFrontHeights.length
    if (z.hasClothesRail) clothesRailCount += 1
  }
  return { fixedShelves: fixed, shelfCount, doorCount, drawerCount, clothesRailCount }
}
