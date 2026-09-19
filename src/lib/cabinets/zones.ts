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
/** Up to 3 dividers → 4 columns (лява / средни / дясна). */
export const MAX_PARTITIONS = 3
/** Cap for the stored list: 2 рафта на колона × до 4 колони. */
export const MAX_FIXED_SHELF_SPECS = MAX_FIXED_SHELVES * (MAX_PARTITIONS + 1)
/** Minimum clear opening of a compartment, mm. */
export const MIN_ZONE_CLEAR_MM = 40

export type FixedShelfFrom = 'bottom' | 'top'
export type PartitionFrom = 'left' | 'right'
/** Which face of a board: горна or долна. */
export type PanelFace = 'top' | 'bottom'
/** Left or right face of a vertical panel. */
export type SideFace = 'left' | 'right'
/** Row id when split only by fixed shelves. */
export type CabinetRowId = 'bottom' | 'middle' | 'top'
/** Compartment key: `bottom` | `c0` | `c0-bottom` | … */
export type CabinetZoneId = string
export type DoorSpan = 'full' | 'zones'

export interface FixedShelfSpec {
  from: FixedShelfFrom
  offsetMm: number
  /** Face of the carcass board we measure from (горна / долна). */
  fromFace: PanelFace
  /** Face of the fixed shelf we measure to (горна / долна). */
  toFace: PanelFace
  /**
   * Which vertical bay the shelf sits in (0-based, left → right).
   * `null` / omitted: same height in every bay (на целия шкаф).
   */
  columnIndex?: number | null
}

export interface PartitionSpec {
  from: PartitionFrom
  offsetMm: number
  /** Face of the origin board we measure from (лява / дясна). */
  fromFace: SideFace
  /** Face of the divider we measure to (лява / дясна). */
  toFace: SideFace
  /**
   * Measure from an already added divider (0-based index in the user list).
   * `null` / omitted: from the carcass left or right side (`from`).
   */
  fromPartition?: number | null
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

export interface ResolvedPartition extends PartitionSpec {
  /** Index in the user-facing list (Страница 1 = 0). */
  specIndex: number
  /** Inner-left → left face of the divider. */
  xLeft: number
  /** Inner-left → right face of the divider. */
  xRight: number
  /** Inner-left coords of the two measure endpoints (start on origin, end on divider). */
  startX: number
  endX: number
}

/** Inner faces: from the inside of the carcass to the facing face of the divider. */
export function defaultPartitionFaces(from: PartitionFrom): { fromFace: SideFace; toFace: SideFace } {
  return from === 'left'
    ? { fromFace: 'right', toFace: 'left' }
    : { fromFace: 'left', toFace: 'right' }
}

function parseSideFace(raw: unknown, fallback: SideFace): SideFace {
  return raw === 'left' || raw === 'right' ? raw : fallback
}

function parseFromPartition(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return raw
  const n = Number.parseInt(String(raw ?? ''), 10)
  return Number.isInteger(n) && n >= 0 ? n : null
}

export function parseColumnIndex(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= MAX_PARTITIONS) return raw
  const n = Number.parseInt(String(raw ?? ''), 10)
  return Number.isInteger(n) && n >= 0 && n <= MAX_PARTITIONS ? n : null
}

/** `null` = every bay; otherwise clamp to a valid column. */
export function normalizeShelfColumnIndex(
  columnIndex: number | null | undefined,
  columnCount: number,
): number | null {
  if (columnCount <= 1 || columnIndex == null) return null
  if (columnIndex < 0) return 0
  if (columnIndex >= columnCount) return columnCount - 1
  return columnIndex
}

export function shelvesForColumn<T extends { columnIndex?: number | null }>(
  shelves: T[],
  colIndex: number,
): T[] {
  return shelves.filter((s) => s.columnIndex == null || s.columnIndex === colIndex)
}

export function canAddFixedShelfToColumn(
  shelves: { columnIndex?: number | null }[],
  colIndex: number,
): boolean {
  return shelvesForColumn(shelves, colIndex).length < MAX_FIXED_SHELVES
}

export function canAddFixedShelfFull(shelves: { columnIndex?: number | null }[], columnCount: number): boolean {
  const n = Math.max(1, columnCount)
  for (let c = 0; c < n; c++) {
    if (!canAddFixedShelfToColumn(shelves, c)) return false
  }
  return true
}

export function canAddMoreFixedShelves(
  shelves: { columnIndex?: number | null }[],
  columnCount: number,
): boolean {
  const n = Math.max(1, columnCount)
  for (let c = 0; c < n; c++) {
    if (canAddFixedShelfToColumn(shelves, c)) return true
  }
  return false
}

export function partitionOriginCaption(spec: Pick<PartitionSpec, 'from' | 'fromPartition'>): string {
  if (typeof spec.fromPartition === 'number' && spec.fromPartition >= 0) {
    const dir = spec.from === 'left' ? 'надясно' : 'наляво'
    return `страница ${spec.fromPartition + 1} (${dir})`
  }
  return spec.from === 'left' ? 'лявата страница' : 'дясната страница'
}

/**
 * Convert a user offset into inner-left coordinates.
 * x = 0 is the inner face of the left side; x = innerW is the inner face of the right side.
 * Outer faces sit at −thickness (left) and innerW + thickness (right).
 * When `origin` is set, measure from that divider instead of the carcass.
 */
export function measurePartition(
  spec: PartitionSpec,
  innerW: number,
  thickness: number,
  origin?: { xLeft: number; xRight: number } | null,
): { startX: number; endX: number; xLeft: number; xRight: number; fromFace: SideFace; toFace: SideFace } {
  const T = thickness
  const faces = defaultPartitionFaces(spec.from)
  const fromFace = spec.fromFace ?? faces.fromFace
  const toFace = spec.toFace ?? faces.toFace
  let startX: number
  let endX: number
  if (origin) {
    startX = fromFace === 'left' ? origin.xLeft : origin.xRight
    endX = spec.from === 'left' ? startX + spec.offsetMm : startX - spec.offsetMm
  } else if (spec.from === 'left') {
    startX = fromFace === 'left' ? -T : 0
    endX = startX + spec.offsetMm
  } else {
    startX = fromFace === 'right' ? innerW + T : innerW
    endX = startX - spec.offsetMm
  }
  const xLeft = toFace === 'right' ? endX - T : endX
  return { startX, endX, xLeft, xRight: xLeft + T, fromFace, toFace }
}

export function partitionMeasureLabel(spec: PartitionSpec): string {
  const faces = defaultPartitionFaces(spec.from)
  const fromFace = spec.fromFace ?? faces.fromFace
  const toFace = spec.toFace ?? faces.toFace
  const fromPanel = partitionOriginCaption(spec)
  const fromWord = fromFace === 'left' ? 'лявата' : 'дясната'
  const toWord = toFace === 'left' ? 'лявата' : 'дясната'
  return `${spec.offsetMm} мм от ${fromWord} страна на ${fromPanel} до ${toWord} страна на разделителната страница`
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
  colIndex: number
  rowIndex: number
  isLeft: boolean
  isRight: boolean
  /** Clear width between the boards that bound this compartment. */
  innerW: number
  /** Inner-left → left of this opening. */
  x0: number
  /** Inner-left → right of this opening. */
  x1: number
  /**
   * Overlay front in inner-left coords.
   * Left column: outer left (−T) → right face of the divider to the right.
   * Right column: left face of the divider to the left → outer right (innerW + T).
   */
  frontX0: number
  frontX1: number
  frontWidth: number
}

export const ZONE_LABELS: Record<CabinetRowId, string> = {
  bottom: 'Долна част',
  middle: 'Средна част',
  top: 'Горна част',
}

export function columnLabel(index: number, count: number): string {
  if (count <= 1) return 'Шкаф'
  if (count === 2) return index === 0 ? 'Лява част' : 'Дясна част'
  if (count === 3) return (['Лява част', 'Средна част', 'Дясна част'] as const)[index] ?? `Част ${index + 1}`
  const four = ['Лява част', 'Средна лява', 'Средна дясна', 'Дясна част']
  return four[index] ?? `Част ${index + 1}`
}

export function compartmentId(
  colIndex: number,
  colCount: number,
  rowId: CabinetRowId,
  rowCount: number,
): CabinetZoneId {
  if (colCount <= 1) return rowCount <= 1 ? 'bottom' : rowId
  if (rowCount <= 1) return `c${colIndex}`
  return `c${colIndex}-${rowId}`
}

export function compartmentLabel(
  colIndex: number,
  colCount: number,
  rowId: CabinetRowId,
  rowCount: number,
): string {
  if (colCount <= 1) return rowCount <= 1 ? 'Шкаф' : ZONE_LABELS[rowId]
  if (rowCount <= 1) return columnLabel(colIndex, colCount)
  const col = columnLabel(colIndex, colCount).replace(/ част$/, '')
  return `${col} · ${ZONE_LABELS[rowId]}`
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
      columnIndex: parseColumnIndex(src.columnIndex),
    })
    if (out.length >= MAX_FIXED_SHELF_SPECS) break
  }
  return out
}

export function parsePartitions(raw: unknown): PartitionSpec[] {
  if (!Array.isArray(raw)) return []
  const out: PartitionSpec[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const src = item as Record<string, unknown>
    const from: PartitionFrom = src.from === 'right' ? 'right' : 'left'
    const n = typeof src.offsetMm === 'number' ? src.offsetMm : Number.parseInt(String(src.offsetMm ?? ''), 10)
    if (!Number.isFinite(n) || n <= 0) continue
    const faces = defaultPartitionFaces(from)
    out.push({
      from,
      offsetMm: Math.round(n),
      fromFace: parseSideFace(src.fromFace, faces.fromFace),
      toFace: parseSideFace(src.toFace, faces.toFace),
      fromPartition: parseFromPartition(src.fromPartition),
    })
    if (out.length >= MAX_PARTITIONS) break
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
  for (const [id, value] of Object.entries(src)) {
    if (value != null) out[id] = parseZoneFittings(value)
  }
  return out
}

export function defaultFixedOffsetMm(innerH: number, thickness: number, already: number): number {
  const gaps = already + 2
  const clear = innerH - (already + 1) * thickness
  const piece = Math.round(clear / gaps)
  return Math.max(MIN_ZONE_CLEAR_MM, piece)
}

function validateShelfGroup(group: ResolvedFixedShelf[], innerH: number): string | null {
  const sorted = [...group].sort((a, b) => a.yBottom - b.yBottom)
  for (const s of sorted) {
    if (s.yBottom < MIN_ZONE_CLEAR_MM) {
      return s.from === 'bottom'
        ? `Разстоянието отдолу трябва да е поне ${MIN_ZONE_CLEAR_MM} мм.`
        : 'Фиксираният рафт влиза в долната част.'
    }
    if (s.yTop > innerH - MIN_ZONE_CLEAR_MM) {
      return s.from === 'top'
        ? `Разстоянието отгоре трябва да е поне ${MIN_ZONE_CLEAR_MM} мм.`
        : 'Фиксираният рафт влиза в горната част.'
    }
  }
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].yBottom - sorted[i - 1].yTop
    if (gap < MIN_ZONE_CLEAR_MM) {
      return `Между фиксираните рафтове трябва да има поне ${MIN_ZONE_CLEAR_MM} мм.`
    }
  }
  if (sorted.length > MAX_FIXED_SHELVES) {
    return `До ${MAX_FIXED_SHELVES} фиксирани рафта в една част.`
  }
  return null
}

export function resolveFixedShelves(
  specs: FixedShelfSpec[],
  innerH: number,
  thickness: number,
  columnCount = 1,
): { shelves: ResolvedFixedShelf[]; error: string | null } {
  const T = thickness
  if (!(innerH > T + MIN_ZONE_CLEAR_MM * 2) || specs.length === 0) {
    return { shelves: [], error: specs.length === 0 ? null : 'Няма място за фиксиран рафт.' }
  }

  const cols = Math.max(1, columnCount)
  const resolved: ResolvedFixedShelf[] = specs.map((s) => {
    const m = measureFixedShelf(s, innerH, T)
    return {
      ...s,
      columnIndex: normalizeShelfColumnIndex(s.columnIndex, cols),
      fromFace: m.fromFace,
      toFace: m.toFace,
      yBottom: m.yBottom,
      yTop: m.yTop,
      startY: m.startY,
      endY: m.endY,
    }
  })

  for (let c = 0; c < cols; c++) {
    const error = validateShelfGroup(shelvesForColumn(resolved, c), innerH)
    if (error) return { shelves: [], error }
  }

  resolved.sort((a, b) => a.yBottom - b.yBottom || (a.columnIndex ?? -1) - (b.columnIndex ?? -1))
  return { shelves: resolved, error: null }
}

export function defaultPartitionOffsetMm(innerW: number, thickness: number, already: number): number {
  const gaps = already + 2
  const clear = innerW - (already + 1) * thickness
  const piece = Math.round(clear / gaps)
  return Math.max(MIN_ZONE_CLEAR_MM, piece)
}

export function resolvePartitions(
  specs: PartitionSpec[],
  innerW: number,
  thickness: number,
): { partitions: ResolvedPartition[]; error: string | null } {
  const T = thickness
  if (!(innerW > T + MIN_ZONE_CLEAR_MM * 2) || specs.length === 0) {
    return { partitions: [], error: specs.length === 0 ? null : 'Няма място за разделителна страница.' }
  }

  const pending = specs.map((s, specIndex) => ({ spec: s, specIndex }))
  const byIndex = new Map<number, ResolvedPartition>()
  let guard = 0
  while (byIndex.size < pending.length && guard < pending.length + 2) {
    guard += 1
    let progress = false
    for (const { spec, specIndex } of pending) {
      if (byIndex.has(specIndex)) continue
      const ref = spec.fromPartition
      if (typeof ref === 'number') {
        if (ref === specIndex) {
          return { partitions: [], error: 'Разделителна страница не може да се мери от себе си.' }
        }
        if (ref < 0 || ref >= specs.length) {
          return { partitions: [], error: `Няма страница ${ref + 1}, от която да се мери.` }
        }
        const origin = byIndex.get(ref)
        if (!origin) continue
        const m = measurePartition(spec, innerW, T, origin)
        byIndex.set(specIndex, {
          ...spec,
          specIndex,
          fromFace: m.fromFace,
          toFace: m.toFace,
          fromPartition: ref,
          xLeft: m.xLeft,
          xRight: m.xRight,
          startX: m.startX,
          endX: m.endX,
        })
        progress = true
        continue
      }
      const m = measurePartition(spec, innerW, T, null)
      byIndex.set(specIndex, {
        ...spec,
        specIndex,
        fromFace: m.fromFace,
        toFace: m.toFace,
        fromPartition: null,
        xLeft: m.xLeft,
        xRight: m.xRight,
        startX: m.startX,
        endX: m.endX,
      })
      progress = true
    }
    if (!progress) {
      return { partitions: [], error: 'Разделителните страници се мерят една от друга в кръг.' }
    }
  }

  const resolved = [...byIndex.values()].sort((a, b) => a.xLeft - b.xLeft)

  for (const s of resolved) {
    if (s.xLeft < MIN_ZONE_CLEAR_MM) {
      return {
        partitions: [],
        error:
          s.from === 'left' && s.fromPartition == null
            ? `Разстоянието отляво трябва да е поне ${MIN_ZONE_CLEAR_MM} мм.`
            : 'Разделителната страница влиза в лявата част.',
      }
    }
    if (s.xRight > innerW - MIN_ZONE_CLEAR_MM) {
      return {
        partitions: [],
        error:
          s.from === 'right' && s.fromPartition == null
            ? `Разстоянието отдясно трябва да е поне ${MIN_ZONE_CLEAR_MM} мм.`
            : 'Разделителната страница влиза в дясната част.',
      }
    }
  }

  for (let i = 1; i < resolved.length; i++) {
    const gap = resolved[i].xLeft - resolved[i - 1].xRight
    if (gap < MIN_ZONE_CLEAR_MM) {
      return { partitions: [], error: `Между разделителните страници трябва да има поне ${MIN_ZONE_CLEAR_MM} мм.` }
    }
  }

  return { partitions: resolved, error: null }
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
  const byCol = new Map<number, LaidOutZone[]>()
  for (const z of zones) {
    const c = z.colIndex ?? 0
    const arr = byCol.get(c) ?? []
    arr.push(z)
    byCol.set(c, arr)
  }
  for (const colZones of byCol.values()) {
    colZones.sort((a, b) => a.y0 - b.y0)
    for (let i = 0; i < colZones.length - 1; i++) {
      const lower = colZones[i]
      const upper = colZones[i + 1]
      if (!zoneHasOverlayFronts(lower) || !zoneHasOverlayFronts(upper)) continue
      upper.frontY0 = lower.frontY1
      upper.frontHeight = Math.max(0, upper.frontY1 - upper.frontY0)
    }
  }
}

export function joinAdjacentColumnFronts(zones: LaidOutZone[]): void {
  const byRow = new Map<number, LaidOutZone[]>()
  for (const z of zones) {
    const r = z.rowIndex ?? 0
    const arr = byRow.get(r) ?? []
    arr.push(z)
    byRow.set(r, arr)
  }
  for (const rowZones of byRow.values()) {
    rowZones.sort((a, b) => a.x0 - b.x0)
    for (let i = 0; i < rowZones.length - 1; i++) {
      const left = rowZones[i]
      const right = rowZones[i + 1]
      if (!zoneHasOverlayFronts(left) || !zoneHasOverlayFronts(right)) continue
      if (Math.abs(left.y0 - right.y0) > 0.5 || Math.abs(left.y1 - right.y1) > 0.5) continue
      right.frontX0 = left.frontX1
      right.frontWidth = Math.max(0, right.frontX1 - right.frontX0)
    }
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

/** Consecutive parts that both have fronts, bottom → top, within one column. */
export function consecutiveZoneFrontRuns(zones: LaidOutZone[]): LaidOutZone[][] {
  const byCol = new Map<number, LaidOutZone[]>()
  for (const z of zones) {
    const c = z.colIndex ?? 0
    const arr = byCol.get(c) ?? []
    arr.push(z)
    byCol.set(c, arr)
  }
  const runs: LaidOutZone[][] = []
  for (const colZones of byCol.values()) {
    colZones.sort((a, b) => a.y0 - b.y0)
    let current: LaidOutZone[] = []
    for (const z of colZones) {
      if (zoneHasOverlayFronts(z)) {
        current.push(z)
      } else if (current.length > 0) {
        runs.push(current)
        current = []
      }
    }
    if (current.length > 0) runs.push(current)
  }
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

/** Inner-left span of the overlay front for the whole carcass (doors overlay both sides). */
export function overlayFrontExtentX(
  innerW: number,
  thickness: number,
): { frontX0: number; frontX1: number; frontWidth: number } {
  const frontX0 = -thickness
  const frontX1 = innerW + thickness
  return { frontX0, frontX1, frontWidth: Math.max(0, frontX1 - frontX0) }
}

export interface ResolvedColumn {
  innerW: number
  x0: number
  x1: number
  isFirst: boolean
  isLast: boolean
  frontX0: number
  frontX1: number
  frontWidth: number
}

export function cabinetColumns(
  partitions: ResolvedPartition[],
  innerW: number,
  thickness: number,
): ResolvedColumn[] {
  const openings: { x0: number; x1: number }[] = []
  let cursor = 0
  for (const p of partitions) {
    openings.push({ x0: cursor, x1: p.xLeft })
    cursor = p.xRight
  }
  openings.push({ x0: cursor, x1: innerW })
  const extent = overlayFrontExtentX(innerW, thickness)

  return openings.map((o, i) => {
    const isFirst = i === 0
    const isLast = i === openings.length - 1
    const partLeft = i > 0 ? partitions[i - 1] : undefined
    const partRight = i < partitions.length ? partitions[i] : undefined
    const frontX0 = isFirst ? extent.frontX0 : (partLeft?.xLeft ?? o.x0)
    const frontX1 = isLast ? extent.frontX1 : (partRight?.xRight ?? o.x1)
    return {
      innerW: Math.max(0, o.x1 - o.x0),
      x0: o.x0,
      x1: o.x1,
      isFirst,
      isLast,
      frontX0,
      frontX1,
      frontWidth: Math.max(0, frontX1 - frontX0),
    }
  })
}

function composeCompartments(
  shelves: ResolvedFixedShelf[],
  cols: ResolvedColumn[],
  innerH: number,
  thickness: number,
  overlayCovers?: OverlayFrontCovers,
): ResolvedZone[] {
  const out: ResolvedZone[] = []
  for (let c = 0; c < cols.length; c++) {
    const colShelves = [...shelvesForColumn(shelves, c)].sort((a, b) => a.yBottom - b.yBottom)
    const rows = cabinetZones(colShelves, innerH, thickness, overlayCovers)
    const col = cols[c]
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      const rowId = (row.id === 'middle' || row.id === 'top' ? row.id : 'bottom') as CabinetRowId
      out.push({
        ...row,
        id: compartmentId(c, cols.length, rowId, rows.length),
        label: compartmentLabel(c, cols.length, rowId, rows.length),
        colIndex: c,
        rowIndex: r,
        isLeft: col.isFirst,
        isRight: col.isLast,
        innerW: col.innerW,
        x0: col.x0,
        x1: col.x1,
        frontX0: col.frontX0,
        frontX1: col.frontX1,
        frontWidth: col.frontWidth,
      })
    }
  }
  return out
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

  const ids: CabinetRowId[] =
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
      colIndex: 0,
      rowIndex: i,
      isLeft: true,
      isRight: true,
      innerW: 0,
      x0: 0,
      x1: 0,
      frontX0: 0,
      frontX1: 0,
      frontWidth: 0,
    }
  })
}

export interface LaidOutZone extends ResolvedZone, ZoneFittings {}

export interface InteriorLayout {
  shelves: ResolvedFixedShelf[]
  partitions: ResolvedPartition[]
  columns: ResolvedColumn[]
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
  innerW?: number
  thickness: number
  fixedShelves: FixedShelfSpec[]
  partitions?: PartitionSpec[]
  doorSpan: DoorSpan
  doorCount: DoorCount
  shelfCount: number
  drawerFrontHeights: number[]
  cutFromOneBoard: boolean
  hasClothesRail: boolean
  zones?: Partial<Record<CabinetZoneId, ZoneFittings>>
  overlayCovers?: OverlayFrontCovers
}): InteriorLayout {
  const innerW = Math.max(0, input.innerW ?? 0)
  const { partitions, error: partitionError } = resolvePartitions(input.partitions ?? [], innerW, input.thickness)
  const columns = cabinetColumns(partitions, innerW, input.thickness)
  const { shelves, error: shelfError } = resolveFixedShelves(
    input.fixedShelves,
    input.innerH,
    input.thickness,
    columns.length,
  )
  const rawZones = composeCompartments(shelves, columns, input.innerH, input.thickness, input.overlayCovers)
  const zoned = shelves.length > 0 || partitions.length > 0
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
  joinAdjacentColumnFronts(zones)

  return {
    shelves,
    partitions,
    columns,
    zones,
    doorSpan,
    fullDoorCount: zoned && doorSpan === 'full' ? input.doorCount : 0,
    fullDrawerFrontHeights: zoned ? input.drawerFrontHeights.filter((h) => h > 0) : [],
    error: shelfError ?? partitionError,
  }
}

export function layoutCounts(layout: InteriorLayout): {
  fixedShelves: number
  partitions: number
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
    partitions: layout.partitions.length,
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
  clearanceBottom?: number
}): StackedFront[] {
  const drawers = input.drawerFrontHeights.filter((h) => h > 0)
  const hasDoor = input.doorCount === 1 || input.doorCount === 2
  const bottom = input.clearanceBottom ?? 0
  const out: StackedFront[] = []
  let y = DOOR_CLEARANCE_TOP
  if (!hasDoor && drawers.length > 0) {
    const leftover = remainingFrontHeight(input.frontHeight, drawers, false, bottom)
    if (leftover > 0) y += leftover
  }
  drawers.forEach((h, i) => {
    out.push({ kind: 'drawer', yFromFrontTop: y, height: h, index: i })
    y += h + DRAWER_DOOR_GAP
  })
  if (hasDoor) {
    const leftover = remainingFrontHeight(input.frontHeight, drawers, true, bottom)
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

export function validateZoneFronts(
  layout: InteriorLayout,
  carcassFrontHeight: number,
  clearanceBottom = 0,
): string | null {
  if (layout.error) return layout.error
  for (const z of layout.zones) {
    const bottom = z.y0 <= 0.5 ? clearanceBottom : 0
    const leftover = remainingFrontHeight(z.frontHeight, z.drawerFrontHeights, z.doorCount > 0, bottom)
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
      clearanceBottom,
    )
    if (leftover < 0) return 'Челата на целия шкаф не събират във височината.'
    if (layout.fullDoorCount > 0 && leftover < 80) return 'Височината за вратите на целия шкаф е твърде малка.'
  }
  return null
}

export function fittingsCountsFromParams(p: {
  fixedShelves?: FixedShelfSpec[]
  partitions?: PartitionSpec[]
  doorSpan?: DoorSpan
  doorCount: DoorCount
  shelfCount: number
  drawerFrontHeights: number[]
  hasClothesRail?: boolean
  zones?: Partial<Record<CabinetZoneId, ZoneFittings>>
}): {
  fixedShelves: number
  partitions: number
  shelfCount: number
  doorCount: number
  drawerCount: number
  clothesRailCount: number
} {
  const fixed = p.fixedShelves?.length ?? 0
  const parts = p.partitions?.length ?? 0
  if (fixed === 0 && parts === 0) {
    return {
      fixedShelves: 0,
      partitions: 0,
      shelfCount: p.shelfCount,
      doorCount: p.doorCount,
      drawerCount: p.drawerFrontHeights.length,
      clothesRailCount: p.hasClothesRail ? 1 : 0,
    }
  }
  let shelfCount = 0
  let doorCount = p.doorSpan === 'full' ? p.doorCount : 0
  let drawerCount = p.drawerFrontHeights.length
  let clothesRailCount = 0
  for (const z of Object.values(p.zones ?? {})) {
    if (!z) continue
    shelfCount += z.shelfCount
    if (p.doorSpan !== 'full') doorCount += z.doorCount
    drawerCount += z.drawerFrontHeights.length
    if (z.hasClothesRail) clothesRailCount += 1
  }
  return { fixedShelves: fixed, partitions: parts, shelfCount, doorCount, drawerCount, clothesRailCount }
}
