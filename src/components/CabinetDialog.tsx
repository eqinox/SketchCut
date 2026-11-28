import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AssemblyFilmContext } from '@/lib/assembly-context'
import { PULL_CHOICES, parsePullSku, pullName, taraPull, type PullSku } from '@/lib/cabinets/pulls'
import { Box, Check, ChevronDown, ChevronRight, ClipboardCopy, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CabinetPreview } from '@/components/CabinetPreview'
import { BoardPickContext } from '@/lib/cabinets/draw-3d'
import { ProjectRoomContext, type ProjectRoom } from '@/lib/project-room'
import { PieceColorChoiceContext, type PieceColorChoice } from '@/lib/piece-color-choice'
import type { RoomPlan } from '@/lib/room'
import { CabinetGroupView } from '@/components/CabinetGroupView'
import {
  attachmentTouchesHost,
  cabinetOuterSize,
  isCombinationType,
  parseCombination,
  spanDoorCountOf,
  withAttachments,
  type AttachedCabinet,
} from '@/lib/cabinets/compose'
import type { SavedCabinetGroup } from '@/lib/cabinets/apply'
import { PriceBreakdownView } from '@/components/PriceBreakdown'
import {
  CABINET_TYPES,
  DEFAULT_KITCHEN_BASE_PARAMS,
  DEFAULT_KITCHEN_WALL_PARAMS,
  DEFAULT_HOOD_DIAMETER_MM,
  DEFAULT_HOOD_RECT_W_MM,
  DEFAULT_HOOD_RECT_D_MM,
  DEFAULT_NIGHTSTAND_PARAMS,
  DEFAULT_PART_COLORS,
  DEFAULT_SECTION_PARAMS,
  DEFAULT_WARDROBE_PARAMS,
  DEFAULT_RAIL_WIDTH,
  FASCIA_SETBACK_MM,
  kitchenClearInnerH,
  parseBoxTopStyle,
  parseKitchenTopStyle,
  PART_COLOR_FIELDS,
  SHELF_PINS_PER_SHELF,
  SLIDE_KIND_LABEL,
  SLIDES_PER_DRAWER,
  eligibleSlideLengths,
  frontDoorOverhang,
  SLIDE_REAR_CLEARANCE_MM,
  slideRunnerDepth,
  estimateFromPanels,
  explainCabinetPrice,
  formatArea,
  formatEur,
  generateCabinet,
  isSoftCloseSlide,
  measureNightstand,
  parseKitchenBaseParams,
  parseKitchenWallParams,
  parseNightstandParams,
  parseSectionParams,
  parseWardrobeParams,
  parseSlideKind,
  scaleCabinetResult,
  repriceShelfPins,
  walkShelfPinSpots,
  slideUnitPriceEur,
  remainingFrontHeight,
  equalDrawerFrontHeights,
  drawerFrontsAreEven,
  canCombineFronts,
  canCombineAdjacentZoneFronts,
  doorCutSize,
  doorLeafCount,
  doorCutRuleNote,
  drawerFrontCutSize,
  DOOR_CLEARANCE_TOP,
  DOOR_EDGE_BOTH,
  DRAWER_DOOR_GAP,
  DEFAULT_DRAWER_FRONT_HEIGHT,
  DRAWER_RAIL_BELOW_FRONT,
  MAX_DRAWERS,
  MAX_SHELVES,
  MAX_CLOTHES_RAILS,
  DEFAULT_CLOTHES_RAIL_FROM_TOP_MM,
  CLOTHES_RAIL_SECTION_MM,
  evenLowerRailY,
  evenShelfGap,
  clothesRailLengthMm,
  hardboardCutSize,
  planHardboardBack,
  backNailGeometry,
  parseDoorStyle,
  parseSlidingEdges,
  parseDimFontScale,
  flushCarcassDepth,
  shelfFrontInsetMm,
  DIM_FONT_SCALE_MIN,
  DIM_FONT_SCALE_MAX,
  defaultSlidingEdges,
  bothSideSlidingEdges,
  oneSideSlidingEdges,
  slidingHandlesOnBothSides,
  centerSlidingPartition,
  layoutSlidingDoors,
  assessThreeSlidingDoors,
  threeDoorPartitionOffsets,
  threeDoorSlidingEdges,
  slidingEdgeLabel,
  slidingProfileMm,
  SLIDING_DRAWER_FROM_BOTTOM_MM,
  SLIDING_HANDLE_PROFILE_MM,
  SLIDING_THREE_DOOR_OVERLAP_MM,
  SLIDING_DOOR_BOTTOM_CLEAR_MM,
  SLIDING_DOOR_TOP_CLEAR_MM,
  SLIDING_PARTITION_SETBACK_MM,
  isBuyoutDoorPanel,
  type CabinetInstance,
  type CabinetPartColors,
  type SlideKind,
  type CabinetZoneId,
  type DoorSpan,
  type ZoneFittings,
  type SideFace,
  type DoorCount,
  type DoorStyle,
  type SlidingDoorEdges,
  type SlidingEdgeKind,
  MAX_PARTITIONS,
  MIN_CLOTHES_RAIL_TO_SHELF_MM,
  MIN_ZONE_CLEAR_MM,
  defaultFixedOffsetMm,
  defaultPartitionOffsetMm,
  evenBayDividerSpecs,
  partitionGapOpenings,
  defaultShelfFaces,
  defaultPartitionFaces,
  evenShelfPlacements,
  middleShelfClearances,
  remainingShelfOpenings,
  placeableHeightOpenings,
  zoneHeightOpenings,
  zoneHeightSplitKind,
  clothesRailShelfKeepout,
  fixedShelfMeasureLabel,
  movableShelfMeasureLabel,
  clothesRailMeasureLabel,
  partitionMeasureLabel,
  partitionOriginCaption,
  layoutInterior,
  fittingsCountsFromParams,
  allDrawerFrontHeights,
  uniqueDrawerBoxes,
  validateZoneFronts,
  zoneStackOpeningHeight,
  frontStackOpeningHeight,
  columnLabel,
  shelvesForColumn,
  shelvesCoveringColumn,
  canAddFixedShelfToColumn,
  canAddFixedShelfFull,
  canAddMoreFixedShelves,
  MAX_FIXED_SHELVES,
  type InteriorLayout,
  type PanelFace,
  type CabinetTopStyle,
  type HoodShape,
} from '@/lib/cabinets'
import { parsePieceFinishes } from '@/lib/board-finishes'
import { KronospanColorGrid, KronospanCombinationRow, KronospanFinishOptions } from '@/components/KronospanColors'
import {
  kronospanBoardByFinishId,
  kronospanBoardId,
  kronospanCodeFromFinish,
  kronospanFinishId,
  resolveBoardFinish,
  withKronospanBoard,
  withKronospanFinish,
  type KronospanBoard,
  type KronospanSwatch,
} from '@/lib/kronospan-color'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import type { AssemblyTimeSettings } from '@/lib/assembly-time'
import {
  DEFAULT_ASSEMBLY_TIME_SETTINGS,
  DRAWER_MEASURE_LABELS,
  DRAWER_MEASURE_SECONDS,
  parseDrawerMeasureLevel,
  type DrawerMeasureLevel,
} from '@/lib/assembly-time'
import {
  SLIDING_TRACK_COLOR_IDS,
  SLIDING_TRACK_COLOR_LABELS,
  pickSlidingSku,
  slidingSkuLabel,
  type SlidingTrackColor,
} from '@/lib/sliding-hardware'
import { CabinetSizeBadge } from '@/components/CabinetSizeBadge'
import { DraftNumber } from '@/components/DraftNumber'
import type { Sheet } from '@/types'
import { cn, exactMm, formatMeters, formatMm, parseMm } from '@/lib/utils'
import {
  DEFAULT_VANITY_PARAMS,
  mergeKneePartitions,
  parseVanityParams,
  VANITY_BACK_RAIL_MM,
  VANITY_MIRROR_GAPS,
  vanityKneeError,
  vanityMirrorArea,
  vanityOpening,
  zoneInVanityKnee,
  type VanityKnee,
  type VanityLegSide,
  type VanityParams,
} from '@/lib/cabinets/vanity'
import {
  isMirrorBoard,
  MIRROR_HALO_LABEL,
  mirrorDoorTargets,
  mirrorGlass,
  mirrorQuote,
  parseMirrorSpec,
  type MirrorHalo,
  type MirrorMode,
  type MirrorSpec,
} from '@/lib/cabinets/mirror'
import {
  BED_INNER_DROP_MM,
  DEFAULT_BED_PARAMS,
  bedError,
  measureBed,
  parseBedParams,
} from '@/lib/cabinets/bed'
import type { PartitionSpec } from '@/lib/cabinets/zones'

type MovableShelfUi = {
  from: 'bottom' | 'top' | 'middle'
  fromFace: PanelFace
  toFace: PanelFace
  offsetMm: string
  /** 0-based index of the shelf this one is measured from. Null = carcass. */
  fromShelf: number | null
  /** Remaining opening around exact-distance shelves and clothes rails (0 = lowest). */
  gapIndex?: number
}

type ClothesRailUi = {
  from: 'top' | 'bottom' | 'middle'
  offsetMm: string
  /** Remaining opening around pin shelves (0 = lowest). */
  gapIndex?: number
}

type ZoneUi = {
  shelfCount: number
  movableShelves: MovableShelfUi[]
  doorCount: DoorCount
  drawerFrontHeights: string[]
  cutFromOneBoard: boolean
  hasClothesRail: boolean
  clothesRails: ClothesRailUi[]
}

function movableToUi(s: {
  from: 'bottom' | 'top' | 'middle'
  fromFace?: PanelFace
  toFace?: PanelFace
  offsetMm: number
  fromShelf?: number | null
  gapIndex?: number
}): MovableShelfUi {
  if (s.from === 'middle') {
    return {
      from: 'middle',
      fromFace: 'top',
      toFace: 'bottom',
      offsetMm: String(s.offsetMm || 0),
      fromShelf: null,
      gapIndex: s.gapIndex,
    }
  }
  const faces = defaultShelfFaces(s.from)
  return {
    from: s.from,
    fromFace: s.fromFace ?? faces.fromFace,
    toFace: s.toFace ?? faces.toFace,
    offsetMm: String(s.offsetMm),
    fromShelf: typeof s.fromShelf === 'number' ? s.fromShelf : null,
    ...(s.gapIndex != null && s.fromShelf == null ? { gapIndex: s.gapIndex } : {}),
  }
}

function displayedMovable(rows: MovableShelfUi[], count: number, innerH: number, thickness: number): MovableShelfUi[] {
  if (rows.length > 0) return rows
  return evenShelfPlacements(innerH, count, thickness).map(movableToUi)
}

function newMovableShelf(innerH: number, thickness: number, already: number, gapIndex?: number): MovableShelfUi {
  const from = already === 0 ? ('bottom' as const) : ('top' as const)
  return {
    from,
    ...defaultShelfFaces(from),
    offsetMm: String(defaultFixedOffsetMm(innerH, thickness, already)),
    fromShelf: null,
    ...(gapIndex != null ? { gapIndex } : {}),
  }
}

function newMiddlePinShelf(gapIndex?: number): MovableShelfUi {
  return { from: 'middle', fromFace: 'top', toFace: 'bottom', offsetMm: '0', fromShelf: null, gapIndex }
}

function shiftShelfRef<T extends { fromShelf: number | null; from: 'bottom' | 'top' | 'middle'; fromFace: PanelFace; toFace: PanelFace }>(
  row: T,
  removed: number,
): T {
  if (row.fromShelf == null) return row
  if (row.fromShelf === removed) {
    return { ...row, fromShelf: null, from: 'bottom', ...defaultShelfFaces('bottom') }
  }
  if (row.fromShelf > removed) return { ...row, fromShelf: row.fromShelf - 1 }
  return row
}

function dropMovableShelf(rows: MovableShelfUi[], index: number): MovableShelfUi[] {
  return rows.filter((_, j) => j !== index).map((row) => shiftShelfRef(row, index))
}

function dropFixedShelf(rows: FixedShelfUi[], index: number): FixedShelfUi[] {
  return rows.filter((_, j) => j !== index).map((row) => {
    if (row.fromShelf == null) return row
    if (row.fromShelf === index) {
      return { ...row, fromShelf: null, from: 'bottom', ...defaultShelfFaces('bottom') }
    }
    if (row.fromShelf > index) return { ...row, fromShelf: row.fromShelf - 1 }
    return row
  })
}

function shelfFromHint(
  spec: { from: 'bottom' | 'top' | 'middle'; fromShelf: number | null },
  topName: string,
  bottomName: string,
): string {
  if (spec.fromShelf != null && spec.from !== 'middle') {
    return spec.from === 'bottom'
      ? `От рафт ${spec.fromShelf + 1}, нагоре`
      : `От рафт ${spec.fromShelf + 1}, надолу`
  }
  if (spec.from === 'middle') return 'По средата на отвора'
  return `От ${spec.from === 'bottom' ? bottomName : topName}`
}

function concatMovable(groups: MovableShelfUi[][]): MovableShelfUi[] {
  const out: MovableShelfUi[] = []
  for (const group of groups) {
    const base = out.length
    for (const row of group) {
      out.push(row.fromShelf == null ? row : { ...row, fromShelf: row.fromShelf + base })
    }
  }
  return out
}

function shelfFromExisting(
  count: number,
  resolved: { from: string; yBottom: number; yTop: number }[],
  opening: { start: number; end: number } | undefined,
  innerH: number,
  thickness: number,
): MovableShelfUi {
  if (opening) {
    let below = -1
    let above = -1
    resolved.forEach((s, i) => {
      if (s.from === 'middle' || i >= count) return
      if (Math.abs(s.yTop - opening.start) < 1.5) below = i
      if (Math.abs(s.yBottom - opening.end) < 1.5) above = i
    })
    const offset = String(
      Math.max(MIN_ZONE_CLEAR_MM, exactMm(Math.max(0, (opening.end - opening.start - thickness) / 2))),
    )
    if (below >= 0) {
      return { from: 'bottom', fromShelf: below, ...defaultShelfFaces('bottom'), offsetMm: offset }
    }
    if (above >= 0) {
      return { from: 'top', fromShelf: above, ...defaultShelfFaces('top'), offsetMm: offset }
    }
  }
  const lastIdx = count - 1
  const last = resolved[lastIdx]
  const room = last ? Math.max(0, innerH - last.yTop) : innerH
  const offset = Math.max(MIN_ZONE_CLEAR_MM, exactMm(Math.max(0, (room - thickness) / 2)))
  return {
    from: 'bottom',
    fromShelf: lastIdx,
    ...defaultShelfFaces('bottom'),
    offsetMm: String(offset),
  }
}

function shelfFromChosenOrigin(origin: 'bottom' | 'top' | number): MovableShelfUi {
  if (typeof origin === 'number') {
    return {
      from: 'bottom',
      fromShelf: origin,
      ...defaultShelfFaces('bottom'),
      offsetMm: '',
    }
  }
  return {
    from: origin,
    fromShelf: null,
    ...defaultShelfFaces(origin),
    offsetMm: '',
  }
}

function parseShelfOriginTarget(
  target: string,
): { zoneId: string; origin: 'bottom' | 'top' | number } | null {
  const match = /^shelf-from::(.+)::(bottom|top|shelf:(\d+))$/.exec(target)
  if (!match) return null
  if (match[2] === 'bottom') return { zoneId: match[1]!, origin: 'bottom' }
  if (match[2] === 'top') return { zoneId: match[1]!, origin: 'top' }
  return { zoneId: match[1]!, origin: Number(match[3]) }
}

function parseFixedOriginTarget(
  target: string,
): { columnIndex: number | null; origin: 'bottom' | 'top' | number } | null {
  const match = /^fixed-from::(full|\d+)::(bottom|top|shelf:(\d+))$/.exec(target)
  if (!match) return null
  const columnIndex = match[1] === 'full' ? null : Number(match[1])
  if (match[2] === 'bottom') return { columnIndex, origin: 'bottom' }
  if (match[2] === 'top') return { columnIndex, origin: 'top' }
  return { columnIndex, origin: Number(match[3]) }
}

function fixedShelvesInPart(rows: FixedShelfUi[], columnIndex: number | null): number[] {
  return rows.flatMap((row, index) => {
    if (columnIndex == null || row.columnIndex == null || row.columnIndex === columnIndex) return [index]
    return []
  })
}

function fixedShelfBayCount(rows: { bayPath?: string; spanPaths?: string[] }[], path: string): number {
  return rows.filter((row) => row.bayPath === path || row.spanPaths?.includes(path)).length
}

/** Sides the shelf already covers. One column is a single path until the user continues it. */
function shelfSidePaths(
  shelf: { spanPaths?: string[]; columnIndex?: number | null },
  columns: { path: string }[],
): string[] {
  if (shelf.spanPaths && shelf.spanPaths.length >= 2) {
    return shelf.spanPaths.filter((path) => columns.some((column) => column.path === path))
  }
  if (shelf.columnIndex != null && columns[shelf.columnIndex]?.path) return [columns[shelf.columnIndex]!.path]
  return []
}

type ShelfSideZone = {
  path: string
  label: string
  x0: number
  x1: number
  y0: number
  y1: number
  id: string
  colIndex: number
}

/** One button per named side. Страна 1 горе and Страна 1 долу stay separate. */
function shelfTargetZones<T extends ShelfSideZone>(zones: T[]): T[] {
  const sorted = [...zones].sort((a, b) => a.x0 - b.x0 || b.y0 - a.y0)
  const seen = new Set<string>()
  const out: T[] = []
  for (const zone of sorted) {
    if (!zone.path || zone.path.includes('–')) continue
    const key = zone.label || zone.path
    if (seen.has(key)) continue
    seen.add(key)
    out.push(zone)
  }
  return out
}

function shelfBand(label: string): 'top' | 'bottom' | undefined {
  if (label.endsWith(' горе') || label.endsWith('Горна част')) return 'top'
  if (label.endsWith(' долу') || label.endsWith('Долна част')) return 'bottom'
  return undefined
}

function zonesTouch(a: { x0: number; x1: number; y0: number; y1: number }, b: { x0: number; x1: number; y0: number; y1: number }): boolean {
  const beside = Math.abs(b.x0 - a.x1) <= 24 || Math.abs(b.x1 - a.x0) <= 24
  const overlap = b.y0 < a.y1 - 0.5 && b.y1 > a.y0 + 0.5
  return beside && overlap
}

/** Mark a neighboring side as well. A side that is not beside the current ones replaces them. */
function markShelfSides(current: string[], clicked: string, zones: ShelfSideZone[]): string[] {
  const targets = shelfTargetZones(zones)
  const byPath = new Map(targets.map((zone) => [zone.path, zone]))
  const hit = byPath.get(clicked)
  if (!hit) return [clicked]
  const owned = current.map((path) => byPath.get(path)).filter((zone): zone is ShelfSideZone => !!zone)
  if (owned.length === 0 || !owned.some((zone) => zonesTouch(zone, hit))) {
    if (owned.some((zone) => zone.path === clicked)) return current
    return [clicked]
  }
  if (owned.some((zone) => zone.path === clicked)) {
    if (owned.length === 1) return current
    const sorted = [...owned].sort((a, b) => a.x0 - b.x0)
    if (clicked === sorted[0]?.path) return sorted.slice(1).map((zone) => zone.path)
    if (clicked === sorted[sorted.length - 1]?.path) return sorted.slice(0, -1).map((zone) => zone.path)
    return sorted.map((zone) => zone.path)
  }
  return [...owned, hit].sort((a, b) => a.x0 - b.x0).map((zone) => zone.path)
}

/** The next side to the left and to the right. The shelf grows only when that button is pressed. */
function continueSidePaths(current: string[], ordered: string[]): string[] {
  const indexes = current
    .map((path) => ordered.indexOf(path))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)
  if (indexes.length === 0) return []
  const lo = indexes[0]!
  const hi = indexes[indexes.length - 1]!
  const out: string[] = []
  if (lo > 0) out.push(ordered[lo - 1]!)
  if (hi < ordered.length - 1) out.push(ordered[hi + 1]!)
  return out
}

function zoneIsShelfFragment(
  zone: { innerW: number; colIndex: number },
  columns: { innerW: number }[],
): boolean {
  const column = columns[zone.colIndex]
  return !!column && zone.innerW < column.innerW - 0.5
}

function partialOpening(
  opening: { start: number; end: number } | undefined,
  innerH: number,
): { start: number; end: number } | undefined {
  if (!opening) return undefined
  if (opening.start <= 0.5 && opening.end >= innerH - 0.5) return undefined
  return opening
}

function shelfOriginChoice(
  row: MovableShelfUi,
  next: { from: 'bottom' | 'top' | 'middle'; fromShelf: number | null },
): MovableShelfUi {
  if (next.from === 'middle') return newMiddlePinShelf(row.gapIndex)
  return {
    ...row,
    from: next.from,
    fromShelf: next.fromShelf,
    ...defaultShelfFaces(next.from),
    ...(next.fromShelf != null ? { gapIndex: undefined } : {}),
  }
}

function fittingsFromMovable(
  rows: MovableShelfUi[],
  evenCount: number,
): { shelfCount: number; movableShelves: ReturnType<typeof rowsToSpecs> } {
  if (rows.length === 0) return { shelfCount: evenCount, movableShelves: [] }
  const movableShelves = rowsToSpecs(rows)
  return { shelfCount: movableShelves.length, movableShelves }
}

function mmNum(raw: string): number {
  const n = parseMm(raw)
  return n != null && n > 0 ? n : 0
}

/** Enough decimals that equal openings stay equal, without a long binary tail. */
function evenOffsetField(n: number): string {
  const micro = Math.round(n * 1e6) / 1e6
  return String(micro)
}

function rowsToSpecs(rows: MovableShelfUi[]) {
  return rows
    .map((s) => ({
      from: s.from,
      fromFace: s.fromFace,
      toFace: s.toFace,
      offsetMm: mmNum(s.offsetMm),
      ...(s.from !== 'middle' && s.fromShelf != null ? { fromShelf: s.fromShelf } : {}),
      ...(s.from !== 'middle' && s.fromShelf == null && s.gapIndex != null ? { gapIndex: s.gapIndex } : {}),
    }))
    .filter((s) => s.from === 'middle' || s.offsetMm > 0)
}

function railToUi(s: { from: 'top' | 'bottom' | 'middle'; offsetMm: number; gapIndex?: number }): ClothesRailUi {
  return {
    from: s.from,
    offsetMm: String(s.from === 'middle' ? 0 : s.offsetMm),
    ...(s.gapIndex != null ? { gapIndex: s.gapIndex } : {}),
  }
}

function railsToSpecs(rows: ClothesRailUi[]) {
  return rows
    .map((s) => ({
      from: s.from,
      offsetMm: s.from === 'middle' ? 0 : mmNum(s.offsetMm),
      ...(s.gapIndex != null ? { gapIndex: s.gapIndex } : {}),
    }))
    .filter((s) => s.from === 'middle' || s.offsetMm > 0)
}

function newClothesRail(innerH: number, already: number, gapIndex?: number): ClothesRailUi {
  if (already === 0) {
    return { from: 'top', offsetMm: String(DEFAULT_CLOTHES_RAIL_FROM_TOP_MM), ...(gapIndex != null ? { gapIndex } : {}) }
  }
  return {
    from: 'bottom',
    offsetMm: String(Math.max(MIN_ZONE_CLEAR_MM, exactMm(innerH / (already + 1)))),
    ...(gapIndex != null ? { gapIndex } : {}),
  }
}

function newMiddleRail(gapIndex?: number): ClothesRailUi {
  return { from: 'middle', offsetMm: '0', ...(gapIndex != null ? { gapIndex } : {}) }
}

/** Second rod: gap between the rods equals the gap from the lower rod to the floor. */
function placeEvenLowerRails(
  rows: ClothesRailUi[],
  openings: { index: number; start: number; end: number }[],
  openingH: number,
  floorDrop: number,
): ClothesRailUi[] {
  const gaps = openings.length > 0 ? openings : [{ index: 0, start: 0, end: openingH }]
  const largest = gaps.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a))
  const gapOf = (r: ClothesRailUi) =>
    r.gapIndex != null ? (gaps.find((g) => g.index === r.gapIndex) ?? largest) : largest
  const yOf = (r: ClothesRailUi) => {
    const gap = gapOf(r)
    if (r.from === 'middle') return gap.start + (gap.end - gap.start - CLOTHES_RAIL_SECTION_MM) / 2
    if (r.from === 'bottom') return gap.start + mmNum(r.offsetMm)
    return gap.end - mmNum(r.offsetMm)
  }
  const top = rows
    .filter((r) => r.from === 'top')
    .reduce<ClothesRailUi | null>((best, r) => (!best || yOf(r) > yOf(best) ? r : best), null)
  const yUpper = top ? yOf(top) : openingH - DEFAULT_CLOTHES_RAIL_FROM_TOP_MM
  const yLower = evenLowerRailY(yUpper, floorDrop)
  if (yLower == null) return rows
  const needsTop = !top
  const hasBottom = rows.some((r) => r.from === 'bottom')
  const free = MAX_CLOTHES_RAILS - rows.length
  if ((needsTop ? 1 : 0) + (hasBottom ? 0 : 1) > free) return rows

  const host =
    gaps.find((g) => yLower >= g.start && yLower <= g.end - CLOTHES_RAIL_SECTION_MM) ??
    gaps.reduce((a, b) => (Math.abs(a.start - yLower) <= Math.abs(b.start - yLower) ? a : b))
  const offset = exactMm(
    Math.max(0, Math.min(host.end - host.start - CLOTHES_RAIL_SECTION_MM, yLower - host.start)),
  )
  const withGap = gaps.length > 1
  const next = rows.map((r) => ({ ...r }))
  if (!top) {
    if (next.length >= MAX_CLOTHES_RAILS) return rows
    const topGap = gaps.reduce((a, b) => (b.end > a.end ? b : a))
    next.unshift({
      from: 'top',
      offsetMm: String(DEFAULT_CLOTHES_RAIL_FROM_TOP_MM),
      ...(withGap ? { gapIndex: topGap.index } : {}),
    })
  }
  const lower: ClothesRailUi = {
    from: 'bottom',
    offsetMm: String(offset),
    ...(withGap ? { gapIndex: host.index } : { gapIndex: undefined }),
  }
  const bottomIdx = next.reduce(
    (found, r, i) =>
      r.from === 'bottom' && (found < 0 || yOf(r) < yOf(next[found]!)) ? i : found,
    -1,
  )
  if (bottomIdx >= 0) next[bottomIdx] = { ...next[bottomIdx], ...lower }
  else if (next.length < MAX_CLOTHES_RAILS) next.push(lower)
  return next
}

function railToGroundNote(yLower: number, otherTops: number[], floorDrop: number): string {
  if (!(floorDrop > 0)) return ''
  const toGround = yLower + floorDrop
  const above = otherTops.filter((y) => y > yLower + 1)
  const yUpper = above.length > 0 ? Math.min(...above) : null
  if (yUpper == null) return ` До земята ${formatMm(toGround)} мм.`
  const between = yUpper - yLower
  if (Math.abs(between - toGround) < 0.6) {
    return ` Между лостовете и до земята: ${formatMm(between)} мм.`
  }
  return ` До земята ${formatMm(toGround)} мм.`
}

function railOriginCaptions(
  zone: { y0: number; y1: number; rails: { openingY0: number; openingY1: number }[] } | undefined,
  railIndex: number,
  topBoardCaption: string,
): { top: string; bottom: string } {
  const r = zone?.rails[railIndex]
  return {
    top: r && zone && r.openingY1 < zone.y1 - 0.5 ? 'долната страна на рафта' : topBoardCaption,
    bottom: r && zone && r.openingY0 > zone.y0 + 0.5 ? 'горната страна на рафта' : 'долната плоскост',
  }
}

function emptyZoneUi(): ZoneUi {
  return {
    shelfCount: 0,
    movableShelves: [],
    doorCount: 0,
    drawerFrontHeights: [],
    cutFromOneBoard: false,
    hasClothesRail: false,
    clothesRails: [],
  }
}

function parseZoneUi(raw: ZoneFittings | undefined): ZoneUi {
  if (!raw) return emptyZoneUi()
  const clothesRails = (raw.clothesRails ?? []).map(railToUi)
  const hasRail = clothesRails.length > 0 || raw.hasClothesRail
  return {
    shelfCount: raw.shelfCount,
    movableShelves: (raw.movableShelves ?? []).map(movableToUi),
    doorCount: raw.doorCount,
    drawerFrontHeights: raw.drawerFrontHeights.map(String),
    cutFromOneBoard: raw.cutFromOneBoard,
    clothesRails: hasRail && clothesRails.length === 0 ? [newClothesRail(0, 0)] : clothesRails,
    hasClothesRail: hasRail,
  }
}

function zoneUiToParams(z: ZoneUi): ZoneFittings {
  const { shelfCount, movableShelves } = fittingsFromMovable(z.movableShelves, z.shelfCount)
  const clothesRails = railsToSpecs(z.clothesRails)
  return {
    shelfCount,
    movableShelves,
    doorCount: z.doorCount,
    drawerFrontHeights: z.drawerFrontHeights.map((s) => parseInt(s, 10) || 0).filter((n) => n > 0),
    cutFromOneBoard: z.cutFromOneBoard,
    clothesRails,
    hasClothesRail: clothesRails.length > 0,
  }
}

function zoneOf(ui: Record<string, ZoneUi>, id: string): ZoneUi {
  return ui[id] ?? emptyZoneUi()
}

function zoneUiFromFittings(zones: Partial<Record<string, ZoneFittings>> | undefined): Record<string, ZoneUi> {
  const out: Record<string, ZoneUi> = {
    bottom: emptyZoneUi(),
    middle: emptyZoneUi(),
    top: emptyZoneUi(),
  }
  if (!zones) return out
  for (const [k, v] of Object.entries(zones)) {
    out[k] = parseZoneUi(v)
  }
  return out
}

function serializeZoneUi(ui: Record<string, ZoneUi>, cutFromOneBoard: boolean): Record<string, ZoneFittings> {
  const out: Record<string, ZoneFittings> = {}
  for (const [k, v] of Object.entries(ui)) {
    out[k] = { ...zoneUiToParams(v), cutFromOneBoard }
  }
  return out
}

function splitColumnZones(z: Record<string, ZoneUi>, colIndex: number): Record<string, ZoneUi> {
  const bottomId = `c${colIndex}-bottom`
  if (z[bottomId]) return z
  return {
    ...z,
    [bottomId]: { ...zoneOf(z, `c${colIndex}`) },
    [`c${colIndex}-middle`]: emptyZoneUi(),
    [`c${colIndex}-top`]: emptyZoneUi(),
  }
}

function mergeColumnZones(z: Record<string, ZoneUi>, colIndex: number): Record<string, ZoneUi> {
  const bottom = zoneOf(z, `c${colIndex}-bottom`)
  const middle = zoneOf(z, `c${colIndex}-middle`)
  const top = zoneOf(z, `c${colIndex}-top`)
  const withDoor = [top, middle, bottom].find((p) => p.doorCount > 0)
  const next = { ...z }
  delete next[`c${colIndex}-bottom`]
  delete next[`c${colIndex}-middle`]
  delete next[`c${colIndex}-top`]
  next[`c${colIndex}`] = {
    shelfCount: bottom.shelfCount + middle.shelfCount + top.shelfCount,
    movableShelves: concatMovable([bottom.movableShelves, middle.movableShelves, top.movableShelves]),
    doorCount: withDoor?.doorCount ?? 0,
    drawerFrontHeights: [
      ...top.drawerFrontHeights,
      ...middle.drawerFrontHeights,
      ...bottom.drawerFrontHeights,
    ],
    cutFromOneBoard: bottom.cutFromOneBoard || middle.cutFromOneBoard || top.cutFromOneBoard,
    clothesRails: [...bottom.clothesRails, ...middle.clothesRails, ...top.clothesRails].slice(
      0,
      MAX_CLOTHES_RAILS,
    ),
    hasClothesRail:
      bottom.clothesRails.length + middle.clothesRails.length + top.clothesRails.length > 0 ||
      bottom.hasClothesRail ||
      middle.hasClothesRail ||
      top.hasClothesRail,
  }
  return next
}

function remapZonesAfterFixedChange(
  z: Record<string, ZoneUi>,
  prev: { columnIndex: number | null }[],
  next: { columnIndex: number | null }[],
  colCount: number,
): Record<string, ZoneUi> {
  if (colCount <= 1) return z
  let out = z
  for (let c = 0; c < colCount; c++) {
    const had = shelvesForColumn(prev, c).length > 0
    const has = shelvesForColumn(next, c).length > 0
    if (!had && has) out = splitColumnZones(out, c)
    else if (had && !has) out = mergeColumnZones(out, c)
  }
  return out
}

function filledDrawerRows(frontHeight: number, count: number, hasDoor: boolean, clearanceBottom = 0): string[] {
  if (count < 1) return []
  if (hasDoor) return Array.from({ length: count }, () => String(DEFAULT_DRAWER_FRONT_HEIGHT))
  return equalDrawerFrontHeights(frontHeight, count, clearanceBottom).map(String)
}

type FrontTarget = CabinetZoneId | 'full'
type PendingAdd =
  | { kind: 'shelf'; middle?: boolean }
  | { kind: 'drawer' }
  | { kind: 'door'; count: 1 | 2 | 3 | 4 }
  | { kind: 'rail'; middle?: boolean }
  | { kind: 'rail-even' }
  | { kind: 'fixed-shelf'; middle?: boolean }
  | { kind: 'partition-middle' }
  | { kind: 'partition-even'; column?: number }

type PartitionUi = {
  from: 'left' | 'right' | 'middle'
  fromPartition: number | null
  fromFace: SideFace
  toFace: SideFace
  offsetMm: string
  gapIndex?: number
  /** Fixed shelf this page stops at. The page does not reach the cabinet top. */
  stopsAtShelf?: number | null
  /** Fixed shelf this page stands on. The page does not continue below it. */
  startsAtShelf?: number | null
  /** Bay this full-height page splits. Empty splits the whole cabinet. */
  splitsPath?: string
}

function partitionToUi(s: {
  from: 'left' | 'right' | 'middle'
  fromPartition?: number | null
  fromFace?: SideFace
  toFace?: SideFace
  offsetMm: number
  gapIndex?: number
  stopsAtShelf?: number | null
  startsAtShelf?: number | null
  splitsPath?: string
}): PartitionUi {
  if (s.from === 'middle') {
    return {
      from: 'middle',
      fromPartition: null,
      fromFace: s.fromFace ?? 'right',
      toFace: s.toFace ?? 'left',
      offsetMm: '0',
      gapIndex: s.gapIndex,
      stopsAtShelf: s.stopsAtShelf ?? null,
      startsAtShelf: s.startsAtShelf ?? null,
      ...(s.splitsPath ? { splitsPath: s.splitsPath } : {}),
    }
  }
  const faces = defaultPartitionFaces(s.from)
  return {
    from: s.from,
    fromPartition: typeof s.fromPartition === 'number' ? s.fromPartition : null,
    fromFace: s.fromFace ?? faces.fromFace,
    toFace: s.toFace ?? faces.toFace,
    offsetMm: String(s.offsetMm),
    ...(s.gapIndex != null ? { gapIndex: s.gapIndex } : {}),
    ...(s.stopsAtShelf != null ? { stopsAtShelf: s.stopsAtShelf } : {}),
    ...(s.startsAtShelf != null ? { startsAtShelf: s.startsAtShelf } : {}),
    ...(s.splitsPath ? { splitsPath: s.splitsPath } : {}),
  }
}

function uiToPartition(row: PartitionUi): PartitionSpec {
  return {
    from: row.from,
    offsetMm: row.from === 'middle' ? 0 : Math.max(0, parseInt(row.offsetMm, 10) || 0),
    fromFace: row.fromFace,
    toFace: row.toFace,
    fromPartition: row.fromPartition,
    ...(row.gapIndex != null ? { gapIndex: row.gapIndex } : {}),
    ...(row.stopsAtShelf != null ? { stopsAtShelf: row.stopsAtShelf } : {}),
    ...(row.startsAtShelf != null ? { startsAtShelf: row.startsAtShelf } : {}),
    ...(row.splitsPath ? { splitsPath: row.splitsPath } : {}),
  }
}

function samePartitionUi(a: PartitionUi[], b: PartitionUi[]): boolean {
  if (a.length !== b.length) return false
  return a.every((row, index) => {
    const other = b[index]
    return (
      !!other &&
      row.from === other.from &&
      row.offsetMm === other.offsetMm &&
      row.fromPartition === other.fromPartition &&
      (row.stopsAtShelf ?? null) === (other.stopsAtShelf ?? null) &&
      (row.startsAtShelf ?? null) === (other.startsAtShelf ?? null) &&
      (row.splitsPath ?? '') === (other.splitsPath ?? '')
    )
  })
}

function partitionNeedsSide(rows: PartitionUi[], index: number): boolean {
  const row = rows[index]
  if (!row || row.from === 'middle' || row.stopsAtShelf != null || row.startsAtShelf != null) return false
  const ref = row.fromPartition
  if (ref == null) return false
  return ref === index || rows[ref] == null || rows[ref].stopsAtShelf != null
}

function newMiddlePartition(gapIndex?: number, stopsAtShelf?: number | null, splitsPath?: string): PartitionUi {
  return {
    from: 'middle',
    fromPartition: null,
    ...defaultPartitionFaces('middle'),
    offsetMm: '0',
    gapIndex,
    ...(stopsAtShelf != null ? { stopsAtShelf } : {}),
    ...(splitsPath ? { splitsPath } : {}),
  }
}

type FixedShelfUi = {
  from: 'bottom' | 'top' | 'middle'
  fromFace: PanelFace
  toFace: PanelFace
  offsetMm: string
  columnIndex: number | null
  /** 0-based index of the fixed shelf this one is measured from. Null = carcass. */
  fromShelf: number | null
  /** Set when the shelf fills only one numbered opening, such as 1.1. */
  bayPath?: string
  /** Adjacent openings this one shelf covers, such as 1.1 and 1.2. */
  spanPaths?: string[]
  /** Страна 1 горе or Страна 1 долу, when both exist. */
  opening?: 'top' | 'bottom'
}

const FULL_CABINET_LABEL = 'На целия шкаф'

function SlidingDetails({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded-sm py-0.5 text-left text-sm font-medium leading-none hover:opacity-80"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
        )}
        <span>{title}</span>
      </button>
      {open ? <div className="mt-2 space-y-2">{children}</div> : null}
    </div>
  )
}

function FormSection({
  title,
  summary,
  children,
  defaultOpen = true,
  disabled = false,
}: {
  title: string
  summary?: string
  children: ReactNode
  defaultOpen?: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const shown = open && !disabled
  return (
    <div className={disabled ? 'opacity-50' : undefined}>
      <button
        type="button"
        disabled={disabled}
        className="flex w-full items-center gap-1.5 rounded-sm py-0.5 text-left text-sm font-medium leading-none hover:opacity-80 disabled:cursor-not-allowed disabled:hover:opacity-100"
        onClick={() => {
          if (!disabled) setOpen((v) => !v)
        }}
        aria-expanded={shown}
        aria-disabled={disabled}
      >
        {shown ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
        )}
        <span>{title}</span>
        {!shown && summary ? (
          <span className="ml-auto text-xs font-normal text-[var(--color-muted-foreground)]">{summary}</span>
        ) : null}
      </button>
      {shown ? children : null}
    </div>
  )
}

function shelfDistanceName(
  from: 'bottom' | 'top' | 'middle',
  fromShelf: number | null,
  bottomLabel: string,
  topLabel: string,
): string {
  if (fromShelf != null && from !== 'middle') return `рафт ${fromShelf + 1}`
  const label = from === 'top' ? topLabel : bottomLabel
  if (label === 'Дъно' || label === 'Отдолу') return 'дъното'
  if (label === 'Плот') return 'плота'
  if (label === 'Бленда') return 'блендата'
  if (label === 'Отгоре') return 'горе'
  if (label === 'Долен рафт') return 'долния рафт'
  if (label === 'Горен рафт') return 'горния рафт'
  return label.toLowerCase()
}

function middleClearanceHint(
  shelfFrom: 'bottom' | 'top' | 'middle',
  gapIndex: number | undefined,
  clearances: { gapIndex: number; count: number; gapMm: number }[],
): string | null {
  if (shelfFrom !== 'middle' || clearances.length === 0) return null
  const hit =
    typeof gapIndex === 'number' && Number.isFinite(gapIndex)
      ? clearances.find((c) => c.gapIndex === gapIndex)
      : undefined
  const c = hit ?? (clearances.length === 1 ? clearances[0] : null)
  if (!c || !(c.gapMm > 0.05)) return null
  return c.count === 1
    ? `${formatMm(c.gapMm)} мм отгоре и отдолу`
    : `${formatMm(c.gapMm)} мм над, между и под рафтовете`
}

function MiddleGapNote({
  clearances,
}: {
  clearances: { gapIndex: number; count: number; gapMm: number }[]
}) {
  const shown = clearances.filter((c) => c.gapMm > 0.05)
  if (shown.length === 0) return null
  const same = shown.every((c) => Math.abs(c.gapMm - shown[0].gapMm) < 0.05)
  const lines = same
    ? [
        {
          gapMm: shown[0].gapMm,
          count: shown.reduce((n, c) => n + c.count, 0),
        },
      ]
    : shown
  return (
    <>
      {lines.map((c, i) => (
        <p key={i} className="mt-2 text-sm">
          Равни разстояния:{' '}
          <span className="font-medium tabular-nums">{formatMm(c.gapMm)} мм</span>
          {c.count === 1 ? ' отгоре и отдолу' : ' над, между и под рафтовете'}
        </p>
      ))}
    </>
  )
}

function zoneShelfSummary(
  count: number,
  clearances: { gapIndex: number; count: number; gapMm: number }[],
): string {
  const n = `${count} ${count === 1 ? 'рафт' : 'рафта'}`
  const shown = clearances.filter((c) => c.gapMm > 0.05)
  if (shown.length === 0) return n
  const same = shown.every((c) => Math.abs(c.gapMm - shown[0].gapMm) < 0.05)
  if (!same) return n
  return `${n} · ${formatMm(shown[0].gapMm)} мм`
}

function ShelfMeasureFields({
  from,
  fromFace,
  toFace,
  offsetMm,
  fromShelf = null,
  otherShelves = [],
  originHint,
  measureHint,
  offsetId,
  allowMiddle,
  bottomLabel = 'Дъно',
  topLabel = 'Плот',
  onFrom,
  onMeasureFrom,
  onFromFace,
  onToFace,
  onOffset,
}: {
  from: 'bottom' | 'top' | 'middle'
  fromFace: PanelFace
  toFace: PanelFace
  offsetMm: string
  fromShelf?: number | null
  otherShelves?: { index: number; label: string }[]
  originHint: string
  measureHint: string
  offsetId: string
  allowMiddle?: boolean
  bottomLabel?: string
  topLabel?: string
  onFrom: (from: 'bottom' | 'top' | 'middle') => void
  onMeasureFrom?: (next: { from: 'bottom' | 'top' | 'middle'; fromShelf: number | null }) => void
  onFromFace: (face: PanelFace) => void
  onToFace: (face: PanelFace) => void
  onOffset: (value: string) => void
}) {
  const middle = from === 'middle'
  const choose = (nextFrom: 'bottom' | 'top' | 'middle', shelf: number | null) => {
    if (onMeasureFrom) onMeasureFrom({ from: nextFrom, fromShelf: shelf })
    else onFrom(nextFrom)
  }
  const caption =
    from === 'middle'
      ? 'средата на отвора'
      : fromShelf != null
        ? `рафт ${fromShelf + 1} (${from === 'bottom' ? 'нагоре' : 'надолу'})`
        : shelfDistanceName(from, null, bottomLabel, topLabel)
  return (
    <>
      <p className="text-xs text-[var(--color-muted-foreground)]">Мери от</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={from === 'bottom' && fromShelf == null ? 'default' : 'outline'}
          onClick={() => choose('bottom', null)}
        >
          {bottomLabel}
        </Button>
        {otherShelves.map((shelf) => (
          <Button
            key={`from-shelf-${shelf.index}`}
            type="button"
            size="sm"
            variant={fromShelf === shelf.index && !middle ? 'default' : 'outline'}
            onClick={() => choose('bottom', shelf.index)}
          >
            {shelf.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={from === 'top' && fromShelf == null ? 'default' : 'outline'}
          onClick={() => choose('top', null)}
        >
          {topLabel}
        </Button>
        {allowMiddle && (
          <Button
            type="button"
            size="sm"
            variant={middle ? 'default' : 'outline'}
            onClick={() => choose('middle', null)}
          >
            По средата
          </Button>
        )}
      </div>
      {fromShelf != null && !middle && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={from === 'bottom' ? 'default' : 'outline'}
            onClick={() => choose('bottom', fromShelf)}
          >
            Нагоре от него
          </Button>
          <Button
            type="button"
            size="sm"
            variant={from === 'top' ? 'default' : 'outline'}
            onClick={() => choose('top', fromShelf)}
          >
            Надолу от него
          </Button>
        </div>
      )}
      <p className="text-xs text-[var(--color-muted-foreground)]">От {caption}</p>
      {middle && originHint ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">{originHint}</p>
      ) : null}
      {!middle && (
        <>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={fromFace === 'bottom' ? 'default' : 'outline'}
              onClick={() => onFromFace('bottom')}
            >
              Долна страна
            </Button>
            <Button
              type="button"
              size="sm"
              variant={fromFace === 'top' ? 'default' : 'outline'}
              onClick={() => onFromFace('top')}
            >
              Горна страна
            </Button>
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)]">До рафта</p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={toFace === 'bottom' ? 'default' : 'outline'}
              onClick={() => onToFace('bottom')}
            >
              Долна страна
            </Button>
            <Button
              type="button"
              size="sm"
              variant={toFace === 'top' ? 'default' : 'outline'}
              onClick={() => onToFace('top')}
            >
              Горна страна
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={offsetId} className="w-28 shrink-0 text-xs">
              Размер (мм)
            </Label>
            <DraftNumber id={offsetId} inputMode="decimal" value={offsetMm} onCommit={(n) => onOffset(String(n))} />
          </div>
        </>
      )}
      <p className="text-xs text-[var(--color-muted-foreground)]">{measureHint}</p>
    </>
  )
}

interface CabinetDraft {
  typeId: string
  params: Record<string, unknown>
  quantity: number
}

interface CabinetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: CabinetInstance | null
  sheets: Sheet[]
  dailyRateEur: number
  settings?: { hardware: HardwareSettings; assemblyTime: AssemblyTimeSettings }
  onHardwareSettingsChange?: (settings: HardwareSettings) => void
  projectCabinets?: CabinetInstance[]
  onSave: (input: { typeId: string; params: Record<string, unknown>; quantity: number }) => void
  onSaveGroup?: (group: SavedCabinetGroup) => void
  /** Cabinets already chosen to join, when the dialog is opened from the cabinet list. */
  startAttached?: AttachedCabinet[]
  room: RoomPlan
}

const WITH_ROOM_KEY = 'sketchcut.cabinetView'

/** Cabinet in its room (the default) or alone, as last chosen in the form. */
function readWithRoom(): boolean {
  try {
    return localStorage.getItem(WITH_ROOM_KEY) !== 'cabinet'
  } catch {
    return true
  }
}

interface CabinetDialogFormProps extends CabinetDialogProps {
  bare?: boolean
  treatAsNew?: boolean
  stampAttached?: boolean
  attachedRows?: AttachedCabinet[]
  onAttachedRows?: (rows: AttachedCabinet[]) => void
  onLiveChange?: (draft: CabinetDraft) => void
  peerDrafts?: Record<string, CabinetDraft>
  groupRole?: 'host' | 'guest'
  lockedCabinetIds?: string[]
  /** Combination id, when the open picture is a joined group saved as its own piece. */
  roomPieceIds?: string[]
}

function initialDepthMode(params: Record<string, unknown> | undefined): 'without-door' | 'with-door' | 'no-doors' {
  const saved = params?.depthMode
  if (saved === 'with-door' || saved === 'without-door' || saved === 'no-doors') return saved
  const hingedOverlay =
    params?.doorStyle !== 'sliding' &&
    params?.innerDoors !== true &&
    (params?.doorCount === 1 ||
      params?.doorCount === 2 ||
      params?.doorCount === 3 ||
      params?.doorCount === 4)
  return hingedOverlay ? 'with-door' : 'without-door'
}

function pieceColorLabel(id: string): string {
  if (id === 'side-left' || id === 'inner-left') return id === 'inner-left' ? 'Лява вътрешна' : 'Лява страница'
  if (id === 'side-right') return 'Дясна страница'
  if (id === 'inner-right') return 'Дясна вътрешна'
  if (id === 'middle') return 'Средна страница'
  if (id === 'headboard') return 'Табла'
  if (id === 'top') return 'Плот'
  if (id === 'bottom' || id.startsWith('bottom-')) return 'Дъно'
  if (id === 'plinth' || id.startsWith('plinth-')) return 'Цокъл'
  if (id.startsWith('rail-front')) return 'Предна бленда'
  if (id.startsWith('rail-back')) return 'Задна бленда'
  if (id.startsWith('fascia')) return 'Бленда'
  if (id.startsWith('shelf-')) return 'Рафт'
  if (id.startsWith('divider-')) return 'Разделителна'
  if (id.startsWith('leg-')) return 'Краче'
  if (id.startsWith('door')) return 'Врата'
  if (id.startsWith('drawer-front')) return 'Чело'
  if (id.startsWith('back')) return 'Гръб'
  if (id.startsWith('support-')) return 'Плоскост под рамката'
  if (id.startsWith('lift-')) return 'Плоскост за механизма'
  if (id.startsWith('box-')) return 'Царга'
  return 'Детайл'
}

function MirrorFields({
  id,
  spec,
  onChange,
  wholeLabel,
  sample,
  doors,
  perM2,
  edgePerM,
  allowHalo = false,
  startGaps,
  bottomHint,
}: {
  id: string
  spec: MirrorSpec
  onChange: (next: MirrorSpec) => void
  wholeLabel: string
  sample: { width: number; height: number; quantity: number } | null
  /** When there is more than one door, the glass is chosen per door. */
  doors?: { id: string; label: string; width: number; height: number }[]
  perM2: number
  edgePerM: number
  /** The glass may be lit from behind (the vanity mirror board). */
  allowHalo?: boolean
  /** Gaps a new mirror starts with (the vanity), instead of covering the whole panel. */
  startGaps?: { left: number; right: number; top: number; bottom: number }
  /** Says what "Отдолу" is measured from. */
  bottomHint?: string
}) {
  const set = (patch: Partial<MirrorSpec>) => onChange({ ...spec, ...patch })
  const chosenDoors = (doors ?? []).filter((door) => !spec.on || spec.on.includes(door.id))
  const priced =
    doors && doors.length > 0
      ? chosenDoors
      : sample
        ? [{ id: 'board', label: '', width: sample.width, height: sample.height }]
        : []
  const first = priced[0]
  const glass = first && spec.enabled ? mirrorGlass(first.width, first.height, spec) : null
  const quote = glass ? mirrorQuote(glass.width, glass.height, spec.polished, perM2, edgePerM) : null
  const sameSize = priced.every((door) => door.width === first?.width && door.height === first?.height)
  const modes: [MirrorMode, string][] = [
    ['full', wholeLabel],
    ['rise', 'Отдолу нагоре'],
    ['inset', 'Отстъпи'],
  ]
  return (
    <div className="mt-3 rounded-md border border-[var(--color-border)] p-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={spec.enabled}
          onCheckedChange={(c) => {
            const enabled = c === true
            if (!enabled) {
              set({ enabled: false, on: undefined })
              return
            }
            if (startGaps) {
              set({ enabled: true, on: undefined, mode: 'inset', ...startGaps })
              return
            }
            set(doors && doors.length > 1 ? { enabled: true, on: [] } : { enabled: true, on: undefined })
          }}
        />
        Огледало
      </label>
      {spec.enabled && (
        <>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={spec.polished} onCheckedChange={(c) => set({ polished: c === true })} />
            Полиран кант
          </label>
          {allowHalo && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={!!spec.halo}
                  onCheckedChange={(c) => set({ halo: c === true ? (spec.halo ?? 'warm') : undefined })}
                />
                Осветление отзад (ореол)
              </label>
              {spec.halo && (
                <label className="flex items-center gap-2 text-sm">
                  Светлина
                  <select
                    aria-label="Цвят на светлината"
                    className="h-8 rounded-md border border-[var(--color-border)] bg-transparent px-2"
                    value={spec.halo}
                    onChange={(e) => set({ halo: e.target.value as MirrorHalo })}
                  >
                    {(Object.keys(MIRROR_HALO_LABEL) as MirrorHalo[]).map((tone) => (
                      <option key={tone} value={tone}>
                        {MIRROR_HALO_LABEL[tone]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {spec.halo && (
                <p className="w-full text-xs text-[var(--color-muted-foreground)]">
                  На плоскостта се винтира втора, по-малка плоскост (4 см навътре от ръба на огледалото) и огледалото се лепи на нея. LED лентата е по канта на втората плоскост, захранването е на гърба, ключът е на десния ръб. Втората плоскост влиза в разкроя. В 3D „Покажи зад огледалото“ го прави прозрачно, за да видиш всичко отзад.
                </p>
              )}
            </div>
          )}
          {doors && doors.length > 0 && (
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={spec.noPull === true} onCheckedChange={(c) => set({ noPull: c === true ? true : undefined })} />
              Без дръжка на вратата с огледало
            </label>
          )}
          {doors && doors.length > 1 && (
            <div className="mt-3">
              <p className="text-sm">На коя врата?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {doors.map((door) => {
                  const selected = !spec.on || spec.on.includes(door.id)
                  return (
                    <Button
                      key={door.id}
                      type="button"
                      size="sm"
                      variant={selected ? 'default' : 'outline'}
                      onClick={() => {
                        const all = doors.map((item) => item.id)
                        const current = spec.on ?? all
                        const next = current.includes(door.id)
                          ? current.filter((item) => item !== door.id)
                          : [...current, door.id]
                        set({ on: all.filter((item) => next.includes(item)) })
                      }}
                    >
                      {door.label.replace(/^Врата · /, '')}
                    </Button>
                  )
                })}
                <Button
                  type="button"
                  size="sm"
                  variant={!spec.on || spec.on.length === doors.length ? 'default' : 'outline'}
                  onClick={() => set({ on: doors.map((door) => door.id) })}
                >
                  {doors.length === 2 ? 'И двете' : 'Всички'}
                </Button>
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {modes.map(([mode, label]) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={spec.mode === mode ? 'default' : 'outline'}
                onClick={() => set({ mode })}
              >
                {label}
              </Button>
            ))}
          </div>
          {spec.mode === 'rise' && (
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="text-xs" htmlFor={`${id}-rise`}>
                Височина
                <DraftNumber
                  id={`${id}-rise`}
                  inputMode="numeric"
                  value={spec.riseMm}
                  onCommit={(n) => set({ riseMm: Math.max(0, Math.round(n)) })}
                />
              </label>
              <label className="text-xs" htmlFor={`${id}-left`}>
                Отляво
                <DraftNumber
                  id={`${id}-left`}
                  inputMode="numeric"
                  value={spec.left}
                  onCommit={(n) => set({ left: Math.max(0, Math.round(n)) })}
                />
              </label>
              <label className="text-xs" htmlFor={`${id}-right`}>
                Отдясно
                <DraftNumber
                  id={`${id}-right`}
                  inputMode="numeric"
                  value={spec.right}
                  onCommit={(n) => set({ right: Math.max(0, Math.round(n)) })}
                />
              </label>
              <label className="text-xs" htmlFor={`${id}-bottom`}>
                Отдолу
                <DraftNumber
                  id={`${id}-bottom`}
                  inputMode="numeric"
                  value={spec.bottom}
                  onCommit={(n) => set({ bottom: Math.max(0, Math.round(n)) })}
                />
              </label>
            </div>
          )}
          {spec.mode === 'inset' && (
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {(
                [
                  ['left', 'Отляво'],
                  ['right', 'Отдясно'],
                  ['top', 'Отгоре'],
                  ['bottom', 'Отдолу'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-xs" htmlFor={`${id}-${key}`}>
                  {label}
                  <DraftNumber
                    id={`${id}-${key}`}
                    inputMode="numeric"
                    value={spec[key]}
                    onCommit={(n) => set({ [key]: Math.max(0, Math.round(n)) })}
                  />
                </label>
              ))}
            </div>
          )}
          {bottomHint && spec.mode !== 'full' && (
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{bottomHint}</p>
          )}
          <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
            {doors && doors.length > 1 && chosenDoors.length === 0
              ? 'Избери на коя врата да е огледалото.'
              : !first
                ? 'Няма плоскост, върху която да легне огледалото.'
                : !glass
                  ? `Не се събира в ${formatMm(first.width)} × ${formatMm(first.height)} мм. 0 мм е ръбът на плоскостта, не кантът.`
                  : sameSize
                    ? `${priced.length > 1 ? `${priced.length} × ` : ''}огледало ${formatMm(glass.width)} × ${formatMm(glass.height)} мм · ${formatEur(quote?.eur ?? 0)}/бр. Слагането е 30 мин и една бутилка силикон.`
                    : `${chosenDoors
                        .map((door) => {
                          const fit = mirrorGlass(door.width, door.height, spec)
                          const price = fit ? mirrorQuote(fit.width, fit.height, spec.polished, perM2, edgePerM) : null
                          return fit
                            ? `${door.label}: ${formatMm(fit.width)} × ${formatMm(fit.height)} мм · ${formatEur(price?.eur ?? 0)}`
                            : `${door.label}: не се събира`
                        })
                        .join(' · ')}. Слагането е 30 мин и една бутилка силикон.`}
          </p>
        </>
      )}
    </div>
  )
}

function CabinetDialogForm({
  open,
  onOpenChange,
  editing,
  sheets,
  dailyRateEur,
  settings = { hardware: DEFAULT_HARDWARE_SETTINGS, assemblyTime: DEFAULT_ASSEMBLY_TIME_SETTINGS },
  onHardwareSettingsChange,
  projectCabinets = [],
  onSave,
  bare = false,
  treatAsNew = false,
  stampAttached = true,
  attachedRows,
  onAttachedRows,
  onLiveChange,
  peerDrafts,
  groupRole = 'host',
  lockedCabinetIds = [],
  room,
  roomPieceIds = [],
}: CabinetDialogFormProps) {
  const isEdit = !!editing && !treatAsNew
  const [typeId, setTypeId] = useState(editing?.typeId ?? 'kitchen-base')
  
  const initialKitchen = editing && editing.typeId === 'kitchen-base'
    ? parseKitchenBaseParams(editing.params)
    : editing && editing.typeId === 'kitchen-wall'
      ? parseKitchenWallParams(editing.params)
      : DEFAULT_KITCHEN_BASE_PARAMS

  const initialBox =
    editing && editing.typeId === 'vanity'
      ? parseVanityParams(editing.params)
      : editing && editing.typeId === 'wardrobe'
        ? parseWardrobeParams(editing.params)
        : editing && editing.typeId === 'section'
          ? parseSectionParams(editing.params)
          : editing && editing.typeId === 'nightstand'
            ? parseNightstandParams(editing.params)
            : DEFAULT_NIGHTSTAND_PARAMS

  const initialFittings =
    editing?.typeId === 'kitchen-base' || editing?.typeId === 'kitchen-wall'
      ? initialKitchen
      : editing?.typeId === 'nightstand' ||
          editing?.typeId === 'vanity' ||
          editing?.typeId === 'section' ||
          editing?.typeId === 'wardrobe'
        ? initialBox
        : initialKitchen

  const initialBed = editing?.typeId === 'bed' ? parseBedParams(editing.params) : DEFAULT_BED_PARAMS
  const [bedMattressLength, setBedMattressLength] = useState(String(initialBed.mattressLength))
  const [bedMattressWidth, setBedMattressWidth] = useState(String(initialBed.mattressWidth))
  const [bedSideHeight, setBedSideHeight] = useState(String(initialBed.sideHeight))
  const [bedLift, setBedLift] = useState(initialBed.liftMechanism)
  const [bedLiftDampers, setBedLiftDampers] = useState(initialBed.liftDampers)
  const [bedHeadboard, setBedHeadboard] = useState(initialBed.headboard)
  const [bedHeadboardHeight, setBedHeadboardHeight] = useState(String(initialBed.headboardHeight))
  const [width, setWidth] = useState(String(editing?.params.width ?? DEFAULT_KITCHEN_BASE_PARAMS.width))
  const [height, setHeight] = useState(String(editing?.params.height ?? DEFAULT_KITCHEN_BASE_PARAMS.height))
  const [depth, setDepth] = useState(String(editing?.params.depth ?? DEFAULT_KITCHEN_BASE_PARAMS.depth))
  const [depthMode, setDepthMode] = useState<'without-door' | 'with-door' | 'no-doors'>(() =>
    initialDepthMode(editing?.params),
  )
  const [thickness, setThickness] = useState(String(editing?.params.thickness ?? DEFAULT_KITCHEN_BASE_PARAMS.thickness))
  const [legHeight, setLegHeight] = useState(
    'legHeight' in initialKitchen && initialKitchen.legHeight === 150 ? 150 : 100,
  )
  const [shelfCount, setShelfCount] = useState(initialFittings.shelfCount)
  const [movableShelves, setMovableShelves] = useState<MovableShelfUi[]>(
    (initialFittings.movableShelves ?? []).map(movableToUi),
  )
  const [hasBack, setHasBack] = useState(initialFittings.hasBack)
  const [nailBack, setNailBack] = useState(initialFittings.nailBack === true)
  const [clothesRails, setClothesRails] = useState<ClothesRailUi[]>(() => {
    const rows = (initialFittings.clothesRails ?? []).map(railToUi)
    if (rows.length > 0) return rows
    return initialFittings.hasClothesRail ? [newClothesRail(0, 0)] : []
  })
  const [doorCount, setDoorCount] = useState(initialFittings.doorCount)
  const [externalDoors, setExternalDoors] = useState(initialFittings.externalDoors === true)
  const [innerDrawerFronts, setInnerDrawerFronts] = useState(initialFittings.innerDrawerFronts === true)
  const [innerDoors, setInnerDoors] = useState(initialFittings.innerDoors === true)
  const [doorStyle, setDoorStyle] = useState<DoorStyle>(
    editing?.typeId === 'wardrobe' ? 'sliding' : parseDoorStyle(initialFittings.doorStyle),
  )
  const initialSlidingCount =
    (initialFittings as { slidingDoorCount?: number }).slidingDoorCount === 3 ||
    (Array.isArray((initialFittings as { slidingEdges?: unknown }).slidingEdges) &&
      ((initialFittings as { slidingEdges?: unknown[] }).slidingEdges?.length ?? 0) >= 3)
      ? 3
      : 2
  const [slidingDoorCount, setSlidingDoorCount] = useState<2 | 3>(initialSlidingCount)
  const [slidingBayMode, setSlidingBayMode] = useState<'equal' | 'custom'>(
    (initialFittings.partitions ?? []).length > 0 ? 'custom' : 'equal',
  )
  const [slidingEdges, setSlidingEdges] = useState<SlidingDoorEdges[]>(
    initialSlidingCount === 3
      ? threeDoorSlidingEdges()
      : parseSlidingEdges((initialFittings as { slidingEdges?: unknown }).slidingEdges, 2),
  )
  const [slidingUpperTrackColor, setSlidingUpperTrackColor] = useState<SlidingTrackColor>(
    (initialFittings.slidingUpperTrackColor as SlidingTrackColor | undefined) ?? 'black',
  )
  const [slidingLowerTrackColor, setSlidingLowerTrackColor] = useState<SlidingTrackColor>(
    (initialFittings.slidingLowerTrackColor as SlidingTrackColor | undefined) ?? 'black',
  )
  const [slidingHandleSkuId, setSlidingHandleSkuId] = useState(
    typeof initialFittings.slidingHandleSkuId === 'string' ? initialFittings.slidingHandleSkuId : '',
  )
  const [slidingCapSkuId, setSlidingCapSkuId] = useState(
    typeof initialFittings.slidingCapSkuId === 'string' ? initialFittings.slidingCapSkuId : '',
  )
  const [slidingSoftCloseLeft, setSlidingSoftCloseLeft] = useState(
    String(initialFittings.slidingSoftCloseLeft ?? 1),
  )
  const [slidingSoftCloseRight, setSlidingSoftCloseRight] = useState(
    String(initialFittings.slidingSoftCloseRight ?? 1),
  )
  const [drawerFrontHeights, setDrawerFrontHeights] = useState<string[]>(
    initialFittings.drawerFrontHeights.map(String),
  )
  const [cutFromOneBoard, setCutFromOneBoard] = useState(initialFittings.cutFromOneBoard)
  const [includeHandles, setIncludeHandles] = useState(initialFittings.includeHandles !== false)
  const [handleSku, setHandleSku] = useState<PullSku>(initialFittings.handleSku ?? 'normal')
  const [handleOverrides, setHandleOverrides] = useState<Record<string, PullSku>>(initialFittings.handleOverrides ?? {})
  const [slideKind, setSlideKind] = useState<SlideKind>(parseSlideKind(initialFittings.slideKind))
  /** How hard it is to measure where the drawer fronts come: sets the time for marking the slides. */
  const [drawerMeasureLevel, setDrawerMeasureLevel] = useState<DrawerMeasureLevel>(
    parseDrawerMeasureLevel((editing?.params as Record<string, unknown> | undefined)?.drawerMeasureLevel),
  )
  const [slideLength, setSlideLength] = useState(initialFittings.slideLength)

  const initialVanity = editing?.typeId === 'vanity' ? parseVanityParams(editing.params) : DEFAULT_VANITY_PARAMS
  const [knee, setKnee] = useState<VanityKnee>(initialVanity.knee)
  const [kneeWidth, setKneeWidth] = useState(String(initialVanity.kneeWidth))
  const [legSide, setLegSide] = useState<VanityLegSide>(initialVanity.legSide)
  const [backRailHeight, setBackRailHeight] = useState(String(initialVanity.backRailHeight))
  const [doorMirror, setDoorMirror] = useState<MirrorSpec>(() => parseMirrorSpec(editing?.params.doorMirror))
  const [boardMirror, setBoardMirror] = useState<MirrorSpec>(() => parseMirrorSpec(editing?.params.boardMirror))
  const [plinthCount, setPlinthCount] = useState<1 | 2>(initialBox.plinthCount)
  const [plinthHeight, setPlinthHeight] = useState(String(initialBox.plinthHeight))
  const [useLegs, setUseLegs] = useState(initialBox.useLegs)
  const [topStyle, setTopStyle] = useState<CabinetTopStyle>(() => {
    if (editing?.typeId === 'kitchen-base') return parseKitchenTopStyle(editing.params.topStyle)
    if (
      editing?.typeId === 'nightstand' ||
      editing?.typeId === 'vanity' ||
      editing?.typeId === 'section' ||
      editing?.typeId === 'wardrobe'
    ) {
      return parseBoxTopStyle(editing.params.topStyle)
    }
    return 'rails'
  })
  const initialWall = editing?.typeId === 'kitchen-wall' ? parseKitchenWallParams(editing.params) : DEFAULT_KITCHEN_WALL_PARAMS
  const [hasHood, setHasHood] = useState(initialWall.hasHood)
  const [hoodShape, setHoodShape] = useState<HoodShape>(initialWall.hoodShape)
  const [hoodDiameter, setHoodDiameter] = useState(String(initialWall.hoodDiameter))
  const [hoodRectW, setHoodRectW] = useState(String(initialWall.hoodRectW))
  const [hoodRectD, setHoodRectD] = useState(String(initialWall.hoodRectD))
  
  const [quantity, setQuantity] = useState(String(editing?.quantity ?? 1))
  const [showDimLines, setShowDimLines] = useState(false)
  const [showOpeningDims, setShowOpeningDims] = useState(false)
  const [showFronts, setShowFronts] = useState(false)
  const [dimFontScale, setDimFontScale] = useState(() => parseDimFontScale(initialFittings.dimFontScale))
  const [shelfFrontInset, setShelfFrontInset] = useState(() => String(shelfFrontInsetMm(initialFittings)))
  const [fixedShelves, setFixedShelves] = useState<FixedShelfUi[]>(
    (initialFittings.fixedShelves ?? []).map((s) => {
      const faces = defaultShelfFaces(s.from)
      return {
        from: s.from,
        fromFace: s.fromFace ?? faces.fromFace,
        toFace: s.toFace ?? faces.toFace,
        offsetMm: String(s.offsetMm),
        columnIndex: typeof s.columnIndex === 'number' ? s.columnIndex : null,
        fromShelf: typeof s.fromShelf === 'number' ? s.fromShelf : null,
        ...(s.bayPath ? { bayPath: s.bayPath } : {}),
        ...(s.opening === 'top' || s.opening === 'bottom' ? { opening: s.opening } : {}),
        ...(s.spanPaths && s.spanPaths.length >= 2 ? { spanPaths: s.spanPaths } : {}),
      }
    }),
  )
  const [partitions, setPartitions] = useState<PartitionUi[]>(
    (initialFittings.partitions ?? []).map(partitionToUi),
  )
  const kneeRef = useRef(knee)
  useEffect(() => {
    if (typeId !== 'vanity') return
    const prev = kneeRef.current
    kneeRef.current = knee
    if (knee === 'none') {
      if (prev !== 'none') {
        setPartitions((cur) =>
          cur.filter((row) => row.stopsAtShelf != null || row.startsAtShelf != null || !!row.splitsPath),
        )
      }
      return
    }
    const opening = vanityOpening({
      width: Number(width) || 0,
      thickness: Number(thickness) || 18,
      knee,
      kneeWidth: Number(kneeWidth) || 0,
      legSide,
    })
    if (!opening || opening.error) return
    setPartitions((cur) => {
      const next = mergeKneePartitions(cur.map(uiToPartition), opening.dividers).map(partitionToUi)
      return samePartitionUi(cur, next) ? cur : next
    })
  }, [typeId, knee, kneeWidth, width, thickness, legSide])
  const [doorSpan, setDoorSpan] = useState<DoorSpan>(initialFittings.doorSpan === 'zones' ? 'zones' : 'full')
  const [zoneUi, setZoneUi] = useState<Record<string, ZoneUi>>(zoneUiFromFittings(initialFittings.zones))
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null)
  const [evenPartitionError, setEvenPartitionError] = useState<string | null>(null)
  const [colors, setColors] = useState<CabinetPartColors>({
    ...DEFAULT_PART_COLORS,
    ...(editing?.params.colors as CabinetPartColors | undefined),
  })
  const [pieceFinishes, setPieceFinishes] = useState<Record<string, string>>(() =>
    parsePieceFinishes(editing?.params.pieceFinishes),
  )
  const [pickedPiece, setPickedPiece] = useState<string | null>(null)
  // What the colour squares below the lists paint: the carcass, the doors or the back.
  const [swatchTarget, setSwatchTarget] = useState<'carcass' | 'front'>('carcass')
  const [carcassFinishId, setCarcassFinishId] = useState(
    typeof editing?.params.carcassFinishId === 'string' ? editing.params.carcassFinishId : '',
  )
  const [frontFinishId, setFrontFinishId] = useState(
    typeof editing?.params.frontFinishId === 'string' ? editing.params.frontFinishId : '',
  )
  const [drawStyle, setDrawStyle] = useState<'line' | 'color' | 'model'>('model')
  // The 3D picture shows the cabinet in its room or alone. The last choice is kept for next time.
  const [withRoom, setWithRoom] = useState(() => readWithRoom())
  // „Сглобяване“: the 3D picture plays how the cabinet is put together, step by step.
  const [assemblyFilm, setAssemblyFilm] = useState(false)
  const changeWithRoom = (next: boolean) => {
    setWithRoom(next)
    try {
      localStorage.setItem(WITH_ROOM_KEY, next ? 'room' : 'cabinet')
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  }
  const [doorView, setDoorView] = useState<'hidden' | 'closed' | 'open'>('hidden')
  const [attachedState, setAttachedState] = useState<AttachedCabinet[]>([])
  const attached = attachedRows ?? attachedState
  const setAttached = (action: AttachedCabinet[] | ((rows: AttachedCabinet[]) => AttachedCabinet[])) => {
    const next = typeof action === 'function' ? action(attached) : action
    onAttachedRows?.(next)
    if (attachedRows == null) setAttachedState(next)
  }

  const builtParams = useMemo(() => {
    if (typeId === 'bed') {
      const bed = parseBedParams({
        mattressLength: parseInt(bedMattressLength, 10),
        mattressWidth: parseInt(bedMattressWidth, 10),
        sideHeight: parseInt(bedSideHeight, 10),
        thickness: parseInt(thickness, 10),
        liftMechanism: bedLift,
        liftDampers: bedLiftDampers,
        headboard: bedHeadboard,
        headboardHeight: parseInt(bedHeadboardHeight, 10),
        colors,
      })
      return {
        ...bed,
        drawerFrontHeights: [] as number[],
        doorCount: 0 as DoorCount,
        shelfCount: 0,
        movableShelves: [] as never[],
        fixedShelves: [] as never[],
        partitions: [] as never[],
        doorSpan: 'full' as const,
        zones: {} as Record<string, never>,
        hasClothesRail: false,
        clothesRails: [] as never[],
        cutFromOneBoard: false,
      }
    }
    const inputDepth = parseInt(depth, 10)
    const inputThickness = parseInt(thickness, 10)

    const hasSplit = fixedShelves.length > 0 || partitions.length > 0
    const noDoors = depthMode === 'no-doors'
    const movable = fittingsFromMovable(hasSplit ? [] : movableShelves, hasSplit ? 0 : shelfCount)
    const zoneMap = hasSplit ? serializeZoneUi(zoneUi, cutFromOneBoard) : {}
    const fittings = {
      shelfCount: movable.shelfCount,
      movableShelves: movable.movableShelves,
      hasBack,
      nailBack: hasBack && nailBack,
      hasClothesRail: hasSplit ? false : clothesRails.length > 0,
      clothesRails: hasSplit ? [] : railsToSpecs(clothesRails),
      doorCount: noDoors ? 0 : doorCount,
      doorStyle: noDoors ? 'hinged' : typeId === 'wardrobe' ? 'sliding' : doorStyle,
      depthMode,
      slidingDoorCount: noDoors ? 2 : slidingDoorCount,
      slidingEdges: noDoors ? [] : slidingDoorCount === 3 ? threeDoorSlidingEdges() : slidingEdges,
      slidingUpperTrackColor,
      slidingLowerTrackColor,
      slidingHandleSkuId,
      slidingCapSkuId,
      slidingSoftCloseLeft: Math.max(0, parseInt(slidingSoftCloseLeft, 10) || 0),
      slidingSoftCloseRight: Math.max(0, parseInt(slidingSoftCloseRight, 10) || 0),
      drawerFrontHeights: drawerFrontHeights.map((s) => parseInt(s, 10) || 0).filter((n) => n > 0),
      cutFromOneBoard,
      includeHandles,
      handleSku,
      handleOverrides,
      slideKind,
      slideLength,
      drawerMeasureLevel,
      externalDoors,
      innerDrawerFronts,
      innerDoors,
      fixedShelves: fixedShelves
        .map((s) => ({
          from: s.from,
          fromFace: s.fromFace,
          toFace: s.toFace,
          offsetMm: mmNum(s.offsetMm),
          columnIndex: s.columnIndex,
          fromShelf: s.fromShelf,
          ...(s.bayPath ? { bayPath: s.bayPath } : {}),
          ...(s.opening === 'top' || s.opening === 'bottom' ? { opening: s.opening } : {}),
          ...(s.spanPaths && s.spanPaths.length >= 2 ? { spanPaths: s.spanPaths } : {}),
        }))
        .filter((s) => s.from === 'middle' || s.offsetMm > 0),
      partitions: partitions
        .map((s) => ({
          from: s.from,
          fromPartition: s.from === 'middle' ? null : s.fromPartition,
          fromFace: s.fromFace,
          toFace: s.toFace,
          offsetMm: s.from === 'middle' ? 0 : mmNum(s.offsetMm),
          ...(s.gapIndex != null ? { gapIndex: s.gapIndex } : {}),
          ...(s.stopsAtShelf != null ? { stopsAtShelf: s.stopsAtShelf } : {}),
          ...(s.startsAtShelf != null ? { startsAtShelf: s.startsAtShelf } : {}),
          ...(s.splitsPath ? { splitsPath: s.splitsPath } : {}),
        }))
        .filter((s) => s.from === 'middle' || s.offsetMm > 0),
      doorSpan: hasSplit ? doorSpan : 'full' as DoorSpan,
      zones: noDoors
        ? Object.fromEntries(
            Object.entries(zoneMap).map(([id, z]) => [id, z ? { ...z, doorCount: 0 as const } : z]),
          )
        : zoneMap,
      dimFontScale,
      shelfFrontInset: Math.max(0, parseInt(shelfFrontInset, 10) || 0),
      doorMirror,
      boardMirror,
    }
    if (typeId === 'vanity') {
      const opening = vanityOpening({
        width: parseInt(width, 10) || 0,
        thickness: inputThickness,
        knee,
        kneeWidth: parseInt(kneeWidth, 10) || 0,
        legSide,
      })
      const parts =
        opening && !opening.error
          ? mergeKneePartitions(fittings.partitions, opening.dividers)
          : fittings.partitions
      return parseVanityParams({
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        depth: inputDepth,
        thickness: inputThickness,
        useLegs: knee === 'none' ? useLegs : false,
        plinthCount,
        plinthHeight: parseInt(plinthHeight, 10),
        legHeight,
        colors,
        topStyle,
        railWidth: DEFAULT_RAIL_WIDTH,
        ...fittings,
        partitions: parts,
        knee,
        kneeWidth: opening && !opening.error ? opening.knee : parseInt(kneeWidth, 10) || DEFAULT_VANITY_PARAMS.kneeWidth,
        legSide,
        backRailHeight: parseInt(backRailHeight, 10) || VANITY_BACK_RAIL_MM,
      })
    }
    if (typeId === 'nightstand') {
      return parseNightstandParams({
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        depth: inputDepth,
        thickness: inputThickness,
        useLegs,
        plinthCount,
        plinthHeight: parseInt(plinthHeight, 10),
        legHeight,
        colors,
        topStyle,
        railWidth: DEFAULT_RAIL_WIDTH,
        ...fittings,
      })
    }
    if (typeId === 'section') {
      return parseSectionParams({
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        depth: inputDepth,
        thickness: inputThickness,
        useLegs: false,
        plinthCount,
        plinthHeight: parseInt(plinthHeight, 10),
        colors,
        topStyle,
        railWidth: DEFAULT_RAIL_WIDTH,
        ...fittings,
      })
    }
    if (typeId === 'wardrobe') {
      return parseWardrobeParams({
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        depth: inputDepth,
        thickness: inputThickness,
        useLegs: false,
        plinthCount,
        plinthHeight: parseInt(plinthHeight, 10),
        colors,
        topStyle,
        railWidth: DEFAULT_RAIL_WIDTH,
        ...fittings,
        doorStyle: depthMode === 'no-doors' ? 'hinged' : 'sliding',
        doorCount: depthMode === 'no-doors' ? 0 : 2,
      })
    }
    if (typeId === 'kitchen-wall') {
      return parseKitchenWallParams({
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        depth: inputDepth,
        thickness: inputThickness,
        hasHood,
        hoodShape,
        hoodDiameter: parseInt(hoodDiameter, 10),
        hoodRectW: parseInt(hoodRectW, 10),
        hoodRectD: parseInt(hoodRectD, 10),
        colors,
        ...fittings,
      })
    }

    return parseKitchenBaseParams({
      width: parseInt(width, 10),
      height: parseInt(height, 10),
      depth: inputDepth,
      thickness: inputThickness,
      legHeight,
      railWidth: DEFAULT_KITCHEN_BASE_PARAMS.railWidth,
      topStyle,
      colors,
      ...fittings,
    })
  }, [typeId, width, height, depth, depthMode, thickness, legHeight, shelfCount, movableShelves, hasBack, nailBack, clothesRails, doorCount, doorStyle, slidingDoorCount, slidingEdges, slidingUpperTrackColor, slidingLowerTrackColor, slidingHandleSkuId, slidingCapSkuId, slidingSoftCloseLeft, slidingSoftCloseRight, drawerFrontHeights, cutFromOneBoard, includeHandles, handleSku, handleOverrides, slideKind, slideLength, drawerMeasureLevel, useLegs, plinthCount, plinthHeight, colors, topStyle, hasHood, hoodShape, hoodDiameter, hoodRectW, hoodRectD, fixedShelves, partitions, doorSpan, zoneUi, externalDoors, innerDrawerFronts, innerDoors, dimFontScale, shelfFrontInset, knee, kneeWidth, legSide, backRailHeight, doorMirror, boardMirror, bedMattressLength, bedMattressWidth, bedSideHeight, bedLift, bedLiftDampers, bedHeadboard, bedHeadboardHeight])

  const params = useMemo(
    () => ({
      ...builtParams,
      ...(Object.keys(pieceFinishes).length > 0 ? { pieceFinishes } : {}),
      ...(carcassFinishId ? { carcassFinishId } : {}),
      ...(frontFinishId ? { frontFinishId } : {}),
      ...(stampAttached && attached.length > 0 ? { attached } : {}),
    }),
    [builtParams, pieceFinishes, carcassFinishId, frontFinishId, attached, stampAttached],
  )

  const qty = Math.max(1, parseInt(quantity, 10) || 1)

  useEffect(() => {
    onLiveChange?.({ typeId, params, quantity: qty })
  }, [onLiveChange, typeId, params, qty])
  const attachedGuests = attached.flatMap((row) => {
    const cabinet = projectCabinets.find((item) => item.id === row.cabinetId)
    return cabinet ? [{ row, cabinet }] : []
  })
  const result = useMemo(() => {
    try {
      const span = attachedGuests.some(
        (item, index) => spanDoorCountOf(item.row) > 0 && attachmentTouchesHost(attachedGuests.map((guest) => guest.row), index),
      )
      const genParams = span ? { ...params, doorCount: 0 } : params
      // Shelf pins at a spot a cabinet before this one already marked go quicker.
      const generated = repriceShelfPins(
        scaleCabinetResult(generateCabinet(typeId, { ...genParams }, settings), qty),
        walkShelfPinSpots(projectCabinets, settings, editing?.id ?? null),
      )
      if (attachedGuests.length === 0) return generated
      return withAttachments(
        generated,
        attachedGuests.map((item) => item.row),
        cabinetOuterSize(typeId, params),
        attachedGuests.map((item) => {
          const peer = peerDrafts?.[item.cabinet.id]
          return cabinetOuterSize(peer?.typeId ?? item.cabinet.typeId, peer?.params ?? item.cabinet.params)
        }),
        settings.hardware,
        frontFinishId || carcassFinishId,
      )
    } catch {
      return null
    }
  }, [typeId, params, qty, settings, attachedGuests, peerDrafts, projectCabinets, editing?.id])

  const estimate = result ? estimateFromPanels(result.panels) : null
  const breakdown = result
    ? explainCabinetPrice({
        panels: result.panels,
        hardware: result.hardware,
        assemblyMinutes: result.labor.assemblyMinutes,
        assemblySteps: result.labor.assemblySteps,
        dailyRateEur,
        sheets,
        settings: settings.hardware,
      })
    : null
  const hasFittings = typeId === 'kitchen-base' || typeId === 'kitchen-wall' || typeId === 'nightstand' || typeId === 'vanity' || typeId === 'section' || typeId === 'wardrobe'
  const isKitchenCarcass = typeId === 'kitchen-base' || typeId === 'kitchen-wall'
  const isPlinthBox = typeId === 'nightstand' || typeId === 'vanity' || typeId === 'section' || typeId === 'wardrobe'
  const isSlidingCabinet = typeId === 'wardrobe' || (typeId === 'section' && doorStyle === 'sliding')
  const slidingLocksDepth = isSlidingCabinet && depthMode !== 'no-doors'
  const nsMeasure =
    isKitchenCarcass || typeId === 'bed'
      ? null
      : measureNightstand(params as ReturnType<typeof parseNightstandParams>, typeId === 'section' || typeId === 'wardrobe')
  const slidePanelD = nsMeasure
    ? isSlidingCabinet
      ? nsMeasure.partitionD
      : nsMeasure.sideD
    : params.depth
  const slideOverlayMm =
    isSlidingCabinet &&
    !(params as { innerDrawerFronts?: boolean }).innerDrawerFronts &&
    (params as { drawerFrontHeights?: number[] }).drawerFrontHeights?.some((h) => h > 0)
      ? frontDoorOverhang(params.thickness)
      : 0
  const slideDepth = slideRunnerDepth(slidePanelD, isSlidingCabinet, slideOverlayMm)
  const shelfFromPartition = nsMeasure?.sliding === true
  const shelfReferenceD = isKitchenCarcass
    ? flushCarcassDepth(params.depth, params.thickness, depthMode)
    : !nsMeasure
      ? params.depth
      : shelfFromPartition
        ? nsMeasure.partitionD
        : nsMeasure.sideD
  const shelfInsetValue = Math.max(0, parseInt(shelfFrontInset, 10) || 0)
  const shelfCutDepth = Math.max(params.thickness, shelfReferenceD - shelfInsetValue)
  function alignShelfInset(nextSliding: boolean) {
    if (typeId !== 'wardrobe' && typeId !== 'section') return
    setShelfFrontInset((cur) => {
      const n = Number(cur)
      const slidingDefault = shelfFrontInsetMm({ doorStyle: 'sliding' })
      const sideDefault = shelfFrontInsetMm({ doorStyle: 'hinged' })
      if (nextSliding && n === sideDefault) return String(slidingDefault)
      if (!nextSliding && n === slidingDefault) return String(sideDefault)
      return cur
    })
  }
  const innerH =
    typeId === 'kitchen-base'
      ? kitchenClearInnerH(params.height, params.thickness, (params as ReturnType<typeof parseKitchenBaseParams>).topStyle)
      : typeId === 'kitchen-wall'
        ? params.height - 2 * params.thickness
        : typeId === 'bed'
          ? params.height
          : nsMeasure!.innerH
  const floorDropMm =
    typeId === 'kitchen-wall'
      ? 0
      : typeId === 'kitchen-base'
        ? legHeight + params.thickness
        : (nsMeasure?.supportH ?? 0) + params.thickness
  const topBoardCaption =
    typeId === 'kitchen-base'
      ? topStyle === 'rails'
        ? 'блендата'
        : 'горе'
      : topStyle === 'panel'
        ? 'плота'
        : 'горе'
  const topOriginLabel =
    topBoardCaption === 'плота' ? 'Плот' : topBoardCaption === 'блендата' ? 'Бленда' : 'Отгоре'
  const innerW = isKitchenCarcass || typeId === 'bed' ? params.width - 2 * params.thickness : nsMeasure!.innerW
  const frontH = isKitchenCarcass || typeId === 'bed' ? params.height : nsMeasure!.frontHeight
  const overlayFrontH = isSlidingCabinet ? innerH : frontH
  const drawerFrontH = innerDrawerFronts ? innerH : overlayFrontH
  const doorFrontH = innerDoors ? innerH : overlayFrontH
  const drawerBottomGap = isSlidingCabinet ? SLIDING_DRAWER_FROM_BOTTOM_MM : 0
  const layout = layoutInterior({
    innerH,
    innerW,
    thickness: params.thickness,
    fixedShelves: params.fixedShelves ?? [],
    partitions: params.partitions ?? [],
    doorSpan: params.doorSpan ?? 'full',
    doorCount: isSlidingCabinet ? 0 : params.doorCount,
    shelfCount: params.shelfCount,
    movableShelves: params.movableShelves,
    drawerFrontHeights: params.drawerFrontHeights,
    cutFromOneBoard: params.cutFromOneBoard,
    hasClothesRail: params.hasClothesRail,
    clothesRails: params.clothesRails,
    overlayCovers: nsMeasure
      ? isSlidingCabinet
        ? { top: false, bottom: false }
        : { top: nsMeasure.frontCoversTop, bottom: nsMeasure.frontCoversBottom }
      : typeId === 'kitchen-wall'
        ? { top: true, bottom: true }
        : (params as ReturnType<typeof parseKitchenBaseParams>).topStyle === 'rails'
          ? undefined
          : { top: false, bottom: true },
    zones: isSlidingCabinet
      ? Object.fromEntries(
          Object.entries(params.zones ?? {}).map(([id, z]) => [id, z ? { ...z, doorCount: 0 as const } : z]),
        )
      : params.zones,
  })
  const kneeOpening = typeId === 'vanity' ? vanityOpening(params as VanityParams) : null
  const threeDoorCheck =
    isSlidingCabinet && slidingDoorCount === 3 && depthMode !== 'no-doors'
      ? assessThreeSlidingDoors({
          innerW,
          thickness: params.thickness,
          columns: layout.columns,
          drawerColumns: [
            ...new Set(
              layout.zones
                .filter((z) => z.drawerFrontHeights.some((h) => h > 0))
                .map((z) => z.colIndex),
            ),
          ],
          fullWidthDrawers: layout.fullDrawerFrontHeights.length > 0,
          insetDrawers: innerDrawerFronts,
          bayMode: slidingBayMode,
          currentOffsets: (() => {
            const xs = [...layout.partitions].sort((a, b) => a.xLeft - b.xLeft)
            return xs.length >= 2 ? ([xs[0].xLeft, xs[1].xLeft] as [number, number]) : null
          })(),
        })
      : null
  const error = validate(typeId, params, layout, overlayFrontH, drawerBottomGap, {
    drawers: innerDrawerFronts,
    doors: innerDoors,
    innerH,
  })
  const counts = fittingsCountsFromParams(params)
  const projectExternalDoors = settings.hardware.externalDoors
  const rememberKronospan = (id: string) => {
    const board = kronospanBoardByFinishId(id)
    const next = board
      ? withKronospanBoard(settings.hardware.boardFinishes, board)
      : null
    if (!next || next === settings.hardware.boardFinishes) return
    onHardwareSettingsChange?.({ ...settings.hardware, boardFinishes: next })
  }
  const pickBoard = (board: KronospanBoard, target: 'carcass' | 'front') => {
    rememberKronospan(kronospanBoardId(board))
    const id = kronospanBoardId(board)
    if (target === 'carcass') setCarcassFinishId(id)
    else setFrontFinishId(id)
  }
  const pickKronospan = (swatch: KronospanSwatch, target: 'carcass' | 'front') => {
    const id = kronospanFinishId(swatch.code)
    if (kronospanBoardByFinishId(id)) rememberKronospan(id)
    else {
      const next = withKronospanFinish(settings.hardware.boardFinishes, swatch)
      if (next !== settings.hardware.boardFinishes) {
        onHardwareSettingsChange?.({ ...settings.hardware, boardFinishes: next })
      }
    }
    if (target === 'carcass') setCarcassFinishId(id)
    else setFrontFinishId(id)
  }
  const chooseFinish = (id: string, target: 'carcass' | 'front') => {
    rememberKronospan(id)
    if (target === 'carcass') setCarcassFinishId(id)
    else setFrontFinishId(id)
  }
  const finishFor = (id: string | undefined) => resolveBoardFinish(settings.hardware.boardFinishes, id)
  const effectiveExternalDoors = projectExternalDoors || externalDoors
  const hasDoorsForSource = isSlidingCabinet ? doorCount === 2 : counts.doorCount > 0 || counts.drawerCount > 0
  const hasFixed = (params.fixedShelves?.length ?? 0) > 0
  const hasPartitions = (params.partitions?.length ?? 0) > 0
  const hasSplit = hasFixed || hasPartitions
  const shelfAsksByZone = layout.zones.some((zone) => zoneIsShelfFragment(zone, layout.columns))
  const columnShelves = fixedShelves.filter((row) => !row.bayPath)
  const canAddShelf =
    shelfAsksByZone
      ? layout.zones.some((zone) => zone.path && fixedShelfBayCount(fixedShelves, zone.path) < MAX_FIXED_SHELVES) ||
        canAddFixedShelfFull(columnShelves, Math.max(1, layout.columns.length))
      : canAddMoreFixedShelves(fixedShelves, Math.max(1, layout.columns.length))
  const partitionMiddleGaps =
    partitions.length === 0 || layout.partitions.length > 0
      ? partitionGapOpenings(
          layout.partitions,
          innerW,
          layout.columns.map((column) => column.path),
        ).filter(
          (g) => g.end - g.start >= params.thickness + MIN_ZONE_CLEAR_MM * 2,
        )
      : []
  const lowestShelfInGap = (columnIndex: number) => {
    const column = layout.columns[columnIndex]
    return [...shelvesCoveringColumn(layout.shelves, column, columnIndex)].sort(
      (a, b) => a.yBottom - b.yBottom,
    )[0]
  }
  const shelfBandsForColumn = (columnIndex: number) => {
    const column = layout.columns[columnIndex]
    if (!column) return [] as { id: string; label: string }[]
    const shelves = [...shelvesCoveringColumn(layout.shelves, column, columnIndex)]
      .filter((shelf) => {
        const x0 = shelf.spanX0 ?? column.x0
        const x1 = shelf.spanX1 ?? column.x1
        return x0 <= column.x0 + 0.5 && x1 >= column.x1 - 0.5
      })
      .sort((a, b) => a.yBottom - b.yBottom)
    if (shelves.length === 0) return [] as { id: string; label: string }[]
    const names =
      shelves.length === 1
        ? ['Долна част', 'Горна част']
        : shelves.length === 2
          ? ['Долна част', 'Средна част', 'Горна част']
          : null
    const bands = [
      {
        id: `part-below:${columnIndex}:${shelves[0]!.specIndex}`,
        label: names?.[0] ?? 'Най-долната част',
      },
    ]
    shelves.forEach((shelf, index) => {
      bands.push({
        id: `part-above:${columnIndex}:${shelf.specIndex}`,
        label: names?.[index + 1] ?? `Над рафт ${index + 1}`,
      })
    })
    return bands
  }
  const partitionPlaceChoices = partitionMiddleGaps.flatMap((g) => {
    const bands = shelfBandsForColumn(g.index)
    if (bands.length > 0) {
      const prefix = partitionMiddleGaps.length > 1 ? `${g.label} · ` : ''
      return bands.map((band) => ({ ...band, label: `${prefix}${band.label}` }))
    }
    const choices = [{ id: `part-gap:${g.index}`, label: g.label }]
    const lowest = lowestShelfInGap(g.index)
    if (lowest && lowest.yBottom >= MIN_ZONE_CLEAR_MM && g.end - g.start >= params.thickness + MIN_ZONE_CLEAR_MM * 2) {
      choices.push({
        id: `part-below:${g.index}:${lowest.specIndex}`,
        label: `${g.label} · отдолу до рафта`,
      })
    }
    return choices
  })
  const danglingPartition = partitions.some((_, index) => partitionNeedsSide(partitions, index))
  const canAddPartitionMiddle =
    partitionMiddleGaps.length > 0 && (partitions.length < MAX_PARTITIONS || danglingPartition)
  const shelfStopForColumn = (columnIndex: number) => {
    const lowest = lowestShelfInGap(columnIndex)
    return lowest && lowest.yBottom >= MIN_ZONE_CLEAR_MM ? lowest : null
  }
  const evenPartChoices = (columnIndex: number): number[] => {
    const bay = layout.columns[columnIndex]
    if (!bay) return []
    const underShelf = shelfStopForColumn(columnIndex) != null
    const inside = underShelf
      ? partitions.filter((p) => p.stopsAtShelf != null && p.gapIndex === columnIndex).length
      : layout.partitions.filter((p) => p.xLeft > bay.x0 + 0.5 && p.xRight < bay.x1 - 0.5).length
    return [2, 3, 4].filter((parts) => {
      const count = parts - 1
      const opening = (bay.innerW - count * params.thickness) / parts
      return opening >= MIN_ZONE_CLEAR_MM && partitions.length - inside + count <= MAX_PARTITIONS
    })
  }
  const middleBetweenExtras =
    pendingAdd?.kind === 'shelf' && pendingAdd.middle
      ? betweenRowExtras(layout.zones, layout.columns.length)
      : []
  const cabinetPinOpenings = zoneHeightOpenings(layout.zones[0] ?? { innerH, y0: 0, movable: [], rails: [] })
  const cabinetPlaceablePinOpenings = placeableHeightOpenings(cabinetPinOpenings, params.thickness)
  const cabinetPinSplitKind = zoneHeightSplitKind(layout.zones[0] ?? { movable: [], rails: [] })
  const pinGapZoneExtras =
    pendingAdd?.kind === 'shelf' && pendingAdd.middle === true && hasSplit
      ? layout.zones.flatMap((z) => {
          const openings = zoneHeightOpenings(z)
          const placeable = placeableHeightOpenings(openings, params.thickness)
          if (placeable.length < 2) return []
          const kind = zoneHeightSplitKind(z)
          return placeable.map((o) => ({
            id: `pin-gap:${z.id}:${o.index}`,
            label:
              placeable.length === 2
                ? `${z.label} · ${heightPartCaption(o, openings.length, kind)}`
                : `${z.label} · ${o.label}`,
          }))
        })
      : []
  const pinSplitZoneIds = new Set(
    pinGapZoneExtras.map((e) => parsePinGapTarget(e.id)?.zoneId).filter((id): id is string => !!id),
  )
  const cabinetRailOpenings = remainingShelfOpenings(
    rowsToSpecs(displayedMovable(movableShelves, shelfCount, innerH, params.thickness)),
    innerH,
    params.thickness,
    shelfCount,
  )
  const railGapZoneExtras =
    pendingAdd?.kind === 'rail' && hasSplit
      ? layout.zones.flatMap((z) => {
          const cur = zoneOf(zoneUi, z.id)
          const rows = displayedMovable(cur.movableShelves, cur.shelfCount, z.innerH, params.thickness)
          const openings = remainingShelfOpenings(
            rowsToSpecs(rows),
            z.innerH,
            params.thickness,
            cur.shelfCount,
          )
          if (openings.length < 2) return []
          return openings.map((o) => ({
            id: `rail-gap:${z.id}:${o.index}`,
            label:
              openings.length === 2
                ? `${z.label} · ${o.index === 0 ? 'под рафта' : 'над рафта'}`
                : `${z.label} · ${o.label}`,
          }))
        })
      : []
  const railSplitZoneIds = new Set(
    railGapZoneExtras.map((e) => parseRailGapTarget(e.id)?.zoneId).filter((id): id is string => !!id),
  )
  const showCabinetRailParts =
    pendingAdd?.kind === 'rail' && !hasSplit && cabinetRailOpenings.length > 1
  const showCabinetPinParts =
    pendingAdd?.kind === 'shelf' && !hasSplit && cabinetPlaceablePinOpenings.length > 1
  const shelfGap = evenShelfGap(innerH, shelfCount, params.thickness)
  const backPlinth =
    typeId !== 'kitchen-base' && !(params as ReturnType<typeof parseNightstandParams>).useLegs
      ? (params as ReturnType<typeof parseNightstandParams>).plinthHeight
      : 0
  const backCut = hardboardCutSize(params.width, params.height, backPlinth)
  const backPlan = planHardboardBack({
    width: backCut.width,
    height: backCut.height,
    ...backNailGeometry(layout, params.thickness),
  })

  const patchZone = (id: CabinetZoneId, next: Partial<ZoneUi>) => {
    setZoneUi((z) => ({ ...z, [id]: { ...zoneOf(z, id), ...next } }))
  }

  const clearZoneDoors = () => {
    setZoneUi((z) => {
      const next = { ...z }
      for (const id of Object.keys(next)) {
        next[id] = { ...zoneOf(next, id), doorCount: 0 }
      }
      return next
    })
  }

  const commitFixedShelves = (next: FixedShelfUi[]) => {
    const colCount = partitions.length + 1
    if (partitions.length === 0) {
      if (fixedShelves.length === 0 && next.length > 0) {
        setZoneUi({
          bottom: {
            ...emptyZoneUi(),
            shelfCount,
            movableShelves,
            clothesRails,
            hasClothesRail: clothesRails.length > 0,
          },
          middle: emptyZoneUi(),
          top: emptyZoneUi(),
        })
        setDoorSpan(doorCount > 0 ? 'full' : 'zones')
        setShelfCount(0)
        setMovableShelves([])
        setClothesRails([])
      } else if (fixedShelves.length > 0 && next.length === 0) {
        setShelfCount(
          zoneOf(zoneUi, 'bottom').shelfCount +
            zoneOf(zoneUi, 'middle').shelfCount +
            zoneOf(zoneUi, 'top').shelfCount,
        )
        setMovableShelves(
          concatMovable([
            zoneOf(zoneUi, 'bottom').movableShelves,
            zoneOf(zoneUi, 'middle').movableShelves,
            zoneOf(zoneUi, 'top').movableShelves,
          ]),
        )
        setDrawerFrontHeights([
          ...zoneOf(zoneUi, 'top').drawerFrontHeights,
          ...zoneOf(zoneUi, 'middle').drawerFrontHeights,
          ...zoneOf(zoneUi, 'bottom').drawerFrontHeights,
        ])
        setClothesRails(
          [
            ...zoneOf(zoneUi, 'bottom').clothesRails,
            ...zoneOf(zoneUi, 'middle').clothesRails,
            ...zoneOf(zoneUi, 'top').clothesRails,
          ].slice(0, MAX_CLOTHES_RAILS),
        )
        if (doorSpan === 'zones') {
          const first = [zoneOf(zoneUi, 'top'), zoneOf(zoneUi, 'middle'), zoneOf(zoneUi, 'bottom')].find(
            (z) => z.doorCount > 0,
          )
          setDoorCount(first?.doorCount ?? 0)
        }
        setCutFromOneBoard(zoneOf(zoneUi, 'bottom').cutFromOneBoard)
      }
    } else {
      setZoneUi((z) => remapZonesAfterFixedChange(z, fixedShelves, next, colCount))
    }
    setPendingAdd(null)
    setFixedShelves(next)
  }

  const addFixedShelf = (
    columnIndex: number | null,
    origin?: 'bottom' | 'top' | 'middle' | number,
    bayPath?: string,
    opening?: 'top' | 'bottom',
  ) => {
    const colCount = Math.max(1, layout.columns.length)
    const columnShelves = fixedShelves.filter((row) => !row.bayPath)
    if (bayPath) {
      if (fixedShelfBayCount(fixedShelves, bayPath) >= MAX_FIXED_SHELVES) return
    } else if (columnIndex != null && !canAddFixedShelfToColumn(columnShelves, columnIndex)) return
    else if (columnIndex == null && !canAddFixedShelfFull(columnShelves, colCount)) return
    const bayZone = bayPath ? layout.zones.find((zone) => zone.path === bayPath) : undefined
    const roomH = bayZone?.innerH ?? innerH
    const already = bayPath
      ? fixedShelfBayCount(fixedShelves, bayPath)
      : columnIndex == null
        ? Math.max(0, ...Array.from({ length: colCount }, (_, c) => shelvesForColumn(columnShelves, c).length))
        : shelvesForColumn(columnShelves, columnIndex).length
    const peers = bayPath
      ? fixedShelves.flatMap((row, index) => (row.bayPath === bayPath ? [index] : []))
      : fixedShelvesInPart(columnShelves, columnIndex)
    const chosen = origin ?? (peers.length > 0 ? peers[peers.length - 1]! : 'bottom')
    const bay = bayPath ? { bayPath, ...(opening ? { opening } : {}) } : {}
    if (chosen === 'middle') {
      commitFixedShelves([
        ...fixedShelves,
        {
          from: 'middle',
          fromShelf: null,
          ...defaultShelfFaces('middle'),
          offsetMm: '0',
          columnIndex,
          ...bay,
        },
      ])
      return
    }
    if (typeof chosen === 'number') {
      const ref = layout.shelves.find((s) => s.specIndex === chosen)
      const room = ref ? Math.max(0, roomH - ref.yTop) : roomH
      const offset = Math.max(MIN_ZONE_CLEAR_MM, exactMm(Math.max(0, (room - params.thickness) / 2)))
      commitFixedShelves([
        ...fixedShelves,
        {
          from: 'bottom',
          fromShelf: chosen,
          ...defaultShelfFaces('bottom'),
          offsetMm: String(offset),
          columnIndex,
          ...bay,
        },
      ])
      return
    }
    const offset = defaultFixedOffsetMm(roomH, params.thickness, already)
    commitFixedShelves([
      ...fixedShelves,
      { from: chosen, fromShelf: null, ...defaultShelfFaces(chosen), offsetMm: String(offset), columnIndex, ...bay },
    ])
  }

  const remapZonesForNewPartition = (alreadyCount: number) => {
    if (alreadyCount === 0) {
      if (fixedShelves.length > 0) {
        setZoneUi((z) => ({
          ...z,
          'c0-bottom': zoneOf(z, 'bottom'),
          'c0-middle': zoneOf(z, 'middle'),
          'c0-top': zoneOf(z, 'top'),
          'c1-bottom': emptyZoneUi(),
          'c1-middle': emptyZoneUi(),
          'c1-top': emptyZoneUi(),
        }))
      } else {
        setZoneUi({
          ...zoneUi,
          c0: {
            ...emptyZoneUi(),
            shelfCount,
            movableShelves,
            clothesRails,
            hasClothesRail: clothesRails.length > 0,
          },
          c1: emptyZoneUi(),
        })
        setDoorSpan(doorCount > 0 ? 'full' : 'zones')
        setShelfCount(0)
        setMovableShelves([])
        setClothesRails([])
      }
      return
    }
    const nextCol = alreadyCount + 1
    if (fixedShelves.some((s) => s.columnIndex == null)) {
      setZoneUi((z) => ({
        ...z,
        [`c${nextCol}-bottom`]: emptyZoneUi(),
        [`c${nextCol}-middle`]: emptyZoneUi(),
        [`c${nextCol}-top`]: emptyZoneUi(),
      }))
    } else {
      setZoneUi((z) => ({ ...z, [`c${nextCol}`]: emptyZoneUi() }))
    }
  }

  const addMiddlePartition = (gapIndex?: number, stopsAtShelf?: number | null, startsAtShelf?: number | null) => {
    if (partitions.length >= MAX_PARTITIONS) return
    if (stopsAtShelf == null && startsAtShelf == null) remapZonesForNewPartition(partitions.length)
    const parentPath =
      stopsAtShelf == null && startsAtShelf == null && layout.columns.length > 1
        ? layout.columns[gapIndex ?? 0]?.path ?? ''
        : ''
    setPendingAdd(null)
    setEvenPartitionError(null)
    setPartitions((rows) =>
      rows.length >= MAX_PARTITIONS
        ? rows
        : [
            ...rows,
            {
              ...newMiddlePartition(gapIndex, stopsAtShelf, parentPath),
              ...(startsAtShelf != null ? { startsAtShelf } : {}),
            },
          ],
    )
  }

  const shiftZonesAfterEvenSplit = (columnIndex: number, columnShift: number) => {
    if (columnShift === 0) return
    const hasColumnZones = Object.keys(zoneUi).some((id) => /^c\d+/.test(id))
    if (!hasColumnZones) {
      if (fixedShelves.length > 0) {
        setZoneUi((z) => {
          const next: Record<string, ZoneUi> = {
            ...z,
            'c0-bottom': zoneOf(z, 'bottom'),
            'c0-middle': zoneOf(z, 'middle'),
            'c0-top': zoneOf(z, 'top'),
          }
          for (let col = 1; col <= columnShift; col++) {
            next[`c${col}-bottom`] = emptyZoneUi()
            next[`c${col}-middle`] = emptyZoneUi()
            next[`c${col}-top`] = emptyZoneUi()
          }
          return next
        })
      } else {
        setZoneUi({
          ...zoneUi,
          c0: {
            ...emptyZoneUi(),
            shelfCount,
            movableShelves,
            clothesRails,
            hasClothesRail: clothesRails.length > 0,
          },
          ...Object.fromEntries(
            Array.from({ length: columnShift }, (_, i) => [`c${i + 1}`, emptyZoneUi()]),
          ),
        })
        setDoorSpan(doorCount > 0 ? 'full' : 'zones')
        setShelfCount(0)
        setMovableShelves([])
        setClothesRails([])
      }
      return
    }
    const shelfRows = fixedShelves.some((s) => s.columnIndex == null)
    setZoneUi((z) => {
      const next: Record<string, ZoneUi> = { ...z }
      const entries = Object.entries(z).flatMap(([id, value]) => {
        const match = /^c(\d+)(-.*)?$/.exec(id)
        if (!match || !value) return []
        return [{ id, col: Number(match[1]), rest: match[2] ?? '', value }]
      })
      entries.sort((a, b) => (columnShift > 0 ? b.col - a.col : a.col - b.col))
      for (const item of entries) {
        if (item.col <= columnIndex) continue
        const newId = `c${item.col + columnShift}${item.rest}`
        next[newId] = item.value
        if (newId !== item.id) delete next[item.id]
      }
      if (columnShift > 0) {
        for (let i = 1; i <= columnShift; i++) {
          const col = columnIndex + i
          if (shelfRows) {
            next[`c${col}-bottom`] = emptyZoneUi()
            next[`c${col}-middle`] = emptyZoneUi()
            next[`c${col}-top`] = emptyZoneUi()
          } else {
            next[`c${col}`] = emptyZoneUi()
          }
        }
      }
      return next
    })
    setFixedShelves((rows) =>
      rows.map((row) =>
        row.columnIndex != null && row.columnIndex > columnIndex
          ? { ...row, columnIndex: row.columnIndex + columnShift }
          : row,
      ),
    )
  }

  const applyEvenPartitions = (columnIndex: number, parts: number) => {
    const bay = layout.columns[columnIndex]
    if (!bay) return
    const specs = partitions.map((row) => ({
      from: row.from,
      fromPartition: row.from === 'middle' ? null : row.fromPartition,
      fromFace: row.fromFace,
      toFace: row.toFace,
      offsetMm: row.from === 'middle' ? 0 : mmNum(row.offsetMm),
      ...(row.from === 'middle' && row.gapIndex != null ? { gapIndex: row.gapIndex } : {}),
      ...(row.stopsAtShelf != null ? { stopsAtShelf: row.stopsAtShelf } : {}),
      ...(row.startsAtShelf != null ? { startsAtShelf: row.startsAtShelf } : {}),
      ...(row.splitsPath ? { splitsPath: row.splitsPath } : {}),
    }))
    const result = evenBayDividerSpecs(
      specs,
      layout.partitions,
      bay.x0,
      bay.x1,
      parts,
      params.thickness,
      columnIndex,
      shelfStopForColumn(columnIndex)?.specIndex,
      bay.path,
    )
    if (result.error) {
      setEvenPartitionError(result.error)
      return
    }
    shiftZonesAfterEvenSplit(columnIndex, result.columnShift)
    setPartitions(
      result.specs.map((spec) => {
        const ui = partitionToUi(spec)
        if (spec.from !== 'middle') ui.offsetMm = evenOffsetField(spec.offsetMm)
        return ui
      }),
    )
    setEvenPartitionError(null)
    setPendingAdd(null)
  }

  const measuredPartitionOffset = (r: PartitionUi): string => {
    if (r.from !== 'middle' && mmNum(r.offsetMm) > 0) return r.offsetMm
    return String(defaultPartitionOffsetMm(innerW, params.thickness, Math.max(0, partitions.length - 1)))
  }

  const centerPartitionInCurrentBay = (specIndex: number, currentRow?: PartitionUi): PartitionUi => {
    const prior = layout.partitions.filter((p) => p.specIndex < specIndex)
    const openings = partitionGapOpenings(prior, innerW)
    const current = layout.partitions.find((p) => p.specIndex === specIndex)
    const partial = layout.partialPartitions.find((p) => p.specIndex === specIndex)
    let gi = partial?.columnIndex ?? 0
    if (current && openings.length > 0) {
      const mid = (current.xLeft + current.xRight) / 2
      const found = openings.findIndex((o) => mid >= o.start && mid <= o.end)
      gi = found >= 0 ? found : 0
    }
    return {
      ...newMiddlePartition(gi, currentRow?.stopsAtShelf, currentRow?.splitsPath),
      ...(currentRow?.stopsAtShelf != null ? { stopsAtShelf: currentRow.stopsAtShelf } : {}),
      ...(currentRow?.startsAtShelf != null ? { startsAtShelf: currentRow.startsAtShelf } : {}),
    }
  }

  const addPinShelfRows = (
    innerHMm: number,
    rows: MovableShelfUi[],
    evenCount: number,
    middle = false,
    gapIndex?: number,
    opening?: { start: number; end: number },
    resolved: { from: string; yBottom: number; yTop: number }[] = [],
  ): MovableShelfUi[] => {
    const current = displayedMovable(rows, evenCount, innerHMm, params.thickness)
    if (current.length >= MAX_SHELVES) return current
    if (middle) return [...current, newMiddlePinShelf(gapIndex)]
    if (current.length === 0) {
      const span = opening ? opening.end - opening.start : innerHMm
      return [...current, newMovableShelf(span, params.thickness, 0, opening ? gapIndex : undefined)]
    }
    return [...current, shelfFromExisting(current.length, resolved, opening, innerHMm, params.thickness)]
  }

  const addCabinetPinShelf = (middle = false, gapIndex?: number, opening?: { start: number; end: number }) => {
    const next = addPinShelfRows(
      innerH,
      movableShelves,
      shelfCount,
      middle,
      gapIndex,
      opening,
      layout.zones[0]?.movable ?? [],
    )
    setMovableShelves(next)
    setShelfCount(next.length)
  }

  const applyPending = (target: FrontTarget) => {
    if (!pendingAdd) return
    if (pendingAdd.kind === 'partition-middle') {
      const above = /^part-above:(\d+):(\d+)$/.exec(target)
      if (above) {
        addMiddlePartition(Number(above[1]), null, Number(above[2]))
        return
      }
      const below = /^part-below:(\d+):(\d+)$/.exec(target)
      if (below) {
        addMiddlePartition(Number(below[1]), Number(below[2]))
        return
      }
      const m = /^part-gap:(\d+)$/.exec(target)
      addMiddlePartition(m ? Number(m[1]) : 0)
      return
    }
    if (pendingAdd.kind === 'partition-even') {
      const side = /^part-even-side:(\d+)$/.exec(target)
      if (side) {
        setEvenPartitionError(null)
        setPendingAdd({ kind: 'partition-even', column: Number(side[1]) })
        return
      }
      const count = /^part-even-count:(\d+)$/.exec(target)
      if (count && pendingAdd.column != null) applyEvenPartitions(pendingAdd.column, Number(count[1]))
      return
    }
    if (pendingAdd.kind === 'fixed-shelf') {
      const zoneTarget = /^shelf-zone:(.+)$/.exec(target)
      if (zoneTarget) {
        const zone = layout.zones.find((row) => row.id === zoneTarget[1])
        if (!zone) return
        const path = zone.path || undefined
        const opening = shelfBand(zone.label)
        if (pendingAdd.middle) addFixedShelf(zone.colIndex, 'middle', path, opening)
        else addFixedShelf(zone.colIndex, undefined, path, opening)
        return
      }
      const column = target === 'full' ? null : Number.parseInt(/^c(\d+)/.exec(target)?.[1] ?? '', 10) || 0
      if (pendingAdd.middle) {
        addFixedShelf(column, 'middle')
        return
      }
      const origin = parseFixedOriginTarget(target)
      if (origin) {
        addFixedShelf(origin.columnIndex, origin.origin)
        return
      }
      addFixedShelf(column)
      return
    }
    if (pendingAdd.kind === 'shelf') {
      const middle = pendingAdd.middle === true
      const shelfOrigin = !middle ? parseShelfOriginTarget(target) : null
      if (shelfOrigin) {
        const zone = layout.zones.find((row) => row.id === shelfOrigin.zoneId)
        if (zone) {
          setZoneUi((z) => {
            const cur = zoneOf(z, zone.id)
            const rows = displayedMovable(cur.movableShelves, cur.shelfCount, zone.innerH, params.thickness)
            const nextRows = [
              ...rows,
              shelfFromChosenOrigin(shelfOrigin.origin),
            ]
            return { ...z, [zone.id]: { ...cur, movableShelves: nextRows, shelfCount: nextRows.length } }
          })
        }
        setPendingAdd(null)
        return
      }
      const pinGap = parsePinGapTarget(target)
      if (pinGap) {
        const openings = pinGap.zoneId
          ? zoneHeightOpenings(layout.zones.find((row) => row.id === pinGap.zoneId) ?? {
              innerH,
              y0: 0,
              movable: [],
              rails: [],
            })
          : cabinetPinOpenings
        const gap = openings.find((o) => o.index === pinGap.gapIndex)
        const zone = pinGap.zoneId ? layout.zones.find((row) => row.id === pinGap.zoneId) : layout.zones[0]
        const zoneH = zone?.innerH ?? innerH
        const opening = partialOpening(gap, zoneH)
        if (pinGap.zoneId) {
          setZoneUi((z) => {
            const cur = zoneOf(z, pinGap.zoneId!)
            const nextRows = addPinShelfRows(
              zoneH,
              cur.movableShelves,
              cur.shelfCount,
              middle,
              pinGap.gapIndex,
              opening,
              zone?.movable ?? [],
            )
            return { ...z, [pinGap.zoneId!]: { ...cur, movableShelves: nextRows, shelfCount: nextRows.length } }
          })
        } else {
          addCabinetPinShelf(middle, pinGap.gapIndex, opening)
        }
        setPendingAdd(null)
        return
      }
      const between = parseBetweenTarget(target)
      const zoneId = between
        ? zoneForBetweenPair(layout.zones, between.colIndex, between.pairIndex)?.id
        : target === 'full'
          ? undefined
          : target
      if (target === 'full' && !between) {
        setZoneUi((z) => {
          const next = { ...z }
          for (const zone of layout.zones) {
            const cur = zoneOf(next, zone.id)
            const nextRows = addPinShelfRows(
              zone.innerH,
              cur.movableShelves,
              cur.shelfCount,
              middle,
              undefined,
              undefined,
              zone.movable,
            )
            next[zone.id] = { ...cur, movableShelves: nextRows, shelfCount: nextRows.length }
          }
          return next
        })
      } else if (zoneId) {
        const zone = layout.zones.find((row) => row.id === zoneId)
        const zoneH = zone?.innerH ?? innerH
        const openings =
          middle && zone ? placeableHeightOpenings(zoneHeightOpenings(zone), params.thickness) : []
        const only = openings[0]
        const fullHeight = !only || (only.start <= 0.5 && only.end >= zoneH - 0.5)
        const gi = middle && !fullHeight ? only?.index : undefined
        const opening = middle ? partialOpening(only, zoneH) : undefined
        setZoneUi((z) => {
          const cur = zoneOf(z, zoneId)
          const nextRows = addPinShelfRows(
            zoneH,
            cur.movableShelves,
            cur.shelfCount,
            middle,
            gi,
            opening,
            zone?.movable ?? [],
          )
          return { ...z, [zoneId]: { ...cur, movableShelves: nextRows, shelfCount: nextRows.length } }
        })
      }
    } else if (pendingAdd.kind === 'drawer') {
      if (target === 'full') {
        const hasDoor = isSlidingCabinet ? false : !hasSplit || doorSpan === 'full' ? doorCount > 0 : false
        setDrawerFrontHeights((rows) =>
          hasDoor
            ? [...rows, String(DEFAULT_DRAWER_FRONT_HEIGHT)]
            : filledDrawerRows(drawerFrontH, rows.length + 1, false, drawerBottomGap),
        )
      } else {
        const cur = zoneOf(zoneUi, target)
        // This opening is full; the others may still take one.
        if (cur.drawerFrontHeights.length >= MAX_DRAWERS) {
          setPendingAdd(null)
          return
        }
        const hasDoor = isSlidingCabinet ? false : doorSpan === 'zones' && cur.doorCount > 0
        const zone = layout.zones.find((z) => z.id === target)
        const n = cur.drawerFrontHeights.length + 1
        const hang = zone != null && zoneInVanityKnee(zone, kneeOpening)
        if (zone && !hasDoor && !hang) {
          patchZone(target, {
            drawerFrontHeights: filledDrawerRows(
              zoneStackOpeningHeight(zone, innerDrawerFronts, innerDoors),
              n,
              false,
              zone.y0 <= 0.5 ? drawerBottomGap : 0,
            ),
          })
        } else {
          patchZone(target, {
            drawerFrontHeights: [...cur.drawerFrontHeights, String(DEFAULT_DRAWER_FRONT_HEIGHT)],
          })
        }
      }
    } else if (pendingAdd.kind === 'door') {
      if (target === 'full') {
        setDoorSpan('full')
        setDoorCount(pendingAdd.count)
        clearZoneDoors()
      } else {
        setDoorSpan('zones')
        setDoorCount(0)
        patchZone(target, { doorCount: pendingAdd.count })
      }
    } else if (pendingAdd.kind === 'rail') {
      const middle = pendingAdd.middle === true
      const railGap = parseRailGapTarget(target)
      const pushRail = (id: CabinetZoneId, gapIndex?: number) => {
        const cur = zoneOf(zoneUi, id)
        if (cur.clothesRails.length >= MAX_CLOTHES_RAILS) return cur
        const zone = layout.zones.find((z) => z.id === id)
        const nextRails = [
          ...cur.clothesRails,
          middle
            ? newMiddleRail(gapIndex)
            : newClothesRail(zone?.innerH ?? innerH, cur.clothesRails.length, gapIndex),
        ]
        return { ...cur, clothesRails: nextRails, hasClothesRail: true }
      }
      const defaultGapForZone = (id: CabinetZoneId): number | undefined => {
        const zone = layout.zones.find((z) => z.id === id)
        if (!zone) return undefined
        const cur = zoneOf(zoneUi, id)
        const rows = displayedMovable(cur.movableShelves, cur.shelfCount, zone.innerH, params.thickness)
        const openings = remainingShelfOpenings(
          rowsToSpecs(rows),
          zone.innerH,
          params.thickness,
          cur.shelfCount,
        )
        return largestOpeningIndex(openings)
      }
      if (railGap) {
        if (railGap.zoneId) {
          patchZone(railGap.zoneId, pushRail(railGap.zoneId, railGap.gapIndex))
        } else {
          setClothesRails((rows) =>
            rows.length >= MAX_CLOTHES_RAILS
              ? rows
              : [
                  ...rows,
                  middle
                    ? newMiddleRail(railGap.gapIndex)
                    : newClothesRail(innerH, rows.length, railGap.gapIndex),
                ],
          )
        }
      } else if (target === 'full') {
        setZoneUi((z) => {
          const next = { ...z }
          for (const zone of layout.zones) {
            next[zone.id] = pushRail(zone.id, defaultGapForZone(zone.id))
          }
          return next
        })
      } else {
        patchZone(target, pushRail(target, defaultGapForZone(target)))
      }
    } else if (pendingAdd.kind === 'rail-even') {
      const placeIn = (id: CabinetZoneId) => {
        const zone = layout.zones.find((z) => z.id === id)
        const cur = zoneOf(zoneUi, id)
        if (!zone) return cur
        const shelfRows = displayedMovable(cur.movableShelves, cur.shelfCount, zone.innerH, params.thickness)
        const openings = remainingShelfOpenings(
          rowsToSpecs(shelfRows),
          zone.innerH,
          params.thickness,
          cur.shelfCount,
        )
        const nextRails = placeEvenLowerRails(
          cur.clothesRails,
          openings,
          zone.innerH,
          zone.y0 <= 0.5 ? floorDropMm : 0,
        )
        return { ...cur, clothesRails: nextRails, hasClothesRail: nextRails.length > 0 }
      }
      if (target === 'full') {
        setZoneUi((z) => {
          const next = { ...z }
          for (const zone of layout.zones) next[zone.id] = placeIn(zone.id)
          return next
        })
      } else {
        patchZone(target, placeIn(target))
      }
    }
    setPendingAdd(null)
  }

  // At most MAX_DRAWERS drawers in one opening, not in the whole cabinet: a vanity with a middle
  // drawer, four on the left and more on the right is fine.
  const drawerRoomLeft =
    drawerFrontHeights.length < MAX_DRAWERS ||
    (hasSplit && !layout.error && layout.zones.some((z) => zoneOf(zoneUi, z.id).drawerFrontHeights.length < MAX_DRAWERS))
  const startAdd = (next: PendingAdd) => {
    if (next.kind === 'rail-even') {
      if (hasSplit && !layout.error) {
        setPendingAdd(next)
        return
      }
      setClothesRails((rows) => placeEvenLowerRails(rows, cabinetRailOpenings, innerH, floorDropMm))
      return
    }
    if (next.kind === 'shelf') {
      if (hasSplit && !layout.error) {
        setPendingAdd(next)
        return
      }
      if (next.middle && cabinetPlaceablePinOpenings.length > 1) {
        setPendingAdd(next)
        return
      }
      addCabinetPinShelf(next.middle === true)
      return
    }
    if (hasSplit && !layout.error) {
      setPendingAdd(next)
      return
    }
    if (next.kind === 'drawer') {
      setDrawerFrontHeights((rows) =>
        !isSlidingCabinet && doorCount > 0
          ? [...rows, String(DEFAULT_DRAWER_FRONT_HEIGHT)]
          : filledDrawerRows(drawerFrontH, rows.length + 1, false, drawerBottomGap),
      )
    }
    else if (next.kind === 'door') setDoorCount(next.count)
    else if (next.kind === 'rail') {
      if (cabinetRailOpenings.length > 1) {
        setPendingAdd(next)
        return
      }
      setClothesRails((rows) =>
        rows.length >= MAX_CLOTHES_RAILS
          ? rows
          : [...rows, next.middle ? newMiddleRail() : newClothesRail(innerH, rows.length)],
      )
    }
  }

  const parseDrawerRows = (rows: string[]) =>
    rows.map((s) => parseInt(s, 10) || 0).filter((n) => n > 0)

  const fullDrawerHasDoor = isSlidingCabinet ? false : !hasSplit || doorSpan === 'full' ? doorCount > 0 : false
  const fullDrawerNums = parseDrawerRows(drawerFrontHeights)
  const canEqualizeFull =
    fullDrawerNums.length >= 1 && !fullDrawerHasDoor && !drawerFrontsAreEven(drawerFrontH, fullDrawerNums, drawerBottomGap)
  const zoneEqualizeIds = hasSplit
    ? layout.zones
        .filter((z) => {
          const heights = parseDrawerRows(zoneOf(zoneUi, z.id).drawerFrontHeights)
          const hasDoor = isSlidingCabinet ? false : doorSpan === 'zones' && zoneOf(zoneUi, z.id).doorCount > 0
          return (
            heights.length >= 1 &&
            !hasDoor &&
            !drawerFrontsAreEven(
              zoneStackOpeningHeight(z, innerDrawerFronts, innerDoors),
              heights,
              z.y0 <= 0.5 ? drawerBottomGap : 0,
            )
          )
        })
        .map((z) => z.id)
    : []
  const canEqualizeDrawers = canEqualizeFull || zoneEqualizeIds.length > 0
  const adjacentCombine = hasSplit && canCombineAdjacentZoneFronts(layout.zones)
  const showCombineFronts =
    !effectiveExternalDoors &&
    (canCombineFronts(
      fullDrawerNums.length,
      innerDrawerFronts !== innerDoors ? 0 : fullDrawerHasDoor ? doorCount : 0,
    ) ||
      (hasSplit &&
        layout.zones.some((z) =>
          canCombineFronts(
            parseDrawerRows(zoneOf(zoneUi, z.id).drawerFrontHeights).length,
            innerDrawerFronts !== innerDoors
              ? 0
              : doorSpan === 'zones'
                ? zoneOf(zoneUi, z.id).doorCount
                : 0,
          ),
        )) ||
      adjacentCombine)

  const equalizeDrawers = () => {
    if (canEqualizeFull) {
      setDrawerFrontHeights(equalDrawerFrontHeights(drawerFrontH, fullDrawerNums.length, drawerBottomGap).map(String))
    }
    if (zoneEqualizeIds.length > 0) {
      setZoneUi((z) => {
        const next = { ...z }
        for (const id of zoneEqualizeIds) {
          const zone = layout.zones.find((row) => row.id === id)
          if (!zone) continue
          const cur = zoneOf(next, id)
          const n = parseDrawerRows(cur.drawerFrontHeights).length
          next[id] = {
            ...cur,
            drawerFrontHeights: equalDrawerFrontHeights(
              zoneStackOpeningHeight(zone, innerDrawerFronts, innerDoors),
              n,
              zone.y0 <= 0.5 ? drawerBottomGap : 0,
            ).map(String),
          }
        }
        return next
      })
    }
  }

  const splitEqualBays = (count: 2 | 3) => {
    if (count === 3) {
      const plan = threeDoorPartitionOffsets(innerW, params.thickness, [], innerDrawerFronts, 'equal')
      if (plan.offsets) applySlidingBays(plan.offsets)
      return
    }
    applySlidingBays([(innerW - params.thickness) / 2])
  }

  const applySlidingBays = (offsets: number[]) => {
    if (partitions.length === 0) {
      setZoneUi({
        ...zoneUi,
        c0: {
          ...emptyZoneUi(),
          shelfCount,
          movableShelves,
          clothesRails,
          hasClothesRail: clothesRails.length > 0,
          drawerFrontHeights,
        },
        c1: emptyZoneUi(),
        c2: emptyZoneUi(),
      })
      setShelfCount(0)
      setMovableShelves([])
      setClothesRails([])
      setDrawerFrontHeights([])
    }
    setPartitions(
      offsets.map((off) => ({
        from: 'left' as const,
        fromPartition: null,
        fromFace: 'right' as const,
        toFace: 'left' as const,
        offsetMm: String(off),
      })),
    )
  }

  const [copiedForClaude, setCopiedForClaude] = useState(false)
  /**
   * The cabinet as text to paste into a chat with Claude: its type and settings (enough to build
   * it again exactly), plus the parts, hardware and assembly steps as they come out now.
   */
  const copyForClaude = async () => {
    const data = {
      sketchcut: 1,
      name: editing?.name ?? null,
      typeId,
      quantity: qty,
      params,
      panels: (result?.panels ?? []).map((panel) => ({
        name: panel.name,
        role: panel.role,
        w: panel.width,
        h: panel.height,
        qty: panel.quantity,
        edges: panel.edges,
        ...(panel.note ? { note: panel.note } : {}),
        ...(panel.excludeFromCutting ? { excludeFromCutting: true } : {}),
      })),
      hardware: (result?.hardware ?? []).map((item) => ({ name: item.name, qty: item.quantity, ...(item.note ? { note: item.note } : {}) })),
      assemblySteps: (result?.labor.assemblySteps ?? []).map((step) => ({ id: step.id, label: step.label, minutes: step.minutes })),
      notes: result?.notes ?? [],
    }
    const text = `Шкаф от SketchCut:\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\``
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      try {
        ok = document.execCommand('copy')
      } catch {
        // left as not copied
      }
      area.remove()
    }
    if (!ok) {
      window.alert('Не успях да копирам. Опитай пак или от друг браузър.')
      return
    }
    setCopiedForClaude(true)
    window.setTimeout(() => setCopiedForClaude(false), 2000)
  }

  const handleSave = () => {
    if (error) return
    onSave({ typeId, params: { ...params }, quantity: qty })
    onOpenChange(false)
  }

  const dialogBody = (
    <>
        <DialogHeader>
          <DialogTitle>
            {attached.length > 0 ? 'Комбинация' : isEdit ? 'Редактирай шкаф' : 'Добави шкаф'}
          </DialogTitle>
          <DialogDescription>
            {attached.length > 0
              ? 'Чертежът е общ. Промените по размери и всичко останало се записват върху оригиналните шкафове. Всеки от тях си остава отделен и се отваря сам.'
              : typeId === 'bed'
              ? 'Матракът плюс 50 мм е леглото. Дъното е отвън, плотът влиза между страниците.'
              : typeId === 'vanity'
              ? 'Седяща маса. Плотът минава над отвора за краката. Под отвора няма дъно и цокъл.'
              : typeId === 'nightstand'
              ? 'Размерите са външни в мм — плотът е пълната широчина и дълбочина. Детайлите и кантът се смятат автоматично.'
              : typeId === 'section'
                ? 'Размерите са външни в мм — плотът влиза между страниците. Детайлите и кантът се смятат автоматично.'
                : typeId === 'wardrobe'
                  ? 'Размерите са външни в мм — дъно с цокъл, плот между страниците, 2 плъзгащи врати.'
                : typeId === 'kitchen-wall'
                  ? 'Размерите са на корпуса в мм. Окачва се на стената. Детайлите и кантът се смятат автоматично.'
                  : 'Размерите са на корпуса в мм. Крачетата са отделно. Детайлите и кантът се смятат автоматично.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            Изглед
            <select
              className="h-8 rounded-md border border-[var(--color-border)] bg-transparent px-2"
              value={drawStyle === 'model' ? (assemblyFilm ? 'assembly' : withRoom ? 'room' : 'model') : drawStyle}
              aria-label="Изглед"
              onChange={(e) => {
                const next = e.target.value
                setAssemblyFilm(next === 'assembly')
                if (next === 'assembly') {
                  setDrawStyle('model')
                  return
                }
                if (next === 'room' || next === 'model') {
                  setDrawStyle('model')
                  changeWithRoom(next === 'room')
                  return
                }
                setDrawStyle(next === 'color' ? 'color' : 'line')
              }}
            >
              <option value="room">3D в стаята</option>
              <option value="model">3D само шкафа</option>
              <option value="assembly">Сглобяване (анимация)</option>
              <option value="color">Цветен</option>
              <option value="line">Чертеж</option>
            </select>
          </label>
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 text-sm"
            onClick={() => void copyForClaude()}
            title="Копира шкафа като текст, който да поставиш в чата с Claude"
          >
            {copiedForClaude ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
            {copiedForClaude ? 'Копирано' : 'Копирай за Claude'}
          </button>
          <label className="flex items-center gap-2 text-sm">
            Дръжка
            <select
              className="h-8 rounded-md border border-[var(--color-border)] bg-transparent px-2"
              value={!includeHandles || handleSku === 'none' ? 'none' : handleSku}
              aria-label="Дръжка"
              onChange={(event) => {
                const sku = parsePullSku(event.target.value)
                setHandleSku(sku)
                setIncludeHandles(sku !== 'none')
                setHandleOverrides({})
              }}
            >
              {PULL_CHOICES.map((choice) => (
                <option key={choice.sku} value={choice.sku}>
                  {choice.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            Врати
            <select
              className="h-8 rounded-md border border-[var(--color-border)] bg-transparent px-2"
              value={doorView}
              onChange={(e) => {
                const next = e.target.value === 'open' || e.target.value === 'closed' ? e.target.value : 'hidden'
                setDoorView(next)
                setShowFronts(next !== 'hidden')
              }}
            >
              <option value="hidden">Скрити</option>
              <option value="closed">Затворени</option>
              <option value="open">Отворени</option>
            </select>
          </label>
          {drawStyle === 'line' && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={showDimLines}
                onCheckedChange={(c) => setShowDimLines(c === true)}
              />
              Оразмерителни линии
            </label>
          )}
          {drawStyle !== 'color' && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={showOpeningDims}
                onCheckedChange={(c) => setShowOpeningDims(c === true)}
              />
              Оставащи размери
            </label>
          )}
        </div>
        {drawStyle === 'line' && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center justify-between">
              <span>Шрифт на размерите</span>
              <span className="tabular-nums text-[var(--color-muted-foreground)]">
                {Math.round(dimFontScale * 100)}%
              </span>
            </span>
            <input
              type="range"
              min={DIM_FONT_SCALE_MIN * 100}
              max={DIM_FONT_SCALE_MAX * 100}
              step={5}
              value={Math.round(dimFontScale * 100)}
              onChange={(e) => setDimFontScale(parseDimFontScale(Number(e.target.value) / 100))}
              className="h-2 w-full cursor-pointer accent-[var(--color-primary)]"
              aria-label="Шрифт на размерите по чертежа"
            />
          </label>
        )}

        {showFronts && isSlidingCabinet && doorCount === 2 && nsMeasure && (
          <div className="rounded-md border border-[var(--color-border)] px-3 py-2 text-xs">
            <p className="font-medium">Размери на вратите</p>
            <ul className="mt-1 space-y-1">
              {layoutSlidingDoors({
                innerW: nsMeasure.innerW,
                innerH: nsMeasure.innerH,
                thickness: params.thickness,
                partitions: layout.partitions,
                edges: slidingDoorCount === 3 ? threeDoorSlidingEdges() : slidingEdges,
              }).map((leaf) => (
                <li key={leaf.index}>
                  <span className="font-medium">{leaf.name}:</span>{' '}
                  с кант дръжка {formatMm(leaf.gabaritW)} × {formatMm(leaf.gabaritH)} мм
                  {' · '}
                  без профилите {formatMm(leaf.cutW)} × {formatMm(leaf.cutH)} мм
                </li>
              ))}
            </ul>
          </div>
        )}

        {attachedGuests.length > 0 ? (
          <CabinetGroupView
            host={groupRole === 'guest' && peerDrafts?.host ? peerDrafts.host : { typeId, params }}
            guests={attachedGuests.map(({ row, cabinet }) => {
              const live = groupRole === 'guest' && editing?.id === cabinet.id
              const peer = peerDrafts?.[cabinet.id]
              const source = live ? { typeId, params } : peer ?? { typeId: cabinet.typeId, params: cabinet.params }
              return { typeId: source.typeId, params: source.params, place: row.place, spanDoor: row.spanDoor, spanDoorCount: row.spanDoorCount }
            })}
            showDimLines={showDimLines}
            showOpeningDims={showOpeningDims}
            showFronts={drawStyle === 'model' || doorView !== 'hidden'}
            drawStyle={drawStyle}
            doorView={doorView}
            carcassColor={finishFor(carcassFinishId)?.color}
            carcassImage={finishFor(carcassFinishId)?.image}
            frontColor={
              finishFor(frontFinishId || carcassFinishId)?.color
            }
            frontImage={
              finishFor(frontFinishId || carcassFinishId)?.image
            }
            finishes={settings.hardware.boardFinishes}
          />
        ) : (
        <BoardPickContext.Provider
          value={
            drawStyle === 'color'
              ? {
                  selected: pickedPiece,
                  onSelect: (id) => setPickedPiece(id),
                }
              : null
          }
        >
        {drawStyle === 'color' && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Кликни детайл на цветния изглед. Плочата се сменя само на него.
          </p>
          {pickedPiece && !pickedPiece.startsWith('back') && (
            <label className="flex items-center gap-2 text-sm">
              {pieceColorLabel(pickedPiece)}
              <select
                aria-label={`Плоча ${pieceColorLabel(pickedPiece)}`}
                value={pieceFinishes[pickedPiece] ?? ''}
                onChange={(e) => {
                  const id = e.target.value
                  rememberKronospan(id)
                  setPieceFinishes((current) => {
                    if (!id) {
                      const next = { ...current }
                      delete next[pickedPiece]
                      return next
                    }
                    return { ...current, [pickedPiece]: id }
                  })
                }}
                className="h-8 rounded-md border border-[var(--color-border)] bg-transparent px-2"
              >
                <option value="">Както останалите</option>
                <KronospanFinishOptions finishes={settings.hardware.boardFinishes} />
              </select>
            </label>
          )}
        </div>
        )}
        <CabinetPreview
          typeId={typeId}
          params={{ ...params }}
          onPullChange={(key, sku) => setHandleOverrides((prev) => ({ ...prev, [key]: sku }))}
          showDimLines={showDimLines}
          showOpeningDims={showOpeningDims}
          showFronts={drawStyle === 'model' || doorView !== 'hidden'}
          drawStyle={drawStyle}
          doorView={doorView}
          carcassColor={finishFor(carcassFinishId)?.color}
          carcassImage={finishFor(carcassFinishId)?.image}
          frontColor={
            finishFor(frontFinishId || carcassFinishId)?.color
          }
          frontImage={
            finishFor(frontFinishId || carcassFinishId)?.image
          }
          finishes={settings.hardware.boardFinishes}
        />
        </BoardPickContext.Provider>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cab-type">Тип</Label>
            <select
              id="cab-type"
              className={selectClass}
              value={typeId}
              onChange={(e) => {
                const id = e.target.value
                setTypeId(id)
                setShelfFrontInset(String(shelfFrontInsetMm({ doorStyle: id === 'wardrobe' ? 'sliding' : 'hinged' })))
                if (id === 'bed') {
                  const d = DEFAULT_BED_PARAMS
                  setBedMattressLength(String(d.mattressLength))
                  setBedMattressWidth(String(d.mattressWidth))
                  setBedSideHeight(String(d.sideHeight))
                  setBedLift(false)
                  setBedLiftDampers(true)
                  setBedHeadboard(false)
                  setBedHeadboardHeight(String(d.headboardHeight))
                  setThickness(String(d.thickness))
                  setDoorCount(0)
                  setDrawerFrontHeights([])
                  setShelfCount(0)
                  setHasBack(false)
                } else if (id === 'vanity') {
                  const d = DEFAULT_VANITY_PARAMS
                  const opening = vanityOpening(d)
                  setWidth(String(d.width))
                  setHeight(String(d.height))
                  setDepth(String(d.depth))
                  setThickness(String(d.thickness))
                  setUseLegs(false)
                  setPlinthCount(d.plinthCount)
                  setPlinthHeight(String(d.plinthHeight))
                  setLegHeight(d.legHeight)
                  setTopStyle('panel')
                  setShelfCount(0)
                  setMovableShelves([])
                  setHasBack(true)
                  setClothesRails([])
                  setDoorCount(0)
                  setDoorStyle('hinged')
                  setSlidingEdges(defaultSlidingEdges(2))
                  setDrawerFrontHeights([])
                  setCutFromOneBoard(false)
                  setIncludeHandles(true)
                  setFixedShelves([])
                  setKnee(d.knee)
                  setKneeWidth(String(d.kneeWidth))
                  setLegSide('none')
                  setBackRailHeight(String(d.backRailHeight))
                  setPartitions(opening ? opening.dividers.map(partitionToUi) : [])
                  setDoorSpan('full')
                  setZoneUi({ bottom: emptyZoneUi(), middle: emptyZoneUi(), top: emptyZoneUi() })
                } else if (id === 'nightstand') {
                  setWidth(String(DEFAULT_NIGHTSTAND_PARAMS.width))
                  setHeight(String(DEFAULT_NIGHTSTAND_PARAMS.height))
                  setDepth(String(DEFAULT_NIGHTSTAND_PARAMS.depth))
                  setThickness(String(DEFAULT_NIGHTSTAND_PARAMS.thickness))
                  setUseLegs(false)
                  setPlinthCount(DEFAULT_NIGHTSTAND_PARAMS.plinthCount)
                  setPlinthHeight(String(DEFAULT_NIGHTSTAND_PARAMS.plinthHeight))
                  setLegHeight(DEFAULT_NIGHTSTAND_PARAMS.legHeight)
                  setTopStyle('panel')
                  setShelfCount(0)
                  setMovableShelves([])
                  setHasBack(false)
                  setClothesRails([])
                  setDoorCount(0)
                  setDoorStyle('hinged')
                  setSlidingEdges(defaultSlidingEdges(2))
                  setDrawerFrontHeights([])
                  setCutFromOneBoard(false)
                  setIncludeHandles(true)
                  setFixedShelves([])
                  setDoorSpan('full')
                  setZoneUi({ bottom: emptyZoneUi(), middle: emptyZoneUi(), top: emptyZoneUi() })
                } else if (id === 'section') {
                  setWidth(String(DEFAULT_SECTION_PARAMS.width))
                  setHeight(String(DEFAULT_SECTION_PARAMS.height))
                  setDepth(String(DEFAULT_SECTION_PARAMS.depth))
                  setThickness(String(DEFAULT_SECTION_PARAMS.thickness))
                  setUseLegs(false)
                  setPlinthCount(DEFAULT_SECTION_PARAMS.plinthCount)
                  setPlinthHeight(String(DEFAULT_SECTION_PARAMS.plinthHeight))
                  setTopStyle('panel')
                  setShelfCount(0)
                  setMovableShelves([])
                  setHasBack(false)
                  setClothesRails([])
                  setDoorCount(0)
                  setDoorStyle('hinged')
                  setSlidingEdges(defaultSlidingEdges(2))
                  setDrawerFrontHeights([])
                  setCutFromOneBoard(false)
                  setIncludeHandles(true)
                  setFixedShelves([])
                  setPartitions([])
                  setDoorSpan('full')
                  setZoneUi({ bottom: emptyZoneUi(), middle: emptyZoneUi(), top: emptyZoneUi() })
                } else if (id === 'wardrobe') {
                  const d = DEFAULT_WARDROBE_PARAMS
                  setWidth(String(d.width))
                  setHeight(String(d.height))
                  setDepth(String(d.depth))
                  setThickness(String(d.thickness))
                  setUseLegs(false)
                  setPlinthCount(d.plinthCount)
                  setPlinthHeight(String(d.plinthHeight))
                  setTopStyle('panel')
                  setShelfCount(0)
                  setMovableShelves([])
                  setHasBack(false)
                  setClothesRails([])
                  setDoorCount(2)
                  setDoorStyle('sliding')
                  setDepthMode((mode) => (mode === 'no-doors' ? 'without-door' : mode))
                  setSlidingEdges(defaultSlidingEdges(2))
                  setDrawerFrontHeights([])
                  setCutFromOneBoard(false)
                  setIncludeHandles(true)
                  setFixedShelves([])
                  setPartitions([])
                  setDoorSpan('full')
                  setZoneUi({ bottom: emptyZoneUi(), middle: emptyZoneUi(), top: emptyZoneUi() })
                } else if (id === 'kitchen-wall') {
                  setWidth(String(DEFAULT_KITCHEN_WALL_PARAMS.width))
                  setHeight(String(DEFAULT_KITCHEN_WALL_PARAMS.height))
                  setDepth(String(DEFAULT_KITCHEN_WALL_PARAMS.depth))
                  setThickness(String(DEFAULT_KITCHEN_WALL_PARAMS.thickness))
                  setHasBack(DEFAULT_KITCHEN_WALL_PARAMS.hasBack)
                  setClothesRails([])
                  setIncludeHandles(true)
                  setHasHood(false)
                  setHoodShape('round')
                  setHoodDiameter(String(DEFAULT_HOOD_DIAMETER_MM))
                  setHoodRectW(String(DEFAULT_HOOD_RECT_W_MM))
                  setHoodRectD(String(DEFAULT_HOOD_RECT_D_MM))
                  setShelfCount(0)
                  setMovableShelves([])
                  setDoorCount(0)
                  setDoorStyle('hinged')
                  setSlidingEdges(defaultSlidingEdges(2))
                  setDrawerFrontHeights([])
                  setCutFromOneBoard(false)
                  setFixedShelves([])
                  setDoorSpan('full')
                  setZoneUi({ bottom: emptyZoneUi(), middle: emptyZoneUi(), top: emptyZoneUi() })
                } else if (id === 'kitchen-base') {
                  setWidth(String(DEFAULT_KITCHEN_BASE_PARAMS.width))
                  setHeight(String(DEFAULT_KITCHEN_BASE_PARAMS.height))
                  setDepth(String(DEFAULT_KITCHEN_BASE_PARAMS.depth))
                  setThickness(String(DEFAULT_KITCHEN_BASE_PARAMS.thickness))
                  setHasBack(DEFAULT_KITCHEN_BASE_PARAMS.hasBack)
                  setTopStyle('rails')
                  setClothesRails([])
                  setIncludeHandles(true)
                  setDoorStyle('hinged')
                  setSlidingEdges(defaultSlidingEdges(2))
                  setFixedShelves([])
                  setDoorSpan('full')
                  setZoneUi({ bottom: emptyZoneUi(), middle: emptyZoneUi(), top: emptyZoneUi() })
                }
              }}
            >
              {CABINET_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {CABINET_TYPES.find((t) => t.id === typeId)?.description}
            </p>
            {isSlidingCabinet && depthMode !== 'no-doors' && (
              <div className="mt-2">
                <p className="text-xs font-medium">Страни</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={slidingBayMode === 'equal' ? 'default' : 'outline'}
                    onClick={() => {
                      setSlidingBayMode('equal')
                      splitEqualBays(slidingDoorCount)
                    }}
                  >
                    Равни страни
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={slidingBayMode === 'custom' ? 'default' : 'outline'}
                    onClick={() => setSlidingBayMode('custom')}
                  >
                    Нестандартен
                  </Button>
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  {slidingBayMode === 'equal'
                    ? 'Крайните страни са еднакви и следват вратата. Ако не излезе цяло число, на чертежа се пише със запетая. „Нагласи страните“ прави лявата и дясната еднакво широки, по размера за чекмеджето.'
                    : 'Лявата и дясната могат да са различни. „Нагласи страните“ мести само страната с чекмеджето. Другата си остава.'}
                </p>
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="cab-qty">Брой еднакви</Label>
            <DraftNumber id="cab-qty" inputMode="numeric" value={quantity} onCommit={(n) => setQuantity(String(n))} />
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Един шкаф, повторен толкова пъти в разкроя и цената. Например 10.
            </p>
          </div>
        </div>

        {typeId === 'bed' ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumField id="bed-len" label="Матрак дължина" value={bedMattressLength} onChange={setBedMattressLength} />
              <NumField id="bed-wid" label="Матрак широчина" value={bedMattressWidth} onChange={setBedMattressWidth} />
              <NumField id="bed-side" label="Височина на страниците" value={bedSideHeight} onChange={setBedSideHeight} />
              <NumField id="cab-t" label="Плоскост" value={thickness} onChange={setThickness} />
            </div>
            <BedOptions
              lift={bedLift}
              onLift={setBedLift}
              dampers={bedLiftDampers}
              onDampers={setBedLiftDampers}
              headboard={bedHeadboard}
              onHeadboard={setBedHeadboard}
              headHeight={bedHeadboardHeight}
              onHeadHeight={setBedHeadboardHeight}
              hint={bedHint(bedMattressLength, bedMattressWidth, bedSideHeight, thickness, bedHeadboard, bedHeadboardHeight)}
            />
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumField id="cab-w" label="Ширина" value={width} onChange={setWidth} />
            <NumField id="cab-h" label={typeId === 'kitchen-base' ? 'Височина корпус' : 'Височина'} value={height} onChange={setHeight} />
            <NumField id="cab-d" label="Дълбочина" value={depth} onChange={setDepth} />
            <NumField id="cab-t" label="Плоскост" value={thickness} onChange={setThickness} />
          </div>
        )}

        {typeId !== 'bed' && (
        <>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded border p-2">
          <span className="text-sm font-medium">Дълбочината е:</span>
          <div className="flex items-center gap-2">
            <Checkbox
              id="depth-without-door"
              checked={!slidingLocksDepth && depthMode === 'without-door'}
              disabled={slidingLocksDepth}
              onCheckedChange={(checked) => {
                if (!checked || slidingLocksDepth) return
                setDepthMode('without-door')
                alignShelfInset(typeId === 'wardrobe' || (typeId === 'section' && doorStyle === 'sliding'))
              }}
            />
            <Label htmlFor="depth-without-door" className={slidingLocksDepth ? 'text-sm font-normal opacity-50' : 'cursor-pointer text-sm font-normal'}>
              Без вратата
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="depth-with-door"
              checked={slidingLocksDepth || depthMode === 'with-door'}
              disabled={slidingLocksDepth}
              onCheckedChange={(checked) => {
                if (!checked || slidingLocksDepth) return
                setDepthMode('with-door')
                alignShelfInset(typeId === 'wardrobe' || (typeId === 'section' && doorStyle === 'sliding'))
              }}
            />
            <Label htmlFor="depth-with-door" className={slidingLocksDepth ? 'text-sm font-normal opacity-50' : 'cursor-pointer text-sm font-normal'}>
              Заедно с вратата
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cabinet-without-doors"
              checked={!slidingLocksDepth && depthMode === 'no-doors'}
              disabled={slidingLocksDepth}
              onCheckedChange={(checked) => {
                if (!checked || slidingLocksDepth) return
                setDepthMode('no-doors')
                alignShelfInset(false)
                setDoorCount(0)
                setDoorSpan('full')
                setPendingAdd(null)
                clearZoneDoors()
              }}
            />
            <Label htmlFor="cabinet-without-doors" className={slidingLocksDepth ? 'text-sm font-normal opacity-50' : 'cursor-pointer text-sm font-normal'}>
              Шкафът е без врати
            </Label>
          </div>
        </div>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {slidingLocksDepth && nsMeasure
            ? `Плъзгащи врати: ${formatMm(params.depth)} мм е заедно с механизма. Вътрешните страници са ${formatMm(nsMeasure.partitionD)} мм и почват ${SLIDING_PARTITION_SETBACK_MM} мм навътре.`
            : depthMode === 'no-doors'
            ? nsMeasure && nsMeasure.frontOverhang > 0
              ? `Шкафът е без врати. Наложеното чело държи страниците на ${formatMm(nsMeasure.sideD)} мм.`
              : `Шкафът е без врати. Страниците са ${formatMm(nsMeasure?.sideD ?? params.depth)} мм — пълната дълбочина.`
            : depthMode === 'with-door'
              ? nsMeasure && !nsMeasure.sliding
                ? `Заедно с вратата: страниците са ${formatMm(nsMeasure.sideD)} мм, с ${formatMm(nsMeasure.frontOverhang)} мм по-плитки.`
                : `Заедно с вратата: корпусът е ${formatMm(Math.max(params.thickness, params.depth - params.thickness - 2))} мм.`
              : nsMeasure && nsMeasure.frontOverhang > 0
                ? `Без вратата в размера, но има наложено чело: страниците са ${formatMm(nsMeasure.sideD)} мм.`
                : 'Без вратата: въведената дълбочина е на корпуса.'}
        </p>
        </>
        )}

        <CabinetSizeBadge
          width={params.width}
          height={params.height}
          depth={params.depth}
          settings={settings.assemblyTime}
          showInlineDetail
        />

        {hasFittings && (
          <>
            {typeId === 'kitchen-base' && (
            <FormSection defaultOpen={false} title="Крачета" summary={`${legHeight / 10} см`}>
              <div className="mt-1 flex gap-2">
                {([100, 150] as const).map((h) => (
                  <Button
                    key={h}
                    type="button"
                    size="sm"
                    variant={legHeight === h ? 'default' : 'outline'}
                    onClick={() => setLegHeight(h)}
                  >
                    {h / 10} см
                  </Button>
                ))}
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                От пода до върха: {(params as ReturnType<typeof parseKitchenBaseParams>).height + (params as ReturnType<typeof parseKitchenBaseParams>).legHeight} мм · 4 крачета
              </p>
            </FormSection>
            )}

            {typeId !== 'kitchen-wall' && (
            <FormSection defaultOpen={false}
              title="Горе"
              summary={
                topStyle === 'rails'
                  ? 'Две бленди'
                  : topStyle === 'none'
                    ? 'Без плот'
                    : topStyle === 'fascia'
                      ? 'Бленда надолу'
                      : 'Плот'
              }
            >
              <div className="mt-1 flex flex-wrap gap-2">
                {typeId === 'kitchen-base' ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={topStyle === 'rails' ? 'default' : 'outline'}
                      onClick={() => setTopStyle('rails')}
                    >
                      Две бленди
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={topStyle === 'none' ? 'default' : 'outline'}
                      onClick={() => setTopStyle('none')}
                    >
                      Без плот
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={topStyle === 'fascia' ? 'default' : 'outline'}
                      onClick={() => setTopStyle('fascia')}
                    >
                      Бленда надолу
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={topStyle === 'panel' ? 'default' : 'outline'}
                      onClick={() => setTopStyle('panel')}
                    >
                      Плот
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={topStyle === 'none' ? 'default' : 'outline'}
                      onClick={() => setTopStyle('none')}
                    >
                      Без плот
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={topStyle === 'fascia' ? 'default' : 'outline'}
                      onClick={() => setTopStyle('fascia')}
                    >
                      Бленда надолу
                    </Button>
                  </>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {topStyle === 'fascia'
                  ? `Бленда ${DEFAULT_RAIL_WIDTH} мм от горе надолу, ${FASCIA_SETBACK_MM} мм навътре от предния край. Обикновено шкаф за мивка.`
                  : topStyle === 'none'
                    ? 'Отворен корпус отгоре — без плот и без бленди.'
                    : topStyle === 'rails'
                      ? 'Предна и задна бленда между страниците, сочат назад.'
                      : typeId === 'section' || typeId === 'wardrobe'
                        ? 'Плотът влиза между страниците.'
                        : 'Плот върху страниците, хваща се с ъгълчета отвътре.'}
              </p>
            </FormSection>
            )}

            {typeId === 'kitchen-wall' && (
            <FormSection defaultOpen={false}
              title="Абсорбатор"
              summary={!hasHood ? 'Без' : hoodShape === 'round' ? 'Кръгъл отвор' : 'Правоъгълен отвор'}
            >
              <div className="mt-1 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={!hasHood ? 'default' : 'outline'}
                  onClick={() => setHasHood(false)}
                >
                  Без
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={hasHood && hoodShape === 'round' ? 'default' : 'outline'}
                  onClick={() => {
                    setHasHood(true)
                    setHoodShape('round')
                  }}
                >
                  Кръгъл отвор
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={hasHood && hoodShape === 'rect' ? 'default' : 'outline'}
                  onClick={() => {
                    setHasHood(true)
                    setHoodShape('rect')
                  }}
                >
                  Правоъгълен отвор
                </Button>
              </div>
              {hasHood && hoodShape === 'round' && (
                <>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {([120, 150] as const).map((d) => (
                      <Button
                        key={d}
                        type="button"
                        size="sm"
                        variant={parseInt(hoodDiameter, 10) === d ? 'default' : 'outline'}
                        onClick={() => setHoodDiameter(String(d))}
                      >
                        Ø{d}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-2 max-w-40">
                    <NumField id="hood-d" label="Диаметър мм" value={hoodDiameter} onChange={setHoodDiameter} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    Кръгъл отвор в средата на дъното. Същият отвор минава през рафтовете за въздуховода.
                  </p>
                </>
              )}
              {hasHood && hoodShape === 'rect' && (
                <>
                  <div className="mt-2 grid max-w-sm grid-cols-2 gap-3">
                    <NumField id="hood-rw" label="Широчина отвор" value={hoodRectW} onChange={setHoodRectW} />
                    <NumField id="hood-rd" label="Дълбочина отвор" value={hoodRectD} onChange={setHoodRectD} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    {([120, 150] as const).map((d) => (
                      <Button
                        key={d}
                        type="button"
                        size="sm"
                        variant={parseInt(hoodDiameter, 10) === d ? 'default' : 'outline'}
                        onClick={() => setHoodDiameter(String(d))}
                      >
                        Ø{d}
                      </Button>
                    ))}
                    <div className="max-w-36">
                      <NumField id="hood-duct" label="Въздуховод Ø" value={hoodDiameter} onChange={setHoodDiameter} />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    Правоъгълен отвор на дъното за абсорбатора. Рафтовете над него имат кръгъл отвор за въздуховода.
                  </p>
                </>
              )}
              {!hasHood && (
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Без отвор в дъното. Включи абсорбатор, ако въздуховодът минава през шкафа.
                </p>
              )}
            </FormSection>
            )}

            <FormSection defaultOpen={false}
              title="Фиксиран рафт"
              summary={fixedShelves.length > 0 ? `${fixedShelves.length} бр.` : 'няма'}
            >
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                Хваща се с винтове 5×60 през страниците и разделя частта. Дълбочината е същата като на
                подвижните рафтове — с {shelfInsetValue} мм по-плитък от{' '}
                {shelfFromPartition ? 'вътрешната страница' : 'страницата'} ({formatMm(shelfCutDepth)} мм). До 2
                рафта на част. Мери се от дъното, от плота или от вече добавен рафт. „По средата“ слага равни празнини
                над и под него. Следващият тръгва от последния.
                {layout.columns.length > 1 || shelfAsksByZone
                  ? ' След разделителна страница избираш страната. Маркираш 1.1 и после 1.2 — един рафт минава през двете, а страницата между тях остава само отдолу. Мястото над срязаното е Страна 1. Ако над него вече има рафт със Страна 1, горното става Страна 1 горе, а срязаното — Страна 1 долу.'
                  : ''}
              </p>
              {fixedShelves.map((shelf, i) => (
                <div key={i} className="mt-2 space-y-2 rounded-md border border-[var(--color-border)] p-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-28 shrink-0 text-xs">
                      Рафт {i + 1}
                      {layout.columns.length > 1 || shelf.bayPath || (shelf.spanPaths?.length ?? 0) >= 2
                        ? ` · ${
                            shelf.spanPaths && shelf.spanPaths.length >= 2
                              ? `Страна ${shelf.spanPaths.join(' и ')}`
                              : shelf.bayPath
                                ? `Страна ${shelf.bayPath}${shelf.opening === 'top' ? ' горе' : shelf.opening === 'bottom' ? ' долу' : ''}`
                              : shelf.columnIndex == null
                                ? FULL_CABINET_LABEL
                                : columnLabel(
                                    shelf.columnIndex,
                                    layout.columns.length,
                                    layout.columns[shelf.columnIndex]?.path,
                                  )
                          }`
                        : ''}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => commitFixedShelves(dropFixedShelf(fixedShelves, i))}
                      aria-label={`Премахни фиксиран рафт ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {(layout.columns.length > 1 || shelfAsksByZone) && (
                    <>
                      <p className="text-xs text-[var(--color-muted-foreground)]">В коя страна</p>
                      <div className="flex flex-wrap gap-2">
                        {shelfAsksByZone &&
                          layout.columns.map((_, c) => {
                            const others = fixedShelves.filter((row, j) => j !== i && !row.bayPath)
                            const selected =
                              shelf.columnIndex === c &&
                              !shelf.bayPath &&
                              !(shelf.spanPaths && shelf.spanPaths.length >= 2)
                            const taken = !canAddFixedShelfToColumn(others, c) && !selected
                            return (
                              <Button
                                key={`fs-side-${i}-${c}`}
                                type="button"
                                size="sm"
                                disabled={taken}
                                variant={selected ? 'default' : 'outline'}
                                onClick={() =>
                                  commitFixedShelves(
                                    fixedShelves.map((r, j) =>
                                      j === i
                                        ? {
                                            ...r,
                                            columnIndex: c,
                                            bayPath: undefined,
                                            opening: undefined,
                                            spanPaths: undefined,
                                          }
                                        : r,
                                    ),
                                  )
                                }
                              >
                                {columnLabel(c, layout.columns.length, layout.columns[c]?.path)}
                              </Button>
                            )
                          })}
                        {shelfAsksByZone
                          ? shelfTargetZones(layout.zones).map((zone) => {
                              const others = fixedShelves.filter((_, j) => j !== i)
                              const band = shelfBand(zone.label)
                              const inSpan = !band && shelf.spanPaths?.includes(zone.path) === true
                              const selected = band
                                ? shelf.bayPath === zone.path && shelf.opening === band
                                : inSpan ||
                                  (shelf.bayPath === zone.path &&
                                    !shelf.opening &&
                                    !(shelf.spanPaths && shelf.spanPaths.length >= 2))
                              const taken =
                                fixedShelfBayCount(others, zone.path) >= MAX_FIXED_SHELVES && !selected
                              return (
                                <Button
                                  key={`fs-zone-${i}-${zone.id}`}
                                  type="button"
                                  size="sm"
                                  disabled={taken}
                                  variant={selected ? 'default' : 'outline'}
                                  onClick={() => {
                                    if (band) {
                                      commitFixedShelves(
                                        fixedShelves.map((r, j) =>
                                          j === i
                                            ? {
                                                ...r,
                                                columnIndex: zone.colIndex,
                                                bayPath: zone.path,
                                                opening: band,
                                                spanPaths: undefined,
                                              }
                                            : r,
                                        ),
                                      )
                                      return
                                    }
                                    const now =
                                      shelf.spanPaths && shelf.spanPaths.length >= 2
                                        ? shelf.spanPaths
                                        : shelf.bayPath && !shelf.opening
                                          ? [shelf.bayPath]
                                          : []
                                    const next = markShelfSides(now, zone.path, layout.zones)
                                    const first = layout.zones.find((row) => row.path === next[0])
                                    commitFixedShelves(
                                      fixedShelves.map((r, j) =>
                                        j === i
                                          ? {
                                              ...r,
                                              columnIndex: first?.colIndex ?? zone.colIndex,
                                              bayPath: next.length >= 2 ? undefined : next[0],
                                              opening: undefined,
                                              spanPaths: next.length >= 2 ? next : undefined,
                                            }
                                          : r,
                                      ),
                                    )
                                  }}
                                >
                                  {zone.label.startsWith('Страна') ? zone.label : `Страна ${zone.path}`}
                                </Button>
                              )
                            })
                          : layout.columns.map((_, c) => {
                          const others = fixedShelves.filter((_, j) => j !== i)
                          const path = layout.columns[c]?.path ?? ''
                          const inSpan = path.length > 0 && shelf.spanPaths?.includes(path) === true
                          const selected =
                            inSpan ||
                            (shelf.columnIndex === c &&
                              !shelf.bayPath &&
                              !(shelf.spanPaths && shelf.spanPaths.length >= 2))
                          const taken = !canAddFixedShelfToColumn(others, c) && !selected
                          return (
                            <Button
                              key={`fs-col-${i}-${c}`}
                              type="button"
                              size="sm"
                              disabled={taken}
                              variant={selected ? 'default' : 'outline'}
                              onClick={() =>
                                commitFixedShelves(
                                  fixedShelves.map((r, j) =>
                                    j === i
                                      ? { ...r, columnIndex: c, bayPath: undefined, opening: undefined, spanPaths: undefined }
                                      : r,
                                  ),
                                )
                              }
                            >
                              {columnLabel(c, layout.columns.length, layout.columns[c]?.path)}
                            </Button>
                          )
                        })}
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            !canAddFixedShelfFull(
                              fixedShelves.filter((_, j) => j !== i),
                              layout.columns.length,
                            ) && shelf.columnIndex != null
                          }
                          variant={shelf.columnIndex == null ? 'default' : 'outline'}
                          onClick={() =>
                            commitFixedShelves(
                              fixedShelves.map((r, j) =>
                                j === i ? { ...r, columnIndex: null, bayPath: undefined, opening: undefined, spanPaths: undefined } : r,
                              ),
                            )
                          }
                        >
                          {FULL_CABINET_LABEL}
                        </Button>
                      </div>
                      {!shelfAsksByZone &&
                        continueSidePaths(
                          shelfSidePaths(shelf, layout.columns),
                          layout.columns.map((column) => column.path).filter((item) => item.length > 0),
                        ).map((path) => {
                          const ordered = layout.columns
                            .map((column) => column.path)
                            .filter((item) => item.length > 0)
                          const current = shelfSidePaths(shelf, layout.columns)
                          const next = [...current, path].sort(
                            (a, b) => ordered.indexOf(a) - ordered.indexOf(b),
                          )
                          const columnIndex = layout.columns.findIndex((column) => column.path === next[0])
                          const taken =
                            fixedShelfBayCount(
                              fixedShelves.filter((_, j) => j !== i),
                              path,
                            ) >= MAX_FIXED_SHELVES
                          const sideIndex = layout.columns.findIndex((column) => column.path === path)
                          return (
                            <Button
                              key={`fs-continue-${i}-${path}`}
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={taken || columnIndex < 0}
                              onClick={() =>
                                commitFixedShelves(
                                  fixedShelves.map((r, j) =>
                                    j === i
                                      ? {
                                          ...r,
                                          columnIndex,
                                          bayPath: undefined,
                                          spanPaths: next,
                                        }
                                      : r,
                                  ),
                                )
                              }
                            >
                              Продължи към {columnLabel(sideIndex, layout.columns.length, path)}
                            </Button>
                          )
                        })}
                      {(shelf.spanPaths?.length ?? 0) >= 2 && (
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          Страницата между тези страни се реже отгоре и остава само под рафта.
                        </p>
                      )}
                    </>
                  )}
                  <ShelfMeasureFields
                    from={shelf.from}
                    fromFace={shelf.fromFace}
                    toFace={shelf.toFace}
                    offsetMm={shelf.offsetMm}
                    fromShelf={shelf.fromShelf}
                    bottomLabel="Дъно"
                    topLabel={topOriginLabel}
                    otherShelves={fixedShelves
                      .map((row, j) => ({ index: j, label: `Рафт ${j + 1}`, columnIndex: row.columnIndex }))
                      .filter(
                        (shelfChoice) =>
                          shelfChoice.index !== i &&
                          fixedShelves[shelfChoice.index]?.from !== 'middle' &&
                          (shelf.columnIndex == null ||
                            shelfChoice.columnIndex == null ||
                            shelfChoice.columnIndex === shelf.columnIndex),
                      )
                      .map(({ index, label }) => ({ index, label }))}
                    originHint={shelfFromHint(shelf, topBoardCaption, 'дъното')}
                    measureHint={`${fixedShelfMeasureLabel(
                      {
                        from: shelf.from,
                        fromFace: shelf.fromFace,
                        toFace: shelf.toFace,
                        offsetMm: mmNum(shelf.offsetMm),
                        fromShelf: shelf.fromShelf,
                      },
                      topBoardCaption,
                      'дъното',
                    )}. Линията е на 3D изгледа.`}
                    offsetId={`fixed-off-${i}`}
                    allowMiddle
                    onFrom={() => {}}
                    onMeasureFrom={(next) => {
                      if (next.from === 'middle') {
                        setFixedShelves((rows) =>
                          rows.map((r, j) =>
                            j === i
                              ? { ...r, from: 'middle', fromShelf: null, offsetMm: '0', ...defaultShelfFaces('middle') }
                              : r,
                          ),
                        )
                        return
                      }
                      const from = next.from
                      setFixedShelves((rows) =>
                        rows.map((r, j) =>
                          j === i
                            ? { ...r, from, fromShelf: next.fromShelf, ...defaultShelfFaces(from) }
                            : r,
                        ),
                      )
                    }}
                    onFromFace={(fromFace) =>
                      setFixedShelves((rows) => rows.map((r, j) => (j === i ? { ...r, fromFace } : r)))
                    }
                    onToFace={(toFace) =>
                      setFixedShelves((rows) => rows.map((r, j) => (j === i ? { ...r, toFace } : r)))
                    }
                    onOffset={(offsetMm) =>
                      setFixedShelves((rows) => rows.map((r, j) => (j === i ? { ...r, offsetMm } : r)))
                    }
                  />
                </div>
              ))}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={pendingAdd?.kind === 'fixed-shelf' && !pendingAdd.middle ? 'default' : 'outline'}
                  disabled={!canAddShelf}
                  onClick={() => {
                    if (shelfAsksByZone || layout.columns.length > 1) {
                      setPendingAdd({ kind: 'fixed-shelf' })
                      return
                    }
                    addFixedShelf(null)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Добави фиксиран рафт
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pendingAdd?.kind === 'fixed-shelf' && pendingAdd.middle ? 'default' : 'outline'}
                  disabled={!canAddShelf}
                  onClick={() => {
                    if (shelfAsksByZone || layout.columns.length > 1) {
                      setPendingAdd({ kind: 'fixed-shelf', middle: true })
                      return
                    }
                    addFixedShelf(null, 'middle')
                  }}
                >
                  <Plus className="h-4 w-4" />
                  По средата
                </Button>
              </div>
              {pendingAdd?.kind === 'fixed-shelf' && (shelfAsksByZone || layout.columns.length > 1) && (
                <WherePicker
                  zones={[
                    ...layout.columns
                      .map((column, c) => ({
                        id: `c${c}`,
                        label: columnLabel(c, layout.columns.length, column.path),
                      }))
                      .filter((_, c) => canAddFixedShelfToColumn(columnShelves, c)),
                    ...(shelfAsksByZone
                      ? shelfTargetZones(layout.zones)
                          .filter((zone) => zone.label.includes('·') || zone.path.includes('.'))
                          .filter((zone) => fixedShelfBayCount(fixedShelves, zone.path) < MAX_FIXED_SHELVES)
                          .map((zone) => ({
                            id: `shelf-zone:${zone.id}`,
                            label: zone.label.startsWith('Страна') ? zone.label : `Страна ${zone.path}`,
                          }))
                      : []),
                  ]}
                  allowFull={canAddFixedShelfFull(columnShelves, layout.columns.length)}
                  hint={
                    pendingAdd.middle
                      ? 'Рафтът застава по средата на избраната страна — еднакви празнини над и под него.'
                      : undefined
                  }
                  onPick={applyPending}
                  onCancel={() => setPendingAdd(null)}
                />
              )}
              {layout.error && (layout.shelves.length > 0 || fixedShelves.length > 0) && (
                <p className="mt-1 text-xs text-[var(--color-destructive)]">{layout.error}</p>
              )}
            </FormSection>

            <FormSection defaultOpen={false}
              title="Разделителна страница"
              summary={partitions.length > 0 ? `${partitions.length} бр.` : 'няма'}
            >
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                Вътрешна страница — сяда на дъното, не на пода. Ако вече има фиксиран рафт, пита се дали страницата да е в горната или в долната част. Тя стига до рафта и рафтът остава цял. Мери се от лявата/дясната страница на корпуса,
                от вече добавена страница, или по средата на отвора. „На равни части“ дели избраната страна на равни отвори: 3 равни са 2 страници. Ако в страната има фиксиран рафт, те стигат до него и рафтът остава цял. До 3 страници — 4 части.
              </p>
              {partitions.map((part, i) => (
                <div key={i} className="mt-2 space-y-2 rounded-md border border-[var(--color-border)] p-2">
                  <div className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-xs">Страница {i + 1}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        const remapped = partitions
                          .filter((_, j) => j !== i)
                          .map((r) => {
                            if (r.fromPartition == null) return r
                            if (r.fromPartition === i) {
                              return { ...r, fromPartition: null, from: 'left' as const, ...defaultPartitionFaces('left') }
                            }
                            if (r.fromPartition > i) return { ...r, fromPartition: r.fromPartition - 1 }
                            return r
                          })
                        if (remapped.length === 0 && fixedShelves.length === 0) {
                          const cols = [0, 1, 2, 3].map((c) => zoneOf(zoneUi, `c${c}`))
                          setShelfCount(cols.reduce((n, z) => n + z.shelfCount, 0))
                          setMovableShelves(concatMovable(cols.map((z) => z.movableShelves)))
                          setDrawerFrontHeights(cols.flatMap((z) => z.drawerFrontHeights))
                          setClothesRails(cols.flatMap((z) => z.clothesRails).slice(0, MAX_CLOTHES_RAILS))
                          if (doorSpan === 'zones') {
                            const first = cols.find((z) => z.doorCount > 0)
                            setDoorCount(first?.doorCount ?? 0)
                          }
                          setCutFromOneBoard(cols.some((z) => z.cutFromOneBoard))
                        } else if (remapped.length === 0 && fixedShelves.length > 0) {
                          setZoneUi((z) => ({
                            ...z,
                            bottom: zoneOf(z, 'c0-bottom'),
                            middle: zoneOf(z, 'c0-middle'),
                            top: zoneOf(z, 'c0-top'),
                          }))
                          setFixedShelves((rows) => rows.map((r) => ({ ...r, columnIndex: null })))
                        }
                        setPartitions(remapped)
                      }}
                      aria-label={`Премахни разделителна страница ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">Мери от</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={part.fromPartition == null && part.from === 'left' ? 'default' : 'outline'}
                      onClick={() =>
                        setPartitions((rows) =>
                          rows.map((r, j) =>
                            j === i
                              ? {
                                  ...r,
                                  from: 'left',
                                  fromPartition: null,
                                  ...defaultPartitionFaces('left'),
                                  offsetMm: measuredPartitionOffset(r),
                                  gapIndex: undefined,
                                }
                              : r,
                          ),
                        )
                      }
                    >
                      Лява страница
                    </Button>
                    {partitions.map((_, j) =>
                      j === i ? null : (
                        <Button
                          key={`from-p-${j}`}
                          type="button"
                          size="sm"
                          variant={part.fromPartition === j ? 'default' : 'outline'}
                          onClick={() =>
                            setPartitions((rows) =>
                              rows.map((r, k) =>
                                k === i
                                  ? {
                                      ...r,
                                      from: 'left',
                                      fromPartition: j,
                                      ...defaultPartitionFaces('left'),
                                      offsetMm: measuredPartitionOffset(r),
                                      gapIndex: undefined,
                                    }
                                  : r,
                              ),
                            )
                          }
                        >
                          Страница {j + 1}
                        </Button>
                      ),
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={part.fromPartition == null && part.from === 'right' ? 'default' : 'outline'}
                      onClick={() =>
                        setPartitions((rows) =>
                          rows.map((r, j) =>
                            j === i
                              ? {
                                  ...r,
                                  from: 'right',
                                  fromPartition: null,
                                  ...defaultPartitionFaces('right'),
                                  offsetMm: measuredPartitionOffset(r),
                                  gapIndex: undefined,
                                }
                              : r,
                          ),
                        )
                      }
                    >
                      Дясна страница
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={part.from === 'middle' ? 'default' : 'outline'}
                      onClick={() =>
                        setPartitions((rows) =>
                          rows.map((r, j) => (j === i ? centerPartitionInCurrentBay(i, r) : r)),
                        )
                      }
                    >
                      По средата
                    </Button>
                  </div>
                  {part.from !== 'middle' && part.fromPartition != null && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={part.from === 'left' ? 'default' : 'outline'}
                        onClick={() =>
                          setPartitions((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, from: 'left', ...defaultPartitionFaces('left') } : r,
                            ),
                          )
                        }
                      >
                        Надясно от нея
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={part.from === 'right' ? 'default' : 'outline'}
                        onClick={() =>
                          setPartitions((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, from: 'right', ...defaultPartitionFaces('right') } : r,
                            ),
                          )
                        }
                      >
                        Наляво от нея
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    От {partitionOriginCaption(part)}
                  </p>
                  {part.from !== 'middle' && (
                    <>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={part.fromFace === 'left' ? 'default' : 'outline'}
                      onClick={() =>
                        setPartitions((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, fromFace: 'left' } : r)),
                        )
                      }
                    >
                      Лява страна
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={part.fromFace === 'right' ? 'default' : 'outline'}
                      onClick={() =>
                        setPartitions((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, fromFace: 'right' } : r)),
                        )
                      }
                    >
                      Дясна страна
                    </Button>
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">До разделителната страница</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={part.toFace === 'left' ? 'default' : 'outline'}
                      onClick={() =>
                        setPartitions((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, toFace: 'left' } : r)),
                        )
                      }
                    >
                      Лява страна
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={part.toFace === 'right' ? 'default' : 'outline'}
                      onClick={() =>
                        setPartitions((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, toFace: 'right' } : r)),
                        )
                      }
                    >
                      Дясна страна
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`part-off-${i}`} className="w-28 shrink-0 text-xs">
                      Размер (мм)
                    </Label>
                    <DraftNumber
                      id={`part-off-${i}`}
                      inputMode="decimal"
                      value={part.offsetMm}
                      onCommit={(n) =>
                        setPartitions((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, offsetMm: String(n) } : r)),
                        )
                      }
                    />
                  </div>
                    </>
                  )}
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {`${partitionMeasureLabel({
                      from: part.from,
                      fromPartition: part.fromPartition,
                      fromFace: part.fromFace,
                      toFace: part.toFace,
                      offsetMm: mmNum(part.offsetMm),
                      gapIndex: part.gapIndex,
                      stopsAtShelf: part.stopsAtShelf,
                      startsAtShelf: part.startsAtShelf,
                    })}${part.from === 'middle' || part.stopsAtShelf != null || part.startsAtShelf != null ? '.' : '. На 3D изгледа линията върви между тези две страни.'}`}
                  </p>
                </div>
              ))}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={partitions.length >= MAX_PARTITIONS && !danglingPartition}
                  onClick={() => {
                    if (partitions.length === 0) {
                      if (shelfBandsForColumn(0).length > 0) {
                        setPendingAdd({ kind: 'partition-middle' })
                        return
                      }
                      const center = centerSlidingPartition(params.width, params.thickness)
                      const offset = isSlidingCabinet
                        ? center.offsetMm
                        : defaultPartitionOffsetMm(innerW, params.thickness, 0)
                      remapZonesForNewPartition(0)
                      setPendingAdd(null)
                      setPartitions([
                        {
                          from: 'left',
                          fromPartition: null,
                          ...(isSlidingCabinet
                            ? { fromFace: center.fromFace ?? 'right', toFace: center.toFace ?? 'right' }
                            : defaultPartitionFaces('left')),
                          offsetMm: String(offset),
                          splitsPath: '',
                        },
                      ])
                      return
                    }
                    const kept = partitions.filter((_, index) => !partitionNeedsSide(partitions, index))
                    if (kept.length !== partitions.length) setPartitions(kept)
                    if (kept.length >= MAX_PARTITIONS || partitionPlaceChoices.length === 0) return
                    setPendingAdd({ kind: 'partition-middle' })
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Добави разделителна страница
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pendingAdd?.kind === 'partition-middle' ? 'default' : 'outline'}
                  disabled={!canAddPartitionMiddle}
                  onClick={() => {
                    const kept = partitions.filter((_, index) => !partitionNeedsSide(partitions, index))
                    if (kept.length !== partitions.length) setPartitions(kept)
                    if (partitionPlaceChoices.length > 0 && (kept.length > 0 || shelfBandsForColumn(partitionMiddleGaps[0]?.index ?? 0).length > 0)) {
                      setPendingAdd({ kind: 'partition-middle' })
                      return
                    }
                    addMiddlePartition(partitionMiddleGaps[0]?.index ?? 0)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  По средата
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pendingAdd?.kind === 'partition-even' ? 'default' : 'outline'}
                  disabled={partitionMiddleGaps.length === 0}
                  onClick={() => {
                    setEvenPartitionError(null)
                    if (partitionMiddleGaps.length > 1) {
                      setPendingAdd({ kind: 'partition-even' })
                      return
                    }
                    setPendingAdd({ kind: 'partition-even', column: partitionMiddleGaps[0]?.index ?? 0 })
                  }}
                >
                  <Plus className="h-4 w-4" />
                  На равни части
                </Button>
              </div>
              {pendingAdd?.kind === 'partition-middle' && (
                <WherePicker
                  zones={partitionPlaceChoices.map((g) => ({
                    id: g.id,
                    label: g.label,
                  }))}
                  allowFull={false}
                  hint={
                    partitionPlaceChoices.some((choice) => choice.id.startsWith('part-above') || choice.id.startsWith('part-below'))
                      ? 'Фиксираният рафт дели шкафа. Избери горната или долната част. Страницата стига до рафта и рафтът остава цял.'
                      : 'Избери страната. „Отдолу до рафта“ слага страницата само под фиксирания рафт — тя не стига до горе на шкафа.'
                  }
                  onPick={applyPending}
                  onCancel={() => setPendingAdd(null)}
                />
              )}
              {pendingAdd?.kind === 'partition-even' && pendingAdd.column == null && (
                <WherePicker
                  zones={partitionMiddleGaps.map((g) => ({
                    id: `part-even-side:${g.index}`,
                    label: g.label,
                  }))}
                  allowFull={false}
                  hint="Избери страната, която да се раздели на равни отвори."
                  onPick={applyPending}
                  onCancel={() => setPendingAdd(null)}
                />
              )}
              {pendingAdd?.kind === 'partition-even' && pendingAdd.column != null && (
                <WherePicker
                  zones={evenPartChoices(pendingAdd.column).map((parts) => ({
                    id: `part-even-count:${parts}`,
                    label: `${parts} равни`,
                  }))}
                  allowFull={false}
                  hint={
                    evenPartChoices(pendingAdd.column).length === 0
                      ? 'В тази страна няма място за равни части.'
                      : shelfStopForColumn(pendingAdd.column)
                        ? '3 равни слагат 2 страници под фиксирания рафт. Стигат до рафта и не продължават до плота. Рафтът остава цял.'
                        : '3 равни слагат 2 страници с еднакъв отвор между тях. Страниците, които ограждат страната, си остават.'
                  }
                  onPick={applyPending}
                  onCancel={() => setPendingAdd(null)}
                />
              )}
              {evenPartitionError && (
                <p className="mt-1 text-xs text-[var(--color-destructive)]">{evenPartitionError}</p>
              )}
              {layout.error &&
                (layout.partitions.length > 0 ||
                  partitions.some((p) => p.stopsAtShelf != null || p.startsAtShelf != null)) && (
                <p className="mt-1 text-xs text-[var(--color-destructive)]">{layout.error}</p>
              )}
            </FormSection>

            {hasSplit && !layout.error && (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Шкафът е разделен на {layout.zones.length} части:{' '}
                {layout.zones
                  .map((z) => `${z.label} ${formatMm(z.innerW)}×${formatMm(z.innerH)} мм`)
                  .join(' · ')}
                . При рафт, врата или чекмедже се пита в коя част.
              </p>
            )}

            <FormSection defaultOpen={false}
              title="Рафтове"
              summary={counts.shelfCount > 0 ? `${counts.shelfCount} бр.` : 'няма'}
            >
              <div className="mt-1 max-w-[14rem]">
                <Label htmlFor="shelf-front-inset">По-плитки от страниците (мм)</Label>
                <DraftNumber
                  id="shelf-front-inset"
                  inputMode="numeric"
                  value={shelfFrontInset}
                  onCommit={(n) => setShelfFrontInset(String(n))}
                />
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {shelfFromPartition
                  ? `От вътрешната страница, която е по-плитка заради релсата. Рафтът е ${formatMm(shelfCutDepth)} мм.`
                  : `Рафтът е ${formatMm(shelfCutDepth)} мм — с ${formatMm(shelfInsetValue)} мм по-къс от страницата и стига дозад.`}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                Подвижни рафтове с рафтоносачи. Мери се от дъното, от плота, от вече добавен рафт, или по
                средата на отвора. Следващият тръгва от последния. Над лоста трябва да има поне{' '}
                {MIN_CLOTHES_RAIL_TO_SHELF_MM} мм.
              </p>
              {!hasSplit && (() => {
                const rows = displayedMovable(movableShelves, shelfCount, innerH, params.thickness)
                const z0 = layout.zones[0]
                const railKeepout = (z0?.rails ?? []).map((r) =>
                  clothesRailShelfKeepout(r.yTop - (z0?.y0 ?? 0)),
                )
                const clearances = middleShelfClearances(
                  rowsToSpecs(rows),
                  innerH,
                  params.thickness,
                  { closedBottom: false, closedTop: false },
                  railKeepout,
                )
                return (
                  <>
                    <MiddleGapNote clearances={clearances} />
                    {rows.map((shelf, i) => {
                      const gapHint = middleClearanceHint(shelf.from, shelf.gapIndex, clearances)
                      return (
                      <div key={`pin-${i}`} className="mt-2 space-y-2 rounded-md border border-[var(--color-border)] p-2">
                        <div className="flex items-center gap-2">
                          <span className="min-w-28 shrink-0 text-xs">Рафт {i + 1}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              const next = dropMovableShelf(
                                displayedMovable(movableShelves, shelfCount, innerH, params.thickness),
                                i,
                              )
                              setMovableShelves(next)
                              setShelfCount(next.length)
                            }}
                            aria-label={`Премахни рафт ${i + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <ShelfMeasureFields
                          from={shelf.from}
                          fromFace={shelf.fromFace}
                          toFace={shelf.toFace}
                          offsetMm={shelf.offsetMm}
                          fromShelf={shelf.fromShelf}
                          otherShelves={rows
                            .map((_, j) => ({ index: j, label: `Рафт ${j + 1}` }))
                            .filter((choice) => choice.index !== i)}
                          allowMiddle
                          bottomLabel="Дъно"
                          topLabel={topOriginLabel}
                          originHint={
                            shelf.from === 'middle'
                              ? gapHint
                                ? `По средата · ${gapHint}`
                                : 'По средата на отвора между рафтовете — равни празнини над и под рафта'
                              : shelfFromHint(shelf, topBoardCaption, 'дъното')
                          }
                          measureHint={`${movableShelfMeasureLabel(
                            layout.zones[0]?.movable[i] ?? {
                              from: shelf.from,
                              fromFace: shelf.fromFace,
                              toFace: shelf.toFace,
                              offsetMm: mmNum(shelf.offsetMm),
                              fromShelf: shelf.fromShelf,
                            },
                            topBoardCaption,
                          )}${shelf.from === 'middle' ? (gapHint ? ` · ${gapHint}` : '') : '. Линията е на 3D изгледа.'}`}
                          offsetId={`pin-off-${i}`}
                          onFrom={(from) => {
                            const current = displayedMovable(movableShelves, shelfCount, innerH, params.thickness)
                            const next = current.map((r, j) =>
                              j === i ? shelfOriginChoice(r, { from, fromShelf: null }) : r,
                            )
                            setMovableShelves(next)
                            setShelfCount(next.length)
                          }}
                          onMeasureFrom={(choice) => {
                            const current = displayedMovable(movableShelves, shelfCount, innerH, params.thickness)
                            const next = current.map((r, j) => (j === i ? shelfOriginChoice(r, choice) : r))
                            setMovableShelves(next)
                            setShelfCount(next.length)
                          }}
                          onFromFace={(fromFace) => {
                            const current = displayedMovable(movableShelves, shelfCount, innerH, params.thickness)
                            const next = current.map((r, j) => (j === i ? { ...r, fromFace } : r))
                            setMovableShelves(next)
                            setShelfCount(next.length)
                          }}
                          onToFace={(toFace) => {
                            const current = displayedMovable(movableShelves, shelfCount, innerH, params.thickness)
                            const next = current.map((r, j) => (j === i ? { ...r, toFace } : r))
                            setMovableShelves(next)
                            setShelfCount(next.length)
                          }}
                          onOffset={(offsetMm) => {
                            const current = displayedMovable(movableShelves, shelfCount, innerH, params.thickness)
                            const next = current.map((r, j) => (j === i ? { ...r, offsetMm } : r))
                            setMovableShelves(next)
                            setShelfCount(next.length)
                          }}
                        />
                      </div>
                      )
                    })}
                  </>
                )
              })()}
              {hasSplit &&
                layout.zones.map((z) => {
                  const cur = zoneOf(zoneUi, z.id)
                  const rows = displayedMovable(cur.movableShelves, cur.shelfCount, z.innerH, params.thickness)
                  if (rows.length === 0) return null
                  const clearances = middleShelfClearances(
                    rowsToSpecs(rows),
                    z.innerH,
                    params.thickness,
                    { closedBottom: !z.isFirst, closedTop: !z.isLast },
                    z.rails.map((r) => clothesRailShelfKeepout(r.yTop - z.y0)),
                  )
                  return (
                    <div
                      key={`zone-${z.id}`}
                      className="mt-2 rounded-md border border-[var(--color-border)] px-2 py-1.5"
                    >
                      <FormSection
                        title={z.label}
                        summary={zoneShelfSummary(rows.length, clearances)}
                        defaultOpen={rows.length <= 2}
                      >
                        <MiddleGapNote clearances={clearances} />
                        {rows.map((shelf, i) => {
                          const gapHint = middleClearanceHint(shelf.from, shelf.gapIndex, clearances)
                          return (
                        <div key={`pin-${z.id}-${i}`} className="mt-2 space-y-2 rounded-md border border-[var(--color-border)] p-2">
                          <div className="flex items-center gap-2">
                            <span className="min-w-28 shrink-0 text-xs">
                              Рафт {i + 1}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              onClick={() => {
                                const nextRows = dropMovableShelf(
                                  displayedMovable(
                                    cur.movableShelves,
                                    cur.shelfCount,
                                    z.innerH,
                                    params.thickness,
                                  ),
                                  i,
                                )
                                patchZone(z.id, { movableShelves: nextRows, shelfCount: nextRows.length })
                              }}
                              aria-label={`Премахни рафт ${i + 1} от ${z.label}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <ShelfMeasureFields
                            from={shelf.from}
                            fromFace={shelf.fromFace}
                            toFace={shelf.toFace}
                            offsetMm={shelf.offsetMm}
                            fromShelf={shelf.fromShelf}
                            otherShelves={rows
                              .map((_, j) => ({ index: j, label: `Рафт ${j + 1}` }))
                              .filter((choice) => choice.index !== i)}
                            allowMiddle
                            bottomLabel="Дъно"
                            topLabel={topOriginLabel}
                            originHint={
                              shelf.from === 'middle'
                                ? gapHint
                                  ? `По средата · ${gapHint}`
                                  : `По средата на отвора между рафтовете · ${z.label}`
                                : `${shelfFromHint(
                                    shelf,
                                    z.isLast ? topBoardCaption : 'горния рафт',
                                    z.isFirst ? 'дъното' : 'долния рафт',
                                  )} · ${z.label}`
                            }
                            measureHint={`${movableShelfMeasureLabel(
                              z.movable[i] ?? {
                                from: shelf.from,
                                fromFace: shelf.fromFace,
                                toFace: shelf.toFace,
                                offsetMm: mmNum(shelf.offsetMm),
                                fromShelf: shelf.fromShelf,
                              },
                              z.isLast ? topBoardCaption : 'горния рафт',
                              z.isFirst ? 'дъното' : 'долния рафт',
                            )}${shelf.from === 'middle' ? (gapHint ? ` · ${gapHint}` : '') : '. Линията е на 3D изгледа.'}`}
                            offsetId={`pin-off-${z.id}-${i}`}
                            onFrom={(from) => {
                              const nextRows = displayedMovable(
                                cur.movableShelves,
                                cur.shelfCount,
                                z.innerH,
                                params.thickness,
                              ).map((r, j) => (j === i ? shelfOriginChoice(r, { from, fromShelf: null }) : r))
                              patchZone(z.id, { movableShelves: nextRows, shelfCount: nextRows.length })
                            }}
                            onMeasureFrom={(choice) => {
                              const nextRows = displayedMovable(
                                cur.movableShelves,
                                cur.shelfCount,
                                z.innerH,
                                params.thickness,
                              ).map((r, j) => (j === i ? shelfOriginChoice(r, choice) : r))
                              patchZone(z.id, { movableShelves: nextRows, shelfCount: nextRows.length })
                            }}
                            onFromFace={(fromFace) => {
                              const nextRows = displayedMovable(
                                cur.movableShelves,
                                cur.shelfCount,
                                z.innerH,
                                params.thickness,
                              ).map((r, j) => (j === i ? { ...r, fromFace } : r))
                              patchZone(z.id, { movableShelves: nextRows, shelfCount: nextRows.length })
                            }}
                            onToFace={(toFace) => {
                              const nextRows = displayedMovable(
                                cur.movableShelves,
                                cur.shelfCount,
                                z.innerH,
                                params.thickness,
                              ).map((r, j) => (j === i ? { ...r, toFace } : r))
                              patchZone(z.id, { movableShelves: nextRows, shelfCount: nextRows.length })
                            }}
                            onOffset={(offsetMm) => {
                              const nextRows = displayedMovable(
                                cur.movableShelves,
                                cur.shelfCount,
                                z.innerH,
                                params.thickness,
                              ).map((r, j) => (j === i ? { ...r, offsetMm } : r))
                              patchZone(z.id, { movableShelves: nextRows, shelfCount: nextRows.length })
                            }}
                          />
                        </div>
                          )
                        })}
                      </FormSection>
                    </div>
                  )
                })}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={pendingAdd?.kind === 'shelf' && !pendingAdd.middle ? 'default' : 'outline'}
                  disabled={counts.shelfCount >= MAX_SHELVES * Math.max(1, layout.zones.length)}
                  onClick={() => startAdd({ kind: 'shelf' })}
                >
                  <Plus className="h-4 w-4" />
                  Добави рафт
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pendingAdd?.kind === 'shelf' && pendingAdd.middle ? 'default' : 'outline'}
                  disabled={counts.shelfCount >= MAX_SHELVES * Math.max(1, layout.zones.length)}
                  onClick={() => startAdd({ kind: 'shelf', middle: true })}
                >
                  <Plus className="h-4 w-4" />
                  По средата
                </Button>
              </div>
              {pendingAdd?.kind === 'shelf' && (hasSplit || showCabinetPinParts) && (
                <WherePicker
                  zones={
                    showCabinetPinParts
                      ? cabinetPlaceablePinOpenings.map((o) => ({
                          id: `pin-gap:${o.index}`,
                          label: heightPartCaption(o, cabinetPinOpenings.length, cabinetPinSplitKind),
                        }))
                      : pendingAdd.middle
                        ? layout.zones.filter((z) => !pinSplitZoneIds.has(z.id))
                        : layout.zones.filter((z) => !pinSplitZoneIds.has(z.id))
                  }
                  extras={hasSplit ? [...middleBetweenExtras, ...pinGapZoneExtras] : undefined}
                  allowFull={hasSplit && !showCabinetPinParts}
                  hint={
                    showCabinetPinParts
                      ? cabinetPinSplitKind.hasRail && !cabinetPinSplitKind.hasShelf
                        ? `Лостът дели шкафа. Рафт над лоста е поне ${MIN_CLOTHES_RAIL_TO_SHELF_MM} мм над него.`
                        : 'Рафтът или лостът делят шкафа. Избери в коя част да е новият рафт.'
                      : pinGapZoneExtras.length > 0
                          ? cabinetPinSplitKind.hasRail
                            ? `Лостът или рафтът делят частта. Над лоста трябва да има поне ${MIN_CLOTHES_RAIL_TO_SHELF_MM} мм.`
                            : 'Рафт на точно разстояние дели частта — избери над или под него.'
                        : middleBetweenExtras.length > 0
                          ? '„Между долната и горната“ слага рафта над фиксирания, в отвора до горния рафт.'
                          : undefined
                  }
                  onPick={applyPending}
                  onCancel={() => setPendingAdd(null)}
                />
              )}
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {counts.shelfCount === 0
                  ? 'Без подвижен рафт'
                  : hasSplit
                    ? `${counts.shelfCount * SHELF_PINS_PER_SHELF} рафтоносача · ${formatEur(settings.hardware.shelfPinEur)}/бр.`
                    : movableShelves.length > 0
                      ? `${counts.shelfCount * SHELF_PINS_PER_SHELF} рафтоносача · ${formatEur(settings.hardware.shelfPinEur)}/бр. · дълбочина ${formatMm(shelfCutDepth)} мм`
                      : `Разстояние между рафтовете: ${formatMm(shelfGap)} мм · ${shelfCount * SHELF_PINS_PER_SHELF} рафтоносача · ${formatEur(settings.hardware.shelfPinEur)}/бр. · дълбочина ${formatMm(shelfCutDepth)} мм`}
              </p>
            </FormSection>

        <FormSection
          defaultOpen={false}
          title="Фазер на гърба"
          summary={hasBack ? (nailBack ? 'С фазер · пирони' : 'С фазер') : 'Без'}
        >
          <div className="mt-1 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={hasBack ? 'default' : 'outline'}
              onClick={() => setHasBack(true)}
            >
              С фазер
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!hasBack ? 'default' : 'outline'}
              onClick={() => setHasBack(false)}
            >
              Без
            </Button>
          </div>
          {hasBack && (
            <div className="mt-2">
              <Button
                type="button"
                size="sm"
                variant={nailBack ? 'default' : 'outline'}
                onClick={() => setNailBack((on) => !on)}
              >
                Коване с пирони
              </Button>
            </div>
          )}
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {hasBack
              ? `${
                  backPlan.pieces.length > 1
                    ? `Рязане ${backPlan.pieces.map((piece) => `${formatMm(piece.width)} × ${formatMm(piece.height)}`).join(', ')} мм`
                    : `Рязане ${formatMm(backCut.width)} × ${formatMm(backCut.height)} мм`
                }${backPlinth > 0 ? ` — цокълът ${backPlinth} мм не се покрива.` : ' — покрива целия гръб.'}${
                  backPlan.pieces.length > 1 ? ' Над 1 м се дели на разделителната страница.' : ''
                }`
              : 'Без гръб.'}
          </p>
          {hasBack && nailBack && (
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Пирон през 12 см, {settings.assemblyTime.backNailSeconds} сек. По страниците, дъното, плота,
              разделителните страници и фиксираните рафтове.
              {backPlan.jointNails > 0
                ? ` На снадката между фазерите — от двете страни, по ${settings.assemblyTime.backJointNailSeconds} сек (${backPlan.jointNails} пирона).`
                : ''}
            </p>
          )}
        </FormSection>

        <FormSection defaultOpen={false}
          title="Лост за дрехи"
          summary={counts.clothesRailCount > 0 ? `${counts.clothesRailCount} бр.` : 'няма'}
        >
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            Между страниците. Отгоре обикновено 48 мм от плоскостта над отвора — плот или рафт, не винаги
            плотът на шкафа. „2 лоста на еднакво разстояние“ слага два лоста: разстоянието между тях е колкото
            от долния до пода. Лостът дели отвора: можеш да сложиш рафтове над него, поне{' '}
            {MIN_CLOTHES_RAIL_TO_SHELF_MM} мм над лоста.
          </p>
          {!hasSplit &&
            clothesRails.map((rail, i) => (
              <div key={`rail-${i}`} className="mt-2 space-y-2 rounded-md border border-[var(--color-border)] p-2">
                <div className="flex items-center gap-2">
                  <span className="min-w-28 shrink-0 text-xs">Лост {i + 1}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setClothesRails((rows) => rows.filter((_, j) => j !== i))}
                    aria-label={`Премахни лост ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={rail.from === 'bottom' ? 'default' : 'outline'}
                    onClick={() =>
                      setClothesRails((rows) =>
                        rows.map((r, j) =>
                          j === i
                            ? {
                                from: 'bottom',
                                offsetMm: r.from === 'middle' ? String(DEFAULT_CLOTHES_RAIL_FROM_TOP_MM) : r.offsetMm,
                                ...(r.gapIndex != null ? { gapIndex: r.gapIndex } : {}),
                              }
                            : r,
                        ),
                      )
                    }
                  >
                    Отдолу
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={rail.from === 'top' ? 'default' : 'outline'}
                    onClick={() =>
                      setClothesRails((rows) =>
                        rows.map((r, j) =>
                          j === i
                            ? {
                                from: 'top',
                                offsetMm: r.from === 'middle' ? String(DEFAULT_CLOTHES_RAIL_FROM_TOP_MM) : r.offsetMm,
                                ...(r.gapIndex != null ? { gapIndex: r.gapIndex } : {}),
                              }
                            : r,
                        ),
                      )
                    }
                  >
                    Отгоре
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={rail.from === 'middle' ? 'default' : 'outline'}
                    onClick={() =>
                      setClothesRails((rows) =>
                        rows.map((r, j) => (j === i ? newMiddleRail(r.gapIndex) : r)),
                      )
                    }
                  >
                    По средата
                  </Button>
                </div>
                {rail.from !== 'middle' && (
                  <div>
                    <Label htmlFor={`rail-off-${i}`} className="text-xs">
                      Размер (мм)
                    </Label>
                    <DraftNumber
                      id={`rail-off-${i}`}
                      value={rail.offsetMm}
                      onCommit={(n) =>
                        setClothesRails((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, offsetMm: String(n) } : r)),
                        )
                      }
                    />
                  </div>
                )}
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {(() => {
                    const zone = layout.zones[0]
                    const cap = railOriginCaptions(zone, i, topBoardCaption)
                    const resolved = zone?.rails[i]
                    const others = (zone?.rails ?? []).filter((_, j) => j !== i).map((r) => r.yTop)
                    const ground =
                      rail.from === 'bottom' && resolved && (zone?.y0 ?? 0) <= 0.5
                        ? railToGroundNote(resolved.yTop, others, floorDropMm)
                        : ''
                    return `${clothesRailMeasureLabel(
                      { from: rail.from, offsetMm: mmNum(rail.offsetMm) },
                      cap.top,
                      cap.bottom,
                    )}${rail.from === 'middle' ? '.' : '. Линията е на 3D изгледа.'}${ground}`
                  })()}
                </p>
              </div>
            ))}
          {hasSplit &&
            layout.zones.map((z) => {
              const rows = zoneOf(zoneUi, z.id).clothesRails
              return rows.map((rail, i) => (
                <div key={`rail-${z.id}-${i}`} className="mt-2 space-y-2 rounded-md border border-[var(--color-border)] p-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-28 shrink-0 text-xs">
                      Лост {i + 1} · {z.label}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        const next = rows.filter((_, j) => j !== i)
                        patchZone(z.id, { clothesRails: next, hasClothesRail: next.length > 0 })
                      }}
                      aria-label={`Премахни лост ${i + 1} от ${z.label}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={rail.from === 'bottom' ? 'default' : 'outline'}
                      onClick={() =>
                        patchZone(z.id, {
                          clothesRails: rows.map((r, j) =>
                            j === i
                              ? {
                                  from: 'bottom' as const,
                                  offsetMm: r.from === 'middle' ? String(DEFAULT_CLOTHES_RAIL_FROM_TOP_MM) : r.offsetMm,
                                  ...(r.gapIndex != null ? { gapIndex: r.gapIndex } : {}),
                                }
                              : r,
                          ),
                        })
                      }
                    >
                      Отдолу
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={rail.from === 'top' ? 'default' : 'outline'}
                      onClick={() =>
                        patchZone(z.id, {
                          clothesRails: rows.map((r, j) =>
                            j === i
                              ? {
                                  from: 'top' as const,
                                  offsetMm: r.from === 'middle' ? String(DEFAULT_CLOTHES_RAIL_FROM_TOP_MM) : r.offsetMm,
                                  ...(r.gapIndex != null ? { gapIndex: r.gapIndex } : {}),
                                }
                              : r,
                          ),
                        })
                      }
                    >
                      Отгоре
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={rail.from === 'middle' ? 'default' : 'outline'}
                      onClick={() =>
                        patchZone(z.id, {
                          clothesRails: rows.map((r, j) => (j === i ? newMiddleRail(r.gapIndex) : r)),
                        })
                      }
                    >
                      По средата
                    </Button>
                  </div>
                  {rail.from !== 'middle' && (
                    <div>
                      <Label htmlFor={`rail-off-${z.id}-${i}`} className="text-xs">
                        Размер (мм)
                      </Label>
                      <DraftNumber
                        id={`rail-off-${z.id}-${i}`}
                        value={rail.offsetMm}
                        onCommit={(n) =>
                          patchZone(z.id, {
                            clothesRails: rows.map((r, j) =>
                              j === i ? { ...r, offsetMm: String(n) } : r,
                            ),
                            hasClothesRail: true,
                          })
                        }
                      />
                    </div>
                  )}
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {(() => {
                      const cap = railOriginCaptions(z, i, topBoardCaption)
                      const resolved = z.rails[i]
                      const others = z.rails.filter((_, j) => j !== i).map((r) => r.yTop)
                      const ground =
                        rail.from === 'bottom' && resolved && z.y0 <= 0.5
                          ? railToGroundNote(resolved.yTop, others, floorDropMm)
                          : ''
                      return `${clothesRailMeasureLabel(
                        { from: rail.from, offsetMm: mmNum(rail.offsetMm) },
                        cap.top,
                        cap.bottom,
                      )}${rail.from === 'middle' ? '.' : '. Линията е на 3D изгледа.'}${ground}`
                    })()}
                  </p>
                </div>
              ))
            })}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={pendingAdd?.kind === 'rail' && !pendingAdd.middle ? 'default' : 'outline'}
              disabled={counts.clothesRailCount >= MAX_CLOTHES_RAILS * Math.max(1, layout.zones.length)}
              onClick={() => startAdd({ kind: 'rail' })}
            >
              <Plus className="h-4 w-4" />
              Добави лост
            </Button>
            <Button
              type="button"
              size="sm"
              variant={pendingAdd?.kind === 'rail' && pendingAdd.middle ? 'default' : 'outline'}
              disabled={counts.clothesRailCount >= MAX_CLOTHES_RAILS * Math.max(1, layout.zones.length)}
              onClick={() => startAdd({ kind: 'rail', middle: true })}
            >
              <Plus className="h-4 w-4" />
              По средата
            </Button>
            <Button
              type="button"
              size="sm"
              variant={pendingAdd?.kind === 'rail-even' ? 'default' : 'outline'}
              onClick={() => startAdd({ kind: 'rail-even' })}
            >
              <Plus className="h-4 w-4" />
              2 лоста на еднакво разстояние
            </Button>
            {counts.clothesRailCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setPendingAdd(null)
                  setClothesRails([])
                  setZoneUi((z) => {
                    const next = { ...z }
                    for (const id of Object.keys(next)) {
                      next[id] = { ...zoneOf(next, id), clothesRails: [], hasClothesRail: false }
                    }
                    return next
                  })
                }}
              >
                Без
              </Button>
            )}
          </div>
          {pendingAdd?.kind === 'rail-even' && hasSplit && (
            <WherePicker
              zones={layout.zones}
              allowFull
              hint="Долният лост се слага така, че от него до земята е колкото между двата лоста. Цокълът и дъното влизат. В част над рафт се мери до дъното на частта."
              onPick={applyPending}
              onCancel={() => setPendingAdd(null)}
            />
          )}
          {pendingAdd?.kind === 'rail' && (hasSplit || showCabinetRailParts) && (
            <WherePicker
              zones={
                showCabinetRailParts
                  ? cabinetRailOpenings.map((o) => ({
                      id: `rail-gap:${o.index}`,
                      label: o.label,
                    }))
                  : layout.zones.filter((z) => !railSplitZoneIds.has(z.id))
              }
              extras={hasSplit ? railGapZoneExtras : undefined}
              allowFull={hasSplit}
              hint={
                railGapZoneExtras.length > 0 || showCabinetRailParts
                  ? 'Рафтовете и лостът делят отвора. Избери под, над или между тях — „отгоре“ се мери от плоскостта над тази част.'
                  : undefined
              }
              onPick={applyPending}
              onCancel={() => setPendingAdd(null)}
            />
          )}
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {counts.clothesRailCount === 0
              ? 'Без лост.'
              : `${counts.clothesRailCount === 1 ? 'Лост' : `${counts.clothesRailCount} лоста`} ${clothesRailLengthMm(params.width, params.thickness)} мм между страниците · ${formatEur(settings.hardware.clothesRailEurPerM)}/м.`}
          </p>
        </FormSection>

        <FormSection defaultOpen={false}
          title="Врати"
          disabled={depthMode === 'no-doors'}
          summary={
            depthMode === 'no-doors'
              ? 'Без'
              : isSlidingCabinet
                ? doorCount > 0
                  ? `Плъзгащи ${slidingDoorCount}`
                  : 'Без'
                : doorCount > 0
                  ? `${doorCount} бр.`
                  : 'Без'
          }
        >
          {(typeId === 'section' || typeId === 'wardrobe') && (
            <>
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                {typeId === 'wardrobe'
                  ? slidingDoorCount === 3
                    ? `Три еднакви врати: две на задната релса и една на предната. Затворено лявата е отляво, средната по средата, дясната отдясно. Средната препокрива профила на другите две с ${SLIDING_THREE_DOOR_OVERLAP_MM} мм.`
                    : 'Две плъзгащи врати покриват целия гардероб и се препокриват с 10 мм. Кант дръжка D1L или профил D2 се слага след рязането.'
                  : 'Наложени врати върху корпуса или плъзгащи между страниците.'}
              </p>
              {typeId === 'section' && (
                <div className="mt-1 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={!isSlidingCabinet ? 'default' : 'outline'}
                    onClick={() => {
                      setDoorStyle('hinged')
                      alignShelfInset(false)
                      setPendingAdd(null)
                    }}
                  >
                    Наложени
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={isSlidingCabinet ? 'default' : 'outline'}
                    onClick={() => {
                      setDoorStyle('sliding')
                      alignShelfInset(true)
                      setDoorCount(2)
                      setDoorSpan('full')
                      setSlidingEdges(defaultSlidingEdges(2))
                      setDepthMode((mode) => (mode === 'no-doors' ? 'without-door' : mode))
                      setPendingAdd(null)
                      clearZoneDoors()
                    }}
                  >
                    Плъзгащи
                  </Button>
                </div>
              )}
            </>
          )}
          {isSlidingCabinet ? (
            <>
              {typeId === 'section' && (
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={doorCount === 0 ? 'default' : 'outline'}
                    onClick={() => {
                      setDoorCount(0)
                      setPendingAdd(null)
                    }}
                  >
                    Без
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={doorCount === 2 && slidingDoorCount === 2 ? 'default' : 'outline'}
                    onClick={() => {
                      setSlidingDoorCount(2)
                      setDoorCount(2)
                      setSlidingEdges(oneSideSlidingEdges())
                      setDoorSpan('full')
                      setPendingAdd(null)
                      clearZoneDoors()
                      if (slidingBayMode === 'equal') splitEqualBays(2)
                    }}
                  >
                    2 врати
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={slidingDoorCount === 3 ? 'default' : 'outline'}
                    onClick={() => {
                      setSlidingDoorCount(3)
                      setDoorCount(2)
                      setSlidingEdges(threeDoorSlidingEdges())
                      setDoorSpan('full')
                      setDepthMode((mode) => (mode === 'no-doors' ? 'without-door' : mode))
                      setPendingAdd(null)
                      clearZoneDoors()
                      if (slidingBayMode === 'equal') splitEqualBays(3)
                    }}
                  >
                    3 врати
                  </Button>
                </div>
              )}
              {typeId === 'wardrobe' && (
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={slidingDoorCount === 2 ? 'default' : 'outline'}
                    onClick={() => {
                      setSlidingDoorCount(2)
                      setDoorCount(2)
                      setSlidingEdges(oneSideSlidingEdges())
                      if (slidingBayMode === 'equal') splitEqualBays(2)
                    }}
                  >
                    2 врати
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={slidingDoorCount === 3 ? 'default' : 'outline'}
                    onClick={() => {
                      setSlidingDoorCount(3)
                      setDoorCount(2)
                      setSlidingEdges(threeDoorSlidingEdges())
                      if (slidingBayMode === 'equal') splitEqualBays(3)
                    }}
                  >
                    3 врати
                  </Button>
                </div>
              )}
              {doorCount === 2 && (
                <>
                  {slidingDoorCount === 3 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        Трите врати са с еднакъв габарит. Средната, на предната релса, е с кант дръжка отляво и отдясно.
                        Лявата задна е с дръжка отляво и профил отдясно. Дясната задна е с дръжка отдясно и профил отляво.
                        Страна без чекмедже може да се закрива с до 50 мм. Ако има чекмедже, отворът трябва да е поне с 20 мм
                        по-широк от челото, иначе чекмеджето не се отваря.
                      </p>
                      {threeDoorCheck && threeDoorCheck.issues.length > 0 && (
                        <div className="rounded-md border border-red-500/60 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
                          {threeDoorCheck.issues.map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                          {threeDoorCheck.offsets &&
                          partitions.length === 2 &&
                          Math.abs(mmNum(partitions[0]?.offsetMm) - threeDoorCheck.offsets[0]) < 0.26 &&
                          Math.abs(mmNum(partitions[1]?.offsetMm) - threeDoorCheck.offsets[1]) < 0.26 ? (
                            <p className="mt-1">
                              Страните вече са на тези размери
                              {threeDoorCheck.adjustError ? `. ${threeDoorCheck.adjustError}` : '.'}
                            </p>
                          ) : threeDoorCheck.offsets ? (
                            <Button
                              type="button"
                              size="sm"
                              className="mt-2"
                              onClick={() => {
                                const [a, b] = threeDoorCheck.offsets!
                                if (partitions.length === 0) {
                                  setZoneUi({
                                    ...zoneUi,
                                    c0: {
                                      ...emptyZoneUi(),
                                      shelfCount,
                                      movableShelves,
                                      clothesRails,
                                      hasClothesRail: clothesRails.length > 0,
                                      drawerFrontHeights,
                                    },
                                    c1: emptyZoneUi(),
                                    c2: emptyZoneUi(),
                                  })
                                  setShelfCount(0)
                                  setMovableShelves([])
                                  setClothesRails([])
                                  setDrawerFrontHeights([])
                                }
                                setPartitions([
                                  {
                                    from: 'left',
                                    fromPartition: null,
                                    fromFace: 'right',
                                    toFace: 'left',
                                    offsetMm: String(a),
                                  },
                                  {
                                    from: 'left',
                                    fromPartition: null,
                                    fromFace: 'right',
                                    toFace: 'left',
                                    offsetMm: String(b),
                                  },
                                ])
                              }}
                            >
                              Нагласи страните
                            </Button>
                          ) : (
                            <p className="mt-1">
                              {threeDoorCheck.adjustError ?? 'Страните не могат да се нагласят за този отвор.'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {slidingDoorCount === 2 && (
                  <>
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium">Кант дръжка</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={slidingHandlesOnBothSides(slidingEdges) ? 'default' : 'outline'}
                        onClick={() => setSlidingEdges(bothSideSlidingEdges())}
                      >
                        От двете страни
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={!slidingHandlesOnBothSides(slidingEdges) ? 'default' : 'outline'}
                        onClick={() => setSlidingEdges(oneSideSlidingEdges())}
                      >
                        Само от едната
                      </Button>
                    </div>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      D1L е дръжката за отваряне. От другата страна се слага профил D2 — той не увеличава широчината.
                    </p>
                  </div>
                  {!effectiveExternalDoors &&
                    (['left', 'right'] as const).map((side, i) => {
                      const edges = slidingEdges[i] ?? { left: 'handle' as const, right: 'handle' as const }
                      const title = side === 'left' ? 'Лява врата' : 'Дясна врата'
                      const setEdge = (which: 'left' | 'right', kind: SlidingEdgeKind) => {
                        setSlidingEdges((rows) => {
                          const next = defaultSlidingEdges(2).map((d, j) => rows[j] ?? d)
                          next[i] = { ...next[i], [which]: kind }
                          return next
                        })
                      }
                      return (
                        <div key={side} className="mt-3 space-y-1">
                          <p className="text-xs font-medium">{title}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-[var(--color-muted-foreground)]">ляво</span>
                            {(['handle', 'cap'] as const).map((kind) => (
                              <Button
                                key={`l-${kind}`}
                                type="button"
                                size="sm"
                                variant={edges.left === kind ? 'default' : 'outline'}
                                onClick={() => setEdge('left', kind)}
                              >
                                {slidingEdgeLabel(kind)}
                              </Button>
                            ))}
                            <span className="text-xs text-[var(--color-muted-foreground)]">дясно</span>
                            {(['handle', 'cap'] as const).map((kind) => (
                              <Button
                                key={`r-${kind}`}
                                type="button"
                                size="sm"
                                variant={edges.right === kind ? 'default' : 'outline'}
                                onClick={() => setEdge('right', kind)}
                              >
                                {slidingEdgeLabel(kind)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </>
                  )}
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium">Горна релса 3 м</p>
                    <div className="flex flex-wrap gap-2">
                      {SLIDING_TRACK_COLOR_IDS.map((id) => (
                        <Button
                          key={`u-${id}`}
                          type="button"
                          size="sm"
                          variant={slidingUpperTrackColor === id ? 'default' : 'outline'}
                          onClick={() => setSlidingUpperTrackColor(id)}
                        >
                          {SLIDING_TRACK_COLOR_LABELS[id]}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {formatEur(settings.hardware.slidingUpperTrackEur[slidingUpperTrackColor])} за целия прът
                    </p>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium">Долна релса 3 м</p>
                    <div className="flex flex-wrap gap-2">
                      {SLIDING_TRACK_COLOR_IDS.map((id) => (
                        <Button
                          key={`l-${id}`}
                          type="button"
                          size="sm"
                          variant={slidingLowerTrackColor === id ? 'default' : 'outline'}
                          onClick={() => setSlidingLowerTrackColor(id)}
                        >
                          {SLIDING_TRACK_COLOR_LABELS[id]}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {formatEur(settings.hardware.slidingLowerTrackEur[slidingLowerTrackColor])} за целия прът
                    </p>
                  </div>
                  {!effectiveExternalDoors && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="sliding-handle-sku">Кант дръжка D1L</Label>
                        <select
                          id="sliding-handle-sku"
                          className="mt-1 h-9 w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 text-sm"
                          value={slidingHandleSkuId}
                          onChange={(e) => setSlidingHandleSkuId(e.target.value)}
                        >
                          <option value="">Автоматично</option>
                          {(settings.hardware.slidingHandleSkus ?? []).map((sku) => (
                            <option key={sku.id} value={sku.id}>
                              {slidingSkuLabel(sku)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="sliding-cap-sku">Профил D2 18 мм</Label>
                        <select
                          id="sliding-cap-sku"
                          className="mt-1 h-9 w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 text-sm"
                          value={slidingCapSkuId}
                          onChange={(e) => setSlidingCapSkuId(e.target.value)}
                        >
                          <option value="">Автоматично</option>
                          {(settings.hardware.slidingCapSkus ?? []).map((sku) => (
                            <option key={sku.id} value={sku.id}>
                              {slidingSkuLabel(sku)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium">Плавно прибиране</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={slidingSoftCloseLeft === '0' && slidingSoftCloseRight === '0' ? 'default' : 'outline'}
                        onClick={() => {
                          setSlidingSoftCloseLeft('0')
                          setSlidingSoftCloseRight('0')
                        }}
                      >
                        Без
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={slidingSoftCloseLeft === '1' && slidingSoftCloseRight === '1' ? 'default' : 'outline'}
                        onClick={() => {
                          setSlidingSoftCloseLeft('1')
                          setSlidingSoftCloseRight('1')
                        }}
                      >
                        1+1
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={slidingSoftCloseLeft === '2' && slidingSoftCloseRight === '2' ? 'default' : 'outline'}
                        onClick={() => {
                          setSlidingSoftCloseLeft('2')
                          setSlidingSoftCloseRight('2')
                        }}
                      >
                        2+2
                      </Button>
                    </div>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="soft-close-left">Отляво</Label>
                        <DraftNumber
                          id="soft-close-left"
                          inputMode="numeric"
                          value={slidingSoftCloseLeft}
                          onCommit={(n) => setSlidingSoftCloseLeft(String(n))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="soft-close-right">Отдясно</Label>
                        <DraftNumber
                          id="soft-close-right"
                          inputMode="numeric"
                          value={slidingSoftCloseRight}
                          onCommit={(n) => setSlidingSoftCloseRight(String(n))}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {formatEur(settings.hardware.slidingSoftCloseEur)} / бр. · механизъм MVP-005{' '}
                      {formatEur(settings.hardware.slidingMvp005KitEur)} на врата
                    </p>
                  </div>
                  {nsMeasure && (
                    <SlidingDetails title="Формула за рязане D1L / D2">
                      {(() => {
                        const leaves = layoutSlidingDoors({
                          innerW: nsMeasure.innerW,
                          innerH: nsMeasure.innerH,
                          thickness: params.thickness,
                          partitions: layout.partitions,
                          edges: slidingDoorCount === 3 ? threeDoorSlidingEdges() : slidingEdges,
                        })
                        const cell = (leaf: (typeof leaves)[number] | undefined, edge: 'left' | 'right') => {
                          if (!leaf) return '—'
                          const kind = leaf.edges[edge]
                          return `${slidingEdgeLabel(kind)} · ${formatMm(slidingProfileMm(kind))} мм`
                        }
                        const size = (leaf: (typeof leaves)[number] | undefined) =>
                          leaf ? `${formatMm(leaf.gabaritW)} × ${formatMm(leaf.gabaritH)} мм` : '—'
                        const cut = (leaf: (typeof leaves)[number] | undefined) =>
                          leaf ? `${formatMm(leaf.cutW)} × ${formatMm(leaf.cutH)} мм` : '—'
                        const cutH = leaves[0]?.cutH ?? 0
                        const handleSku = pickSlidingSku(
                          settings.hardware.slidingHandleSkus ?? [],
                          cutH,
                          slidingHandleSkuId,
                        )
                        const capSku = pickSlidingSku(settings.hardware.slidingCapSkus ?? [], cutH, slidingCapSkuId)
                        return (
                          <>
                            <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
                              <table className="w-full text-xs">
                                <thead className="bg-[var(--color-muted)]/40">
                                  <tr>
                                    <th className="px-2 py-1.5 text-left font-medium"> </th>
                                    {leaves.map((leaf) => (
                                      <th key={leaf.index} className="px-2 py-1.5 text-left font-medium">
                                        {leaf.name}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-t border-[var(--color-border)]">
                                    <td className="px-2 py-1.5 text-[var(--color-muted-foreground)]">Габарит</td>
                                    {leaves.map((leaf) => (
                                      <td key={`g-${leaf.index}`} className="px-2 py-1.5">{size(leaf)}</td>
                                    ))}
                                  </tr>
                                  <tr className="border-t border-[var(--color-border)]">
                                    <td className="px-2 py-1.5 text-[var(--color-muted-foreground)]">Рязане</td>
                                    {leaves.map((leaf) => (
                                      <td key={`c-${leaf.index}`} className="px-2 py-1.5">{cut(leaf)}</td>
                                    ))}
                                  </tr>
                                  <tr className="border-t border-[var(--color-border)]">
                                    <td className="px-2 py-1.5 text-[var(--color-muted-foreground)]">Ляв профил</td>
                                    {leaves.map((leaf) => (
                                      <td key={`l-${leaf.index}`} className="px-2 py-1.5">{cell(leaf, 'left')}</td>
                                    ))}
                                  </tr>
                                  <tr className="border-t border-[var(--color-border)]">
                                    <td className="px-2 py-1.5 text-[var(--color-muted-foreground)]">Десен профил</td>
                                    {leaves.map((leaf) => (
                                      <td key={`r-${leaf.index}`} className="px-2 py-1.5">{cell(leaf, 'right')}</td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            <p className="text-xs text-[var(--color-muted-foreground)]">
                              Рязане по широчина = габарит − ляв профил − десен профил. D1L добавя {formatMm(SLIDING_HANDLE_PROFILE_MM)} мм;
                              D2 не добавя. Височина на рязане = отвор − {SLIDING_DOOR_BOTTOM_CLEAR_MM} мм отдолу − {SLIDING_DOOR_TOP_CLEAR_MM} мм отгоре. Горе и долу тънък кант 0,5 мм, без да се вади още.
                            </p>
                            {handleSku ? (
                              <p className="text-xs text-[var(--color-muted-foreground)]">
                                D1L в сметката: {slidingSkuLabel(handleSku)} — цял прът.
                              </p>
                            ) : null}
                            {capSku ? (
                              <p className="text-xs text-[var(--color-muted-foreground)]">
                                D2 в сметката: {slidingSkuLabel(capSku)} — цял прът.
                              </p>
                            ) : null}
                          </>
                        )
                      })()}
                    </SlidingDetails>
                  )}
                  <SlidingDetails title="Линкове към механизмите">
                    <ul className="space-y-1 text-xs">
                      {(
                        [
                          ['Кант дръжка D1L', settings.hardware.slidingLinks.d1Handle],
                          ['Профил D2 18 мм', settings.hardware.slidingLinks.d2Profile],
                          ['Система MVP-005 (релси)', settings.hardware.slidingLinks.mvp005System],
                          ['Механизъм MVP-005', settings.hardware.slidingLinks.mvp005Mechanism],
                          ['Плавно прибиране', settings.hardware.slidingLinks.softClose],
                        ] as const
                      ).map(([label, href]) => (
                        <li key={label}>
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--color-primary)] underline-offset-2 hover:underline"
                          >
                            {label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </SlidingDetails>
                  <DoorSourcePicker
                    external={effectiveExternalDoors}
                    projectForced={projectExternalDoors}
                    onChange={setExternalDoors}
                  />
                </>
              )}
            </>
          ) : (
            <>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            {hasSplit
              ? 'Могат да са на една част или на целия шкаф. Долу на 0, горе фуга 3 мм.'
              : innerDoors
                ? 'Вътрешна врата: влиза между страниците до долния край на плота. Фуга 3 мм отгоре, 3 мм отляво и 3 мм отдясно.'
                : 'Външна врата: покрива канта на страниците. Долу на 0, горе фуга 3 мм, странично 1.5 мм отляво и отдясно.'}
          </p>
          <OverlayInsetPicker
            inset={innerDoors}
            onChange={setInnerDoors}
            overlayLabel="Външна"
            insetLabel="Вътрешна"
            overlayHint="Вратата покрива канта на страниците. Фуга 1.5 мм отляво и 1.5 мм отдясно (3 мм общо)."
            insetHint="Вратата влиза между страниците до долния край на плота, после 3 мм фуга горе. Отстрани 3 мм + 3 мм."
          />
          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={counts.doorCount === 0 && pendingAdd?.kind !== 'door' ? 'default' : 'outline'}
              onClick={() => {
                setPendingAdd(null)
                setDoorCount(0)
                setDoorSpan('full')
                clearZoneDoors()
              }}
            >
              Без
            </Button>
            {([1, 2, 3, 4] as const).map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={
                  pendingAdd?.kind === 'door' && pendingAdd.count === n
                    ? 'default'
                    : !hasSplit && doorCount === n
                      ? 'default'
                      : 'outline'
                }
                onClick={() => startAdd({ kind: 'door', count: n })}
              >
                {n === 1 ? '1 врата' : `${n} врати`}
              </Button>
            ))}
          </div>
          {(doorCount >= 3 ||
            (pendingAdd?.kind === 'door' && pendingAdd.count >= 3) ||
            Object.values(zoneUi).some((z) => z.doorCount >= 3)) && (
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Крайната лява е на лявата страница, крайната дясна на дясната. Вътрешните се въртят от ръба към средата.
            </p>
          )}
          {pendingAdd?.kind === 'door' && (
            <WherePicker
              zones={layout.zones}
              allowFull
              onPick={applyPending}
              onCancel={() => setPendingAdd(null)}
            />
          )}
          {hasSplit && doorSpan === 'full' && doorCount > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs">
                {doorCount === 1 ? '1 врата' : `${doorCount} врати`} · {FULL_CABINET_LABEL}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setDoorCount(0)}
                aria-label="Премахни вратите на целия шкаф"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          {hasSplit &&
            layout.zones.map((z) =>
              zoneOf(zoneUi, z.id).doorCount > 0 ? (
                <div key={z.id} className="mt-2 flex items-center gap-2">
                  <span className="text-xs">
                    {zoneOf(zoneUi, z.id).doorCount === 1
                      ? '1 врата'
                      : `${zoneOf(zoneUi, z.id).doorCount} врати`}{' '}
                    · {z.label} · фронт{' '}
                    {formatMm(innerDoors ? z.innerH : z.frontHeight)} мм
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => patchZone(z.id, { doorCount: 0 })}
                    aria-label={`Премахни вратите от ${z.label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : null,
            )}
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {counts.doorCount === 0
              ? counts.drawerCount > 0 && !innerDrawerFronts
                ? 'Без врати. Наложените чела пак седят отпред, затова страниците остават по-плитки.'
                : 'Без врати — страниците са с пълната дълбочина.'
              : doorSizeHint(
                  params.width,
                  doorFrontH,
                  layout,
                  drawerFrontHeights,
                  doorCount,
                  doorSpan,
                  !effectiveExternalDoors,
                  innerDoors,
                  params.thickness,
                )}
          </p>
          {hasDoorsForSource && (
            <DoorSourcePicker
              external={effectiveExternalDoors}
              projectForced={projectExternalDoors}
              onChange={setExternalDoors}
            />
          )}
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={includeHandles && handleSku !== 'none'}
              onCheckedChange={(c) => {
                const on = c === true
                setIncludeHandles(on)
                if (on && handleSku === 'none') setHandleSku('normal')
                if (!on) setHandleSku('none')
                setHandleOverrides({})
              }}
            />
            Дръжки в цената
          </label>
          <label className="mt-2 block text-sm" htmlFor="cab-handle">
            Дръжка
            <select
              id="cab-handle"
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5"
              value={!includeHandles || handleSku === 'none' ? 'none' : handleSku}
              onChange={(event) => {
                const sku = parsePullSku(event.target.value)
                setHandleSku(sku)
                setIncludeHandles(sku !== 'none')
                setHandleOverrides({})
              }}
            >
              {PULL_CHOICES.map((choice) => (
                <option key={choice.sku} value={choice.sku}>
                  {choice.name}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {(() => {
              // Doors with a mirror may go without a handle.
              const bareDoors =
                doorMirror.enabled && doorMirror.noPull
                  ? Math.min(counts.doorCount, doorMirror.on ? doorMirror.on.length : counts.doorCount)
                  : 0
              const n = counts.doorCount - bareDoors + counts.drawerCount
              const tara = taraPull(handleSku)
              const name = pullName(handleSku)
              if (n === 0) {
                return tara
                  ? `${name}: отвор ${tara.c} или ${tara.c1} мм, дължина ${tara.l} мм, ${tara.color}.`
                  : 'По 1 обикновена дръжка на врата и на чекмедже.'
              }
              if (!includeHandles && Object.keys(handleOverrides).length === 0) return 'Дръжките не влизат в цената.'
              const unit = tara ? settings.hardware.handleTaraEur : settings.hardware.handleNormalEur
              const mixed = Object.keys(handleOverrides).length > 0
              return mixed
                ? 'На някои врати и чекмеджета дръжката е сменена от 3D изгледа.'
                : `${n} бр. ${name} · по 1 на врата и на чекмедже${bareDoors > 0 ? ` (без ${bareDoors} с огледало)` : ''} · ${formatEur(unit)}/бр. = ${formatEur(n * unit)}`
            })()}
          </p>
            </>
          )}
          {(isSlidingCabinet ? doorCount > 0 : counts.doorCount > 0) && (
            <MirrorFields
              id="door-mirror"
              spec={doorMirror}
              onChange={setDoorMirror}
              wholeLabel="На цялата врата"
              perM2={settings.hardware.mirrorEurPerM2}
              edgePerM={settings.hardware.mirrorEdgeEurPerM}
              doors={mirrorDoorTargets(result?.panels ?? [])}
              sample={(() => {
                const doors =
                  result?.panels.filter(
                    (panel) =>
                      (panel.role === 'door' || panel.role === 'sliding-door') &&
                      !panel.name.includes('след разрязване'),
                  ) ?? []
                const door = doors[0]
                if (!door) return null
                const copies = doors
                  .filter((panel) => panel.width === door.width && panel.height === door.height)
                  .reduce((sum, panel) => sum + panel.quantity, 0)
                return { width: door.width, height: door.height, quantity: copies }
              })()}
            />
          )}
        </FormSection>

        <FormSection defaultOpen={false}
          title="Чекмеджета"
          summary={counts.drawerCount > 0 ? `${counts.drawerCount} бр.` : 'няма'}
        >
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            Отгоре надолу в избраната част, всяко със своя височина.
          </p>
          <OverlayInsetPicker
            title="Чела"
            inset={innerDrawerFronts}
            onChange={setInnerDrawerFronts}
            overlayLabel="Външни"
            insetLabel="Вътрешни"
            overlayHint="Челото покрива канта на страниците. Фуга 1.5 мм отляво и 1.5 мм отдясно (3 мм общо)."
            insetHint="Челото влиза между страниците и е обградено от тях. Вижда се кантът им и челото започва от него — в гардероб от вътрешните страници, в шкаф от страниците. До рафт, плот или дъно започва от този кант. Отгоре 3 мм фуга, отстрани 3 мм + 3 мм."
          />
          <div className="mt-2 space-y-2">
            {drawerFrontHeights.map((value, i) => (
              <div key={`full-${i}`} className="flex items-center gap-2">
                <Label htmlFor={`drawer-h-full-${i}`} className="w-36 shrink-0 text-xs">
                  Чело {i + 1}{hasSplit ? ` · ${FULL_CABINET_LABEL}` : ''} (мм)
                </Label>
                <DraftNumber
                  id={`drawer-h-full-${i}`}
                  inputMode="numeric"
                  value={value}
                  onCommit={(n) =>
                    setDrawerFrontHeights((rows) => rows.map((v, j) => (j === i ? String(n) : v)))
                  }
                  placeholder={String(DEFAULT_DRAWER_FRONT_HEIGHT)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() =>
                    setDrawerFrontHeights((rows) => {
                      const next = rows.filter((_, j) => j !== i)
                      if (fullDrawerHasDoor) return next
                      return filledDrawerRows(drawerFrontH, next.length, false, drawerBottomGap)
                    })
                  }
                  aria-label={`Премахни чекмедже ${i + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {hasSplit &&
              layout.zones.flatMap((z) =>
                zoneOf(zoneUi, z.id).drawerFrontHeights.map((value, i) => (
                  <div key={`${z.id}-${i}`} className="flex items-center gap-2">
                    <Label htmlFor={`drawer-h-${z.id}-${i}`} className="w-36 shrink-0 text-xs">
                      Чело {i + 1} · {z.label} (мм)
                    </Label>
                      <DraftNumber
                        id={`drawer-h-${z.id}-${i}`}
                        inputMode="numeric"
                        value={value}
                        onCommit={(n) =>
                          patchZone(z.id, {
                            drawerFrontHeights: zoneOf(zoneUi, z.id).drawerFrontHeights.map((v, j) =>
                              j === i ? String(n) : v,
                            ),
                          })
                        }
                        placeholder={String(DEFAULT_DRAWER_FRONT_HEIGHT)}
                      />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        const nextRows = zoneOf(zoneUi, z.id).drawerFrontHeights.filter((_, j) => j !== i)
                        const hasDoor = isSlidingCabinet ? false : doorSpan === 'zones' && zoneOf(zoneUi, z.id).doorCount > 0
                        const hang = zoneInVanityKnee(z, kneeOpening)
                        patchZone(z.id, {
                          drawerFrontHeights: hasDoor || hang
                            ? nextRows
                            : filledDrawerRows(
                                zoneStackOpeningHeight(z, innerDrawerFronts, innerDoors),
                                nextRows.length,
                                false,
                                z.y0 <= 0.5 ? drawerBottomGap : 0,
                              ),
                        })
                      }}
                      aria-label={`Премахни чекмедже от ${z.label}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )),
              )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={pendingAdd?.kind === 'drawer' ? 'default' : 'outline'}
              disabled={!drawerRoomLeft}
              title={drawerRoomLeft ? undefined : `Във всяко отделение вече има по ${MAX_DRAWERS} чекмеджета`}
              onClick={() => startAdd({ kind: 'drawer' })}
            >
              <Plus className="h-4 w-4" />
              Добави чекмедже
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canEqualizeDrawers}
              onClick={equalizeDrawers}
            >
              Разпредели поравно
            </Button>
          </div>
          {pendingAdd?.kind === 'drawer' && (
            <WherePicker
              zones={layout.zones}
              allowFull
              onPick={applyPending}
              onCancel={() => setPendingAdd(null)}
            />
          )}
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {hasSplit
              ? [
                  fullDrawerNums.length > 0
                    ? drawerHint(drawerFrontH, fullDrawerHasDoor ? doorCount : 0, fullDrawerNums, drawerBottomGap)
                    : null,
                  ...layout.zones.map((z) => {
                    const heights = parseDrawerRows(zoneOf(zoneUi, z.id).drawerFrontHeights)
                    if (heights.length === 0) return null
                    const hasDoor = isSlidingCabinet ? false : doorSpan === 'zones' && zoneOf(zoneUi, z.id).doorCount > 0
                    return `${z.label}: ${drawerHint(zoneStackOpeningHeight(z, innerDrawerFronts, innerDoors), hasDoor ? zoneOf(zoneUi, z.id).doorCount : 0, heights, z.y0 <= 0.5 ? drawerBottomGap : 0, zoneInVanityKnee(z, kneeOpening))}`
                  }),
                ]
                  .filter(Boolean)
                  .join(' ') ||
                'Добави едно или повече чекмеджета — могат да са с различни височини, с или без врата отдолу.'
              : drawerHint(
                  drawerFrontH,
                  isSlidingCabinet ? 0 : doorCount,
                  (params as { drawerFrontHeights: number[] }).drawerFrontHeights,
                  drawerBottomGap,
                )}
          </p>
          {counts.drawerCount > 0 && (
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {drawerWidthHint(
                params.width,
                params.thickness,
                layout,
                innerDrawerFronts,
                !effectiveExternalDoors,
              )}
            </p>
          )}
        </FormSection>

        {showCombineFronts && (
          <FormSection defaultOpen={false} title="Рязане" summary={cutFromOneBoard ? 'От една плоча' : 'Отделно'}>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={cutFromOneBoard ? 'default' : 'outline'}
                onClick={() => setCutFromOneBoard(true)}
              >
                От една плоча
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!cutFromOneBoard ? 'default' : 'outline'}
                onClick={() => setCutFromOneBoard(false)}
              >
                Отделно
              </Button>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {combineHint(
                innerDrawerFronts !== innerDoors ? 0 : !hasSplit || doorSpan === 'full' ? doorCount : 0,
                cutFromOneBoard,
                adjacentCombine,
              )}
            </p>
          </FormSection>
        )}

        {counts.drawerCount > 0 && (
          <FormSection defaultOpen={false}
            title="Водачи"
            summary={`${
              slideKind === 'roller' ? 'Ролкови' : slideKind === 'soft-full' ? 'Плавно пълно' : 'Плавно частично'
            } · мерене ${DRAWER_MEASURE_LABELS[drawerMeasureLevel]}`}
          >
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Колко трудно се намира къде идват водачите — добавя се към 45 сек мерене на чекмедже, само първия път
            </p>
            <div className="mt-1 mb-3 flex flex-wrap gap-2">
              {(['easy', 'medium', 'hard'] as const).map((level) => (
                <Button
                  key={level}
                  type="button"
                  size="sm"
                  variant={drawerMeasureLevel === level ? 'default' : 'outline'}
                  onClick={() => setDrawerMeasureLevel(level)}
                >
                  {level === 'easy' ? 'Лесно' : level === 'medium' ? 'По-сложно' : 'Най-сложно'} · +
                  {DRAWER_MEASURE_SECONDS[level] < 60
                    ? `${DRAWER_MEASURE_SECONDS[level]} сек`
                    : `${Math.floor(DRAWER_MEASURE_SECONDS[level] / 60)} мин${DRAWER_MEASURE_SECONDS[level] % 60 ? ` ${DRAWER_MEASURE_SECONDS[level] % 60} сек` : ''}`}
                </Button>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              {(['roller', 'soft-full', 'soft-partial'] as const).map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  size="sm"
                  variant={slideKind === kind ? 'default' : 'outline'}
                  onClick={() => {
                    setSlideKind(kind)
                    const next = eligibleSlideLengths(slideDepth, kind)
                    if (!next.includes(slideLength)) setSlideLength(next[next.length - 1] ?? next[0])
                  }}
                >
                  {kind === 'roller' ? 'Ролкови' : kind === 'soft-full' ? 'Плавно пълно' : 'Плавно частично'}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Дължина</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {eligibleSlideLengths(slideDepth, slideKind).map((len) => (
                <Button
                  key={len}
                  type="button"
                  size="sm"
                  variant={(params as { slideLength: number }).slideLength === len ? 'default' : 'outline'}
                  onClick={() => setSlideLength(len)}
                >
                  {len}
                </Button>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {(() => {
                const fit = params as {
                  slideKind: SlideKind
                  slideLength: number
                  drawerFrontHeights: number[]
                  width: number
                  thickness: number
                }
                return (
                  <>
                    {SLIDE_KIND_LABEL[fit.slideKind]} · {fit.slideLength} мм ·{' '}
                    {SLIDES_PER_DRAWER * counts.drawerCount} бр. ×{' '}
                    {formatEur(slideUnitPriceEur(fit.slideKind, fit.slideLength, settings.hardware))} ={' '}
                    <strong>
                      {formatEur(
                        slideUnitPriceEur(fit.slideKind, fit.slideLength, settings.hardware)
                          * SLIDES_PER_DRAWER
                          * counts.drawerCount,
                      )}
                    </strong>
                    {eligibleSlideLengths(slideDepth, fit.slideKind).length === 0
                      ? ' · няма водач, който да влезе в тази дълбочина'
                      : isSlidingCabinet
                        ? ` · влиза до ${formatMm(slideDepth)} мм (вътрешна страница ${formatMm(slidePanelD)} − ${SLIDE_REAR_CLEARANCE_MM} мм луфт${slideOverlayMm > 0 ? ` − ${formatMm(slideOverlayMm)} мм външно чело` : ''})`
                        : ` · влиза в корпус ${formatMm(slideDepth)} мм`}
                    {fit.slideKind === 'roller'
                      ? ' · 3 винтчета 3.5×16 на водач'
                      : ' · 3 винтчета 3.5×16 + 4 за перките на водач'}
                  </>
                )
              })()}
            </p>
            {(() => {
              const fit = params as {
                slideKind: SlideKind
                slideLength: number
                width: number
                thickness: number
              }
              const boxes = uniqueDrawerBoxes(layout, {
                width: fit.width,
                thickness: fit.thickness,
                slideLength: fit.slideLength,
                slideKind: fit.slideKind,
              })
              const many = boxes.length > 1 || boxes.some((b) => b.count > 1)
              return boxes.map((view) => {
              const { box } = view
              const zone =
                view.label && view.label !== 'Цял шкаф' && view.label !== 'Шкаф'
                  ? ` · ${view.label}`
                  : ''
              return (
                <p
                  key={`${view.frontHeight}-${Math.round(box.drawerOuterW)}-${view.label}`}
                  className="mt-1 text-xs text-[var(--color-muted-foreground)]"
                >
                  Царги{many ? ` ${view.frontHeight} мм` : ''}{zone}: вътрешни {formatMm(box.inner.width)}×{formatMm(box.inner.height)} мм (2 бр.) · външни{' '}
                  {formatMm(box.outer.width)}×{formatMm(box.outer.height)} мм (2 бр.) · кутия {formatMm(box.drawerOuterW)} мм
                  {isSoftCloseSlide(fit.slideKind) ? ' · 5 мм луфт от страна' : ' · 12.5 мм луфт от страна'}
                </p>
              )
            })
            })()}
          </FormSection>
        )}
          </>
        )}

        {isPlinthBox && (
          <>
            {typeId === 'vanity' && (
              <FormSection
                defaultOpen
                title="Отвор за краката"
                summary={
                  knee === 'none'
                    ? 'без отвор'
                    : legSide === 'left'
                      ? `лявата е крак · отвор ${kneeWidth} мм`
                      : legSide === 'right'
                        ? `дясната е крак · отвор ${kneeWidth} мм`
                        : knee === 'left'
                          ? `отляво ${kneeWidth} мм`
                          : knee === 'right'
                            ? `отдясно ${kneeWidth} мм`
                            : `по средата ${kneeWidth} мм`
                }
              >
                <div className="mt-1 flex flex-wrap gap-2">
                  {(
                    [
                      ['middle', 'По средата'],
                      ['left', 'Отляво'],
                      ['right', 'Отдясно'],
                      ['none', 'Без отвор'],
                    ] as const
                  ).map(([id, label]) => (
                    <Button
                      key={id}
                      type="button"
                      size="sm"
                      variant={knee === id ? 'default' : 'outline'}
                      onClick={() => {
                        setKnee(id)
                        if (id !== 'none') setUseLegs(false)
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {knee !== 'none' && (
                  <>
                    <div className="mt-2 flex items-center gap-2">
                      <label htmlFor="vanity-knee" className="text-xs">
                        Широчина на отвора (мм)
                      </label>
                      <DraftNumber
                        id="vanity-knee"
                        inputMode="numeric"
                        value={kneeWidth}
                        onCommit={(n) => setKneeWidth(String(n))}
                        className="w-32"
                      />
                    </div>
                    <p className="mt-2 text-xs font-medium">Половина като крак</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(
                        [
                          ['none', 'И двете шкафчета'],
                          ['left', 'Лявата е крак'],
                          ['right', 'Дясната е крак'],
                        ] as const
                      ).map(([id, label]) => (
                        <Button
                          key={id}
                          type="button"
                          size="sm"
                          variant={legSide === id ? 'default' : 'outline'}
                          onClick={() => setLegSide(id)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <label htmlFor="vanity-rail" className="text-xs">
                        Бленда отзад (мм)
                      </label>
                      <DraftNumber
                        id="vanity-rail"
                        inputMode="numeric"
                        value={backRailHeight}
                        onCommit={(n) => setBackRailHeight(String(n))}
                        className="w-32"
                      />
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      {(() => {
                        const opening = vanityOpening({
                          width: Number(width) || 0,
                          thickness: Number(thickness) || 18,
                          knee,
                          kneeWidth: Number(kneeWidth) || 0,
                          legSide,
                        })
                        if (!opening) return ''
                        if (opening.error) return opening.error
                        const place =
                          legSide === 'left'
                            ? 'Лявата половина е една плоскост до пода. Шкафчето е отдясно.'
                            : legSide === 'right'
                              ? 'Дясната половина е една плоскост до пода. Шкафчето е отляво.'
                              : knee === 'middle'
                                ? 'Страна 1 и Страна 3 са шкафчетата. Страна 2 е отворът.'
                                : knee === 'left'
                                  ? 'Страна 1 е отворът. Страна 2 е шкафчето.'
                                  : 'Страна 1 е шкафчето. Страна 2 е отворът.'
                        return `Отвор ${formatMm(opening.knee)} мм. ${opening.pedestals
                          .map((pedestal) => `${pedestal.name} ${formatMm(pedestal.w)} мм`)
                          .join(', ')}. ${place} Чекмедже може и в отвора. Отзад бленда ${backRailHeight || VANITY_BACK_RAIL_MM} мм, широка колкото отвора, вместо гръб. Фазер имат шкафчетата.`
                      })()}
                    </p>
                  </>
                )}
                {knee === 'none' && (
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    Без отвор тоалетката е едно шкафче по цялата широчина, с цокъл или с крачета.
                  </p>
                )}
              </FormSection>
            )}
            {typeId === 'vanity' && (
              <FormSection
                defaultOpen
                title="Огледало"
                summary={
                  boardMirror.enabled
                    ? boardMirror.halo
                      ? `с осветление · ${MIRROR_HALO_LABEL[boardMirror.halo].toLowerCase()} светлина`
                      : 'без осветление'
                    : 'няма'
                }
              >
                <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  Огледалото е на плоскостта зад тоалетката, само над плота. По подразбиране почва 12 см над плота и има отстъп отгоре и отстрани. Може да е с осветление отзад (ореол).
                </p>
                <MirrorFields
                  id="board-mirror"
                  spec={boardMirror}
                  onChange={setBoardMirror}
                  wholeLabel="Над целия плот"
                  allowHalo
                  startGaps={VANITY_MIRROR_GAPS}
                  bottomHint="„Отдолу“ се мери от плота: под него плоскостта е зад плота и шкафчетата и там огледало не влиза."
                  perM2={settings.hardware.mirrorEurPerM2}
                  edgePerM={settings.hardware.mirrorEdgeEurPerM}
                  sample={(() => {
                    const board = result?.panels.find((panel) => isMirrorBoard(panel))
                    if (!board) return null
                    // Only the part above the top takes glass.
                    return { ...vanityMirrorArea(board.width, Number(thickness) || 18), quantity: board.quantity }
                  })()}
                />
              </FormSection>
            )}

            {(typeId === 'nightstand' || (typeId === 'vanity' && knee === 'none')) && (
            <FormSection defaultOpen={false} title="Опора" summary={useLegs ? 'Крачета' : 'Цокъл и дъно'}>
              <div className="mt-1 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={!useLegs ? 'default' : 'outline'}
                  onClick={() => setUseLegs(false)}
                >
                  Цокъл и дъно
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={useLegs ? 'default' : 'outline'}
                  onClick={() => setUseLegs(true)}
                >
                  Крачета
                </Button>
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {useLegs
                  ? '4 крачета под дъното, без цокъл. Дъното е външно, страниците влизат в него.'
                  : 'Цокъл с канта надолу, дъното върху него, после между страниците. Без крачета.'}
              </p>
            </FormSection>
            )}

            {(typeId === 'nightstand' || (typeId === 'vanity' && knee === 'none')) && useLegs ? (
              <FormSection defaultOpen={false} title="Крачета" summary={`${legHeight / 10} см`}>
                <div className="mt-1 flex gap-2">
                  {([100, 150] as const).map((h) => (
                    <Button
                      key={h}
                      type="button"
                      size="sm"
                      variant={legHeight === h ? 'default' : 'outline'}
                      onClick={() => setLegHeight(h)}
                    >
                      {h / 10} см
                    </Button>
                  ))}
                </div>
              </FormSection>
            ) : (
              <>
                <FormSection defaultOpen={false} title="Брой цокли" summary={String(plinthCount)}>
                  <div className="mt-1 flex gap-2">
                    {([1, 2] as const).map((n) => (
                      <Button
                        key={n}
                        type="button"
                        size="sm"
                        variant={plinthCount === n ? 'default' : 'outline'}
                        onClick={() => setPlinthCount(n)}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    Цокълът се хваща за дъното на 2 см навътре от канта
                  </p>
                </FormSection>

                <FormSection defaultOpen={false} title="Височина на цокъл (мм)" summary={`${plinthHeight} мм`}>
                  <div className="mt-1 flex items-center gap-2">
                    <DraftNumber
                      id="plinth-height"
                      inputMode="numeric"
                      value={plinthHeight}
                      onCommit={(n) => setPlinthHeight(String(n))}
                      className="w-32"
                    />
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPlinthHeight('60')}
                      >
                        60
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPlinthHeight('100')}
                      >
                        100
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    Обикновено 100 мм, може и 60 мм или друга стойност
                  </p>
                </FormSection>
              </>
            )}
          </>
        )}

        <FormSection defaultOpen={false} title="Цветове">
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            Корпусът и вратите могат да са от различни плочи. Всеки цвят се реже отделно и има своята цена.
            Кантът на корпуса е цветът на корпуса, кантът на вратите е цветът на вратите.
            Гърбът е бял фазер: бял отвътре, а отзад е с цвета на самия фазер.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              Корпус
              <select
                className="h-9 rounded-md border border-[var(--color-border)] bg-transparent px-2 text-sm"
                value={carcassFinishId}
                onChange={(e) => chooseFinish(e.target.value, 'carcass')}
              >
                <option value="">Обикновена плоча</option>
                <KronospanFinishOptions finishes={settings.hardware.boardFinishes} />
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Врати и чела
              <select
                className="h-9 rounded-md border border-[var(--color-border)] bg-transparent px-2 text-sm"
                value={frontFinishId}
                onChange={(e) => chooseFinish(e.target.value, 'front')}
              >
                <option value="">Като корпуса</option>
                <KronospanFinishOptions finishes={settings.hardware.boardFinishes} />
              </select>
            </label>
            <div className="flex flex-col gap-1 text-xs">
              Гръб
              <span className="flex h-9 items-center rounded-md border border-[var(--color-border)] px-2 text-sm">
                Бял фазер
              </span>
            </div>
          </div>
          <div className="mt-3 rounded-md border border-[var(--color-border)] p-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Цветът, който избереш отдолу, е за:</span>
              <div role="radiogroup" aria-label="Цветът отдолу е за" className="inline-flex overflow-hidden rounded-md border border-[var(--color-border)]">
                {(
                  [
                    ['carcass', 'Корпуса'],
                    ['front', 'Вратите и челата'],
                  ] as const
                ).map(([key, name]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={swatchTarget === key}
                    onClick={() => setSwatchTarget(key)}
                    className={cn(
                      'px-3 py-1 text-sm',
                      swatchTarget === key
                        ? 'bg-[var(--color-foreground)] text-[var(--color-background)]'
                        : 'hover:bg-[var(--color-muted)]',
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2">
              <KronospanColorGrid
                finishes={settings.hardware.boardFinishes}
                selectedCode={kronospanCodeFromFinish({
                  id: swatchTarget === 'carcass' ? carcassFinishId : frontFinishId,
                })}
                selectedId={swatchTarget === 'carcass' ? carcassFinishId : frontFinishId}
                onPick={(board) => pickBoard(board, swatchTarget)}
              />
            </div>
            {swatchTarget === 'carcass' && (
              <div className="mt-2">
                <KronospanCombinationRow
                  code={kronospanCodeFromFinish({ id: carcassFinishId })}
                  hint="Подходящи за вратите. Натисни, за да стане цвят на вратите"
                  onPick={(swatch) => pickKronospan(swatch, 'front')}
                />
              </div>
            )}
          </div>
          <div className="mt-3 rounded-md border border-[var(--color-border)] p-2 text-sm">
            <p className="font-medium">Детайли със свой цвят</p>
            <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
              В „3D само шкафа“ натисни с десния бутон на страница, врата, дъно или друг детайл и му избери цвят.
              Той остава такъв, дори да смениш цвета на корпуса или вратите.
            </p>
            {Object.keys(pieceFinishes).length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {Object.entries(pieceFinishes).map(([piece, id]) => {
                  const finish = finishFor(id)
                  return (
                    <li key={piece} className="flex items-center gap-2">
                      <span aria-hidden className="h-4 w-4 shrink-0 rounded border border-[var(--color-border)]" style={{ background: finish?.color }} />
                      <span className="min-w-0 flex-1 truncate">
                        🔒 {pieceColorLabel(piece)} · {finish?.name ?? id}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setPieceFinishes((now) => {
                            const next = { ...now }
                            delete next[piece]
                            return next
                          })
                        }
                      >
                        Като останалите
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
            По подразбиране плоскостите на чертежа са еднакви. Смени само ако трябва да се отличават в сегашния изглед.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {PART_COLOR_FIELDS.filter(({ key }) => {
              if (typeId === 'kitchen-wall') {
                if (key === 'leg') return false
                if (key === 'shelf' && counts.shelfCount === 0 && counts.fixedShelves === 0) return false
              }
              if (typeId === 'nightstand' || typeId === 'vanity' || typeId === 'section' || typeId === 'wardrobe') {
                if (key === 'shelf' && counts.shelfCount === 0 && counts.fixedShelves === 0) return false
                if (key === 'leg' && (typeId === 'section' || typeId === 'wardrobe' || (typeId === 'vanity' && knee !== 'none') || !useLegs)) return false
              }
              return true
            }).map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 text-xs">
                <input
                  type="color"
                  value={colors[key]}
                  onChange={(e) => setColors((c) => ({ ...c, [key]: e.target.value }))}
                  className="h-7 w-8 cursor-pointer rounded border border-[var(--color-border)] bg-transparent"
                  title={label}
                />
                {key === 'rail' && (typeId === 'nightstand' || typeId === 'section' || typeId === 'wardrobe' || typeId === 'kitchen-wall')
                  ? 'Плот'
                  : label}
              </label>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setColors({ ...DEFAULT_PART_COLORS })
                setPieceFinishes({})
                setPickedPiece(null)
              }}
            >
              Еднакви
            </Button>
          </div>
        </FormSection>

        <div id="cabinet-join" className="rounded-md border border-[var(--color-border)] px-3 py-2">
          <p className="text-sm font-medium">Шкафове от проекта</p>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            Като добавиш още един шкаф, минаваш на комбинацията. Тя се записва отделно, без цена, и не ляга върху текущия шкаф. Промените по нея се записват върху оригиналните шкафове.
          </p>
          {projectCabinets.filter((cabinet) => cabinet.id !== editing?.id && !isCombinationType(cabinet.typeId) && !lockedCabinetIds.includes(cabinet.id)).length === 0 && attached.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Няма друг записан шкаф в проекта.</p>
          ) : (
            <>
              {attachedGuests.map(({ row, cabinet }, index) => {
                const touches = attachmentTouchesHost(
                  attachedGuests.map((item) => item.row),
                  index,
                )
                return (
                  <div key={row.cabinetId} className="mt-3 border-t border-[var(--color-border)] pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{cabinet.name}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setAttached((rows) => rows.filter((item) => item.cabinetId !== row.cabinetId))}
                      >
                        Махни
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(
                        [
                          ['left', 'Отляво'],
                          ['right', 'Отдясно'],
                          ['above', 'Отгоре'],
                          ['below', 'Отдолу'],
                        ] as const
                      ).map(([id, label]) => (
                        <Button
                          key={id}
                          type="button"
                          size="sm"
                          variant={row.place === id ? 'default' : 'outline'}
                          onClick={() =>
                            setAttached((rows) =>
                              rows.map((item) => (item.cabinetId === row.cabinetId ? { ...item, place: id } : item)),
                            )
                          }
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs">Да се хване ли с винтчета 4×30?</p>
                    <div className="mt-1 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={row.joinScrews ? 'default' : 'outline'}
                        onClick={() =>
                          setAttached((rows) =>
                            rows.map((item) => (item.cabinetId === row.cabinetId ? { ...item, joinScrews: true } : item)),
                          )
                        }
                      >
                        Да, с 4×30
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={!row.joinScrews ? 'default' : 'outline'}
                        onClick={() =>
                          setAttached((rows) =>
                            rows.map((item) => (item.cabinetId === row.cabinetId ? { ...item, joinScrews: false } : item)),
                          )
                        }
                      >
                        Без винтчета
                      </Button>
                    </div>
                    {touches && (
                      <div className="mt-2">
                        <p className="text-xs">Врати отгоре до долу</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {[0, 1, 2, 3, 4].map((count) => (
                            <Button
                              key={count}
                              type="button"
                              size="sm"
                              variant={spanDoorCountOf(row) === count ? 'default' : 'outline'}
                              onClick={() =>
                                setAttached((rows) =>
                                  rows.map((item) =>
                                    item.cabinetId === row.cabinetId
                                      ? { ...item, spanDoor: count > 0, spanDoorCount: count }
                                      : item,
                                  ),
                                )
                              }
                            >
                              {count === 0 ? 'Без' : String(count)}
                            </Button>
                          ))}
                        </div>
                        <label className="mt-2 flex items-center gap-2 text-xs">
                          Брой
                          <DraftNumber
                            className="h-8 w-16"
                            inputMode="numeric"
                            value={spanDoorCountOf(row)}
                            onCommit={(n) => {
                              const count = Math.max(0, Math.min(12, Math.round(n)))
                              setAttached((rows) =>
                                rows.map((item) =>
                                  item.cabinetId === row.cabinetId
                                    ? { ...item, spanDoor: count > 0, spanDoorCount: count }
                                    : item,
                                ),
                              )
                            }}
                          />
                        </label>
                        {spanDoorCountOf(row) > 0 && (
                          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                            {spanDoorCountOf(row) === 1 ? 'Една врата' : `${spanDoorCountOf(row)} врати`} покриват двата шкафа отгоре до долу и се делят по широчина. Вратите на този шкаф не влизат в разкроя. Вратите на другия шкаф си остават в неговия списък.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {projectCabinets.some((cabinet) => cabinet.id !== editing?.id && !isCombinationType(cabinet.typeId) && !lockedCabinetIds.includes(cabinet.id) && !attached.some((row) => row.cabinetId === cabinet.id)) && (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  Добави
                  <select
                    className="h-8 min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-transparent px-2"
                    value=""
                    onChange={(e) => {
                      const cabinetId = e.target.value
                      if (!cabinetId) return
                      setAttached((rows) =>
                        rows.some((row) => row.cabinetId === cabinetId)
                          ? rows
                          : [...rows, { cabinetId, place: 'right', joinScrews: false, spanDoor: false, spanDoorCount: 0 }],
                      )
                    }}
                  >
                    <option value="">Избери шкаф</option>
                    {projectCabinets
                      .filter((cabinet) => cabinet.id !== editing?.id && !isCombinationType(cabinet.typeId) && !lockedCabinetIds.includes(cabinet.id) && !attached.some((row) => row.cabinetId === cabinet.id))
                      .map((cabinet) => (
                        <option key={cabinet.id} value={cabinet.id}>
                          {cabinet.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </>
          )}
        </div>

        {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}

        {result && estimate && (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-muted-foreground)]">
                    <th className="border-b border-[var(--color-border)] px-3 py-2">Детайл</th>
                    <th className="border-b border-[var(--color-border)] px-3 py-2">Размер</th>
                    <th className="border-b border-[var(--color-border)] px-3 py-2">Бр.</th>
                    <th className="border-b border-[var(--color-border)] px-3 py-2">Кант</th>
                  </tr>
                </thead>
                <tbody>
                  {result.panels.map((panel, idx) => {
                    const isRed = panel.highlightColor === 'red'
                    const isOrder = isBuyoutDoorPanel(panel)
                    const prevRed = idx > 0 && result.panels[idx - 1].highlightColor === 'red'
                    const nextRed = idx < result.panels.length - 1 && result.panels[idx + 1].highlightColor === 'red'
                    const isGroupStart = isRed && !prevRed
                    const isGroupEnd = isRed && !nextRed
                    const groupEdge = (side: 'first' | 'mid' | 'last') =>
                      cn(
                        !isRed && !isOrder && 'border-b border-[var(--color-border)]/50',
                        isRed && '!border-red-500',
                        isOrder && '!border-amber-500',
                        isRed && side === 'first' && 'border-l-2',
                        isRed && side === 'last' && 'border-r-2',
                        isOrder && side === 'first' && 'border-l-2',
                        isOrder && side === 'last' && 'border-r-2',
                        isGroupStart && 'border-t-2',
                        isGroupEnd && 'border-b-2',
                        isOrder && side === 'first' && 'border-t-2',
                        isOrder && side === 'last' && 'border-b-2',
                      )
                    return (
                    <tr
                      key={`${panel.role}-${idx}`}
                      className={cn(isRed && 'text-red-400', isOrder && 'text-amber-600')}
                    >
                      <td className={cn('px-3 py-2 font-medium', groupEdge('first'))}>
                        {panel.name}
                        {panel.finishId
                          ? ` · ${finishFor(panel.finishId)?.name ?? ''}`
                          : ''}
                      </td>
                      <td className={cn('px-3 py-2 tabular-nums', groupEdge('mid'))}>
                        {formatMm(panel.width)} × {formatMm(panel.height)} мм
                      </td>
                      <td className={cn('px-3 py-2', groupEdge('mid'))}>
                        {panel.quantity}
                      </td>
                      <td className={cn(
                        'px-3 py-2 text-xs',
                        isRed ? 'text-red-400/70' : isOrder ? 'text-amber-700/80' : 'text-[var(--color-muted-foreground)]',
                        groupEdge('last'),
                      )}>
                        {panel.note}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3 rounded-md bg-[var(--color-secondary)] px-3 py-2 text-sm">
              <span>
                ПДЧ: <strong>{formatArea(estimate.chipboardAreaM2)}</strong>
              </span>
              {estimate.hardboardAreaM2 > 0 && (
                <span>
                  Фазер: <strong>{formatArea(estimate.hardboardAreaM2)}</strong>
                </span>
              )}
              <span>
                Кант 2 мм: <strong>{formatMeters(estimate.edgeMm2)}</strong>
              </span>
              {estimate.edgeMm05 > 0 && (
                <span>
                  Кант 0.5 мм: <strong>{formatMeters(estimate.edgeMm05)}</strong>
                </span>
              )}
              <span>
                Детайли: <strong>{estimate.partCount} бр.</strong>
              </span>
            </div>

            {result.panels.some(isBuyoutDoorPanel) && (
              <p className="text-xs text-amber-700">
                Външните врати и чела са отделени в списъка (поръчай) и не влизат в разкроя.
              </p>
            )}
            {result.hardware.length > 0 && (
              <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted-foreground)]">
                      <th className="px-3 py-2">Фурнитура</th>
                      <th className="px-3 py-2">Бр.</th>
                      <th className="px-3 py-2">Цена</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.hardware.map((h, i) => (
                      <tr key={`${h.id ?? h.name}-${i}`} className="border-b border-[var(--color-border)]/50">
                        <td className="px-3 py-2">
                          <span className="font-medium">{h.name}</span>
                          {h.note && (
                            <span className="ml-1 text-xs text-[var(--color-muted-foreground)]">
                              · {h.note}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{h.quantity}</td>
                        <td className="px-3 py-2 tabular-nums text-xs">
                          {h.unitPriceEur != null
                            ? formatEur(h.unitPriceEur * h.quantity)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {breakdown && <PriceBreakdownView breakdown={breakdown} />}

            <ul className="list-inside list-disc text-xs text-[var(--color-muted-foreground)]">
              {result.notes.map((n, i) => (
                <li key={`${i}:${n}`}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        {threeDoorCheck && threeDoorCheck.issues.length > 0 && (
          <p className="text-xs text-red-300">
            Гардеробът не се записва, докато страните и чекмеджетата не се обслужват при отворени врати.
          </p>
        )}
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={!!error || (threeDoorCheck != null && threeDoorCheck.issues.length > 0)}
        >
          <Box className="h-4 w-4" />
          {isEdit ? 'Запази промените' : 'Добави в разкроя'}
        </Button>
    </>
  )
  const projectRoom: ProjectRoom = {
    room,
    cabinets: projectCabinets,
    finishes: settings.hardware.boardFinishes,
    replaceIds: [...roomPieceIds, ...(editing?.id ? [editing.id] : []), ...attached.map((row) => row.cabinetId)],
    anchorIds: [...roomPieceIds, ...(editing?.id ? [editing.id] : []), ...attached.map((row) => row.cabinetId)],
    group: attached.length > 0 || roomPieceIds.length > 0,
    typeId,
  }
  // Without a room the picture is the cabinet alone, where doors and handles can be clicked.
  // Right click on a piece in 3D gives it its own board. It keeps it when the carcass or doors change.
  const pieceColorChoice: PieceColorChoice = {
    finishes: settings.hardware.boardFinishes,
    current: (piece) => pieceFinishes[piece] ?? '',
    choose: (piece, id) => {
      if (id) rememberKronospan(id)
      setPieceFinishes((now) => {
        const next = { ...now }
        if (id) next[piece] = id
        else delete next[piece]
        return next
      })
    },
    label: pieceColorLabel,
  }
  const pictured = (
    <PieceColorChoiceContext.Provider value={pieceColorChoice}>
      <ProjectRoomContext.Provider value={withRoom && !assemblyFilm ? projectRoom : null}>
        <AssemblyFilmContext.Provider
          value={assemblyFilm && drawStyle === 'model' ? { steps: result?.labor.assemblySteps ?? [], dailyRateEur, slideKind } : null}
        >
          {dialogBody}
        </AssemblyFilmContext.Provider>
      </ProjectRoomContext.Provider>
    </PieceColorChoiceContext.Provider>
  )
  if (bare) return pictured
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">{pictured}</DialogContent>
    </Dialog>
  )
}

const HOST_TAB = 'host'

export function CabinetDialog(props: CabinetDialogProps) {
  const combination = props.editing && isCombinationType(props.editing.typeId) ? parseCombination(props.editing.params) : null
  const hostCabinetId = combination ? combination.hostId : props.editing?.id ?? null
  const hostCabinet = hostCabinetId ? props.projectCabinets?.find((cabinet) => cabinet.id === hostCabinetId) ?? null : null
  const [active, setActive] = useState(HOST_TAB)
  const [drafts, setDrafts] = useState<Record<string, CabinetDraft>>({})
  const [attached, setAttached] = useState<AttachedCabinet[]>(() =>
    combination
      ? combination.members
          .filter((member) => member.place !== 'host')
          .map((member) => ({
            cabinetId: member.cabinetId,
            place: member.place === 'host' ? 'right' : member.place,
            joinScrews: member.joinScrews,
            spanDoor: member.spanDoor,
            spanDoorCount: member.spanDoorCount,
          }))
      : (props.startAttached ?? []),
  )
  useEffect(() => {
    if (!props.startAttached?.length) return
    const timer = window.setTimeout(() => {
      document.getElementById('cabinet-join')?.scrollIntoView({ block: 'center' })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [])
  const changeAttached = (rows: AttachedCabinet[]) => {
    setAttached((prev) => {
      if (prev.length === 0 && rows.length > 0) {
        window.setTimeout(() => {
          document.getElementById('combination-tabs')?.scrollIntoView({ block: 'start' })
        }, 0)
      }
      return rows
    })
  }
  const onLiveChange = (draft: CabinetDraft) => {
    setDrafts((prev) => {
      const key = active
      const current = prev[key]
      if (
        current &&
        current.typeId === draft.typeId &&
        current.quantity === draft.quantity &&
        JSON.stringify(current.params) === JSON.stringify(draft.params)
      ) {
        return prev
      }
      return { ...prev, [key]: draft }
    })
  }
  const tabs = [
    { id: HOST_TAB, label: 'Шкаф 1', hint: hostCabinet?.name ?? 'Този шкаф' },
    ...attached.map((row, index) => ({
      id: row.cabinetId,
      label: `Шкаф ${index + 2}`,
      hint: props.projectCabinets?.find((cabinet) => cabinet.id === row.cabinetId)?.name ?? '',
    })),
  ]
  const formEditing = (): CabinetInstance | null => {
    if (active === HOST_TAB) {
      const draft = drafts[HOST_TAB]
      if (draft && hostCabinet) return { ...hostCabinet, typeId: draft.typeId, params: draft.params, quantity: draft.quantity }
      if (draft) {
        return { id: 'draft', typeId: draft.typeId, name: '', quantity: draft.quantity, params: draft.params, partIds: [] }
      }
      return combination ? hostCabinet : props.editing ?? null
    }
    const cabinet = props.projectCabinets?.find((item) => item.id === active)
    if (!cabinet) return null
    const draft = drafts[active]
    return draft ? { ...cabinet, typeId: draft.typeId, params: draft.params, quantity: draft.quantity } : cabinet
  }
  const save = (input: CabinetDraft) => {
    const merged = { ...drafts, [active]: input }
    if (attached.length === 0) {
      if (combination && hostCabinetId) {
        const host = merged[HOST_TAB] ?? (hostCabinet
          ? { typeId: hostCabinet.typeId, params: hostCabinet.params, quantity: hostCabinet.quantity }
          : input)
        props.onSaveGroup?.({
          host: { id: hostCabinetId, typeId: host.typeId, params: host.params, quantity: host.quantity },
          guests: [],
          combinationId: props.editing?.id ?? null,
        })
        if (!props.onSaveGroup) props.onSave(input)
        return
      }
      props.onSave(input)
      return
    }
    const host = active === HOST_TAB ? input : merged[HOST_TAB]
    if (!host) return
    props.onSaveGroup?.({
      host: { id: hostCabinetId, typeId: host.typeId, params: host.params, quantity: host.quantity },
      guests: attached.flatMap((row) => {
        const cabinet = props.projectCabinets?.find((item) => item.id === row.cabinetId)
        const draft = row.cabinetId === active ? input : merged[row.cabinetId]
        if (!cabinet && !draft) return []
        return [{
          id: row.cabinetId,
          typeId: draft?.typeId ?? cabinet!.typeId,
          params: draft?.params ?? cabinet!.params,
          quantity: draft?.quantity ?? cabinet!.quantity,
          place: row.place,
          joinScrews: row.joinScrews,
          spanDoor: row.spanDoor,
          spanDoorCount: row.spanDoorCount,
        }]
      }),
      combinationId: combination ? props.editing?.id ?? null : null,
    })
    if (!props.onSaveGroup) props.onSave(input)
  }
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        {attached.length > 0 && (
          <div id="combination-tabs" className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                size="sm"
                variant={active === tab.id ? 'default' : 'outline'}
                onClick={() => setActive(tab.id)}
              >
                {tab.label}
                {tab.hint ? <span className="ml-1 font-normal opacity-80">{tab.hint}</span> : null}
              </Button>
            ))}
          </div>
        )}
        <CabinetDialogForm
          key={active}
          {...props}
          roomPieceIds={combination && props.editing ? [props.editing.id] : []}
          bare
          editing={formEditing()}
          treatAsNew={active === HOST_TAB && !hostCabinetId}
          stampAttached={false}
          attachedRows={attached}
          onAttachedRows={changeAttached}
          onLiveChange={onLiveChange}
          peerDrafts={drafts}
          groupRole={active === HOST_TAB ? 'host' : 'guest'}
          lockedCabinetIds={hostCabinetId ? [hostCabinetId] : []}
          onSave={save}
        />
      </DialogContent>
    </Dialog>
  )
}

function DoorSourcePicker({
  external,
  projectForced,
  onChange,
}: {
  external: boolean
  projectForced: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="mt-2">
      <p className="text-xs font-medium">Откъде са вратите и челата?</p>
      <div className="mt-1 flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={projectForced}
          variant={!external ? 'default' : 'outline'}
          onClick={() => onChange(false)}
        >
          Нашите
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={projectForced}
          variant={external ? 'default' : 'outline'}
          onClick={() => onChange(true)}
        >
          Външни
        </Button>
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        {projectForced
          ? 'В проекта всички врати и чела са външни — поръчват се отделно.'
          : external
            ? 'Готов размер (само фуги). Не влизат в разкроя и засега нямат цена. Без ръбчета и фреза — остава пробиване на панти и слагане на чело.'
            : 'Режат се и се кантират при нас.'}
      </p>
    </div>
  )
}

function heightPartCaption(
  o: { index: number; label: string },
  openingCount: number,
  kind: { hasShelf: boolean; hasRail: boolean },
): string {
  if (openingCount === 2) {
    if (kind.hasRail && !kind.hasShelf) return o.index === 0 ? 'под лоста' : 'над лоста'
    if (kind.hasShelf && !kind.hasRail) return o.index === 0 ? 'под рафта' : 'над рафта'
  }
  return o.label
}

function WherePicker({
  zones,
  extras,
  allowFull,
  hint,
  onPick,
  onCancel,
}: {
  zones: { id: CabinetZoneId; label: string }[]
  extras?: { id: string; label: string }[]
  allowFull: boolean
  hint?: string
  onPick: (target: FrontTarget) => void
  onCancel: () => void
}) {
  return (
    <div className="mt-2 rounded-md border border-[var(--color-border)] p-2">
      <p className="text-xs font-medium">В коя част?</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {extras?.map((z) => (
          <Button key={z.id} type="button" size="sm" variant="outline" onClick={() => onPick(z.id)}>
            {z.label}
          </Button>
        ))}
        {zones.map((z) => (
          <Button key={z.id} type="button" size="sm" variant="outline" onClick={() => onPick(z.id)}>
            {z.label}
          </Button>
        ))}
        {allowFull && (
          <Button type="button" size="sm" variant="outline" onClick={() => onPick('full')}>
            {FULL_CABINET_LABEL}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Отказ
        </Button>
      </div>
      {hint && <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{hint}</p>}
    </div>
  )
}

function parsePinGapTarget(target: string): { zoneId: string | null; gapIndex: number } | null {
  const m = /^pin-gap:(?:(.+):)?(\d+)$/.exec(target)
  if (!m) return null
  return { zoneId: m[1] ?? null, gapIndex: Number(m[2]) }
}

function parseRailGapTarget(target: string): { zoneId: string | null; gapIndex: number } | null {
  const m = /^rail-gap:(?:(.+):)?(\d+)$/.exec(target)
  if (!m) return null
  return { zoneId: m[1] ?? null, gapIndex: Number(m[2]) }
}

function largestOpeningIndex(openings: { start: number; end: number }[]): number | undefined {
  if (openings.length < 2) return undefined
  let best = 0
  for (let i = 1; i < openings.length; i++) {
    if (openings[i]!.end - openings[i]!.start > openings[best]!.end - openings[best]!.start) best = i
  }
  return best
}

function parseBetweenTarget(target: string): { colIndex: number; pairIndex: number } | null {
  const m = /^mid:(\d+):(\d+)$/.exec(target)
  if (!m) return null
  return { colIndex: Number(m[1]), pairIndex: Number(m[2]) }
}

function rowBetweenWord(z: { id: string }): string {
  if (z.id === 'top' || z.id.endsWith('-top')) return 'горната'
  if (z.id === 'middle' || z.id.endsWith('-middle')) return 'средната'
  return 'долната'
}

function betweenRowExtras(
  zones: InteriorLayout['zones'],
  colCount: number,
): { id: string; label: string }[] {
  const byCol = new Map<number, InteriorLayout['zones']>()
  for (const z of zones) {
    const c = z.colIndex ?? 0
    const arr = byCol.get(c) ?? []
    arr.push(z)
    byCol.set(c, arr)
  }
  const extra: { id: string; label: string }[] = []
  const multiCol = byCol.size > 1 || colCount > 1
  for (const [c, rows] of [...byCol.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...rows].sort((a, b) => a.y0 - b.y0)
    if (sorted.length < 2) continue
    for (let i = 0; i < sorted.length - 1; i++) {
      const lower = sorted[i]
      const upper = sorted[i + 1]
      const between = `между ${rowBetweenWord(lower)} и ${rowBetweenWord(upper)}`
      const prefix = multiCol
        ? `${columnLabel(c, Math.max(colCount, byCol.size), sorted[0]?.path)}: `
        : ''
      extra.push({
        id: `mid:${c}:${i}`,
        label: prefix ? `${prefix}${between}` : `Между ${rowBetweenWord(lower)} и ${rowBetweenWord(upper)}`,
      })
    }
  }
  return extra
}

function zoneForBetweenPair(
  zones: InteriorLayout['zones'],
  colIndex: number,
  pairIndex: number,
): InteriorLayout['zones'][number] | undefined {
  const rows = zones.filter((z) => (z.colIndex ?? 0) === colIndex).sort((a, b) => a.y0 - b.y0)
  // The opening between the two parts sits on the shared fixed shelf — that is the upper
  // compartment (between the upper pin shelf and the fixed shelf below it).
  return rows[pairIndex + 1] ?? rows[pairIndex]
}

function OverlayInsetPicker({
  title,
  inset,
  onChange,
  overlayLabel,
  insetLabel,
  overlayHint,
  insetHint,
}: {
  title?: string
  inset: boolean
  onChange: (value: boolean) => void
  overlayLabel: string
  insetLabel: string
  overlayHint: string
  insetHint: string
}) {
  return (
    <div className="mt-2">
      {title ? <p className="text-xs font-medium">{title}</p> : null}
      <div className="mt-1 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={!inset ? 'default' : 'outline'}
          onClick={() => onChange(false)}
        >
          {overlayLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={inset ? 'default' : 'outline'}
          onClick={() => onChange(true)}
        >
          {insetLabel}
        </Button>
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{inset ? insetHint : overlayHint}</p>
    </div>
  )
}

function doorSizeHint(
  width: number,
  frontH: number,
  layout: InteriorLayout,
  drawerFrontHeights: string[],
  doorCount: DoorCount,
  doorSpan: DoorSpan,
  subtractEdge = true,
  inset = false,
  thickness = 18,
): string {
  const fullDrawers = drawerFrontHeights.map((s) => parseInt(s, 10) || 0).filter((n) => n > 0)
  const edge = subtractEdge ? DOOR_EDGE_BOTH : 0
  const cutOpts = {
    ...(subtractEdge ? {} : { subtractEdge: false as const }),
    ...(inset ? { inset: true as const } : {}),
  }
  const innerW = Math.max(0, width - 2 * thickness)
  const parts: string[] = []
  const fullLeaves = doorLeafCount(doorCount)
  if (doorSpan === 'full' && fullLeaves) {
    const leftover = remainingFrontHeight(frontH, fullDrawers, true)
    if (leftover <= edge) parts.push('Няма място за врата на целия шкаф.')
    else {
      const opening = inset ? innerW : width
      const d = doorCutSize(opening, frontH, fullLeaves, cutOpts)
      parts.push(
        `Цял шкаф: ${subtractEdge ? 'рязане' : 'поръчай'} ${formatMm(d.width)} × ${formatMm(leftover - edge)} мм · ${doorCutRuleNote({ withDrawerGaps: fullDrawers.length > 0, subtractEdge, insetFront: inset })}`,
      )
    }
  }
  for (const z of layout.zones) {
    if (layout.shelves.length === 0 && layout.partitions.length === 0) continue
    const zoneLeaves = doorLeafCount(z.doorCount)
    if (!zoneLeaves) continue
    const openingH = inset ? z.innerH : z.frontHeight
    const leftover = remainingFrontHeight(openingH, z.drawerFrontHeights, true)
    if (leftover <= edge) {
      parts.push(`${z.label}: няма място за врата.`)
      continue
    }
    const overlayW = z.frontWidth > 0 ? z.frontWidth : width
    const opening = inset ? (z.innerW > 0 ? z.innerW : innerW) : overlayW
    const d = doorCutSize(opening, leftover + DOOR_CLEARANCE_TOP, zoneLeaves, cutOpts)
    parts.push(
      `${z.label}: ${subtractEdge ? 'рязане' : 'поръчай'} ${formatMm(d.width)} × ${formatMm(leftover - edge)} мм (отвор ${formatMm(openingH)} мм, ${doorCutRuleNote({ subtractEdge, insetFront: inset })})`,
    )
  }
  return parts.join(' ')
}

function drawerWidthHint(
  cabinetWidth: number,
  thickness: number,
  layout: InteriorLayout,
  inset: boolean,
  subtractEdge: boolean,
): string {
  const opts = {
    inset,
    ...(subtractEdge ? {} : { subtractEdge: false as const }),
  }
  const verb = subtractEdge ? 'рязане' : 'поръчай'
  const parts: string[] = []
  if (layout.fullDrawerFrontHeights.length > 0) {
    const opening = inset ? Math.max(0, cabinetWidth - 2 * thickness) : cabinetWidth
    const h = layout.fullDrawerFrontHeights[0]
    const cut = drawerFrontCutSize(opening, h, opts)
    parts.push(
      `Цял шкаф: ${verb} ${formatMm(cut.width)} мм широчина (${doorCutRuleNote({ insetFront: inset, subtractEdge })}).`,
    )
  }
  for (const z of layout.zones) {
    if (z.drawerFrontHeights.length === 0) continue
    if (layout.shelves.length === 0 && layout.partitions.length === 0 && layout.fullDrawerFrontHeights.length > 0) {
      continue
    }
    const overlayW = z.frontWidth > 0 ? z.frontWidth : cabinetWidth
    const opening = inset ? (z.innerW > 0 ? z.innerW : Math.max(0, cabinetWidth - 2 * thickness)) : overlayW
    const cut = drawerFrontCutSize(opening, z.drawerFrontHeights[0], opts)
    parts.push(
      `${z.label}: ${verb} ${formatMm(cut.width)} мм широчина.`,
    )
  }
  return parts.join(' ')
}

function validate(
  typeId: string,
  p: {
    width: number
    height: number
    depth: number
    thickness: number
    drawerFrontHeights: number[]
    doorCount: number
    doorStyle?: DoorStyle
    useLegs?: boolean
    legHeight?: number
    plinthHeight?: number
  },
  layout: InteriorLayout,
  frontH: number,
  clearanceBottom = 0,
  inset?: { drawers?: boolean; doors?: boolean; innerH?: number },
): string | null {
  if (typeId === 'bed') return bedError(parseBedParams(p as unknown as Record<string, unknown>))
  if (typeId !== 'kitchen-base' && typeId !== 'kitchen-wall' && typeId !== 'nightstand' && typeId !== 'vanity' && typeId !== 'section' && typeId !== 'wardrobe') return null
  if (typeId === 'vanity') {
    const kneeErr = vanityKneeError(p as VanityParams, layout)
    if (kneeErr) return kneeErr
  }
  if (p.width <= p.thickness * 2) return 'Ширината трябва да е по-голяма от двете страници.'
  if (p.height <= p.thickness + 20) return 'Височината на корпуса е твърде малка.'
  if (p.depth <= 0 || p.width <= 0) return 'Въведи валидни размери.'
  if (p.thickness < 8 || p.thickness > 36) return 'Дебелината на плоскостта трябва да е между 8 и 36 мм.'
  const minFront = DRAWER_RAIL_BELOW_FRONT + 20
  const allDrawers = allDrawerFrontHeights(layout)
  for (const h of allDrawers) {
    if (h < minFront) return `Челото на чекмеджето трябва да е поне ${minFront} мм.`
  }
  const sliding = p.doorStyle === 'sliding' || typeId === 'wardrobe'
  const hingedDoors = sliding ? 0 : p.doorCount
  const zoneErr = validateZoneFronts(layout, frontH, clearanceBottom, inset)
  if (zoneErr) return zoneErr
  if (layout.shelves.length === 0 && layout.partitions.length === 0) {
    const opening = frontStackOpeningHeight(frontH, inset?.innerH ?? frontH, {
      insetDrawers: inset?.drawers,
      insetDoors: inset?.doors,
      hasDrawers: p.drawerFrontHeights.length > 0,
      hasDoors: hingedDoors > 0,
    })
    const leftover = remainingFrontHeight(opening, p.drawerFrontHeights, hingedDoors > 0, clearanceBottom)
    if (leftover < 0) {
      return clearanceBottom > 0
        ? `Челата на чекмеджетата не събират във височината (фуга ${DOOR_CLEARANCE_TOP} мм отгоре, ${clearanceBottom} мм от дъното заради релсата и ${DRAWER_DOOR_GAP} мм между тях).`
        : `Челата на чекмеджетата не събират във височината на корпуса (фуга ${DOOR_CLEARANCE_TOP} мм отгоре и ${DRAWER_DOOR_GAP} мм между тях).`
    }
    if (hingedDoors > 0 && leftover < 80) return 'Останалата височина за вратата е твърде малка.'
  }
  return null
}

function drawerHint(
  frontHeight: number,
  doorCount: number,
  drawerFrontHeights: number[],
  clearanceBottom = 0,
  fromTop = false,
): string {
  if (drawerFrontHeights.length === 0) {
    return 'Добави едно или повече чекмеджета — могат да са с различни височини, с или без врата отдолу.'
  }
  const leftover = remainingFrontHeight(frontHeight, drawerFrontHeights, doorCount > 0, clearanceBottom)
  const bottomNote =
    clearanceBottom > 0
      ? `${clearanceBottom} мм от дъното заради долната релса (челото почва оттам, без още 3 мм фуга)`
      : null
  if (doorCount > 0) {
    return leftover > 0
      ? `Вратата отдолу е ${formatMm(leftover)} мм. ${doorCutRuleNote({ withDrawerGaps: true })}.`
      : 'Челата заемат целия корпус — няма място за врата.'
  }
  if (leftover > 4) {
    if (fromTop) {
      return `Чекмеджето почва отгоре, под плота. Отдолу остават ${formatMm(leftover)} мм.`
    }
    return leftover >= 80
      ? `Остават ${formatMm(leftover)} мм. „Разпредели поравно“ ги слага в челата (фуга ${DOOR_CLEARANCE_TOP} мм отгоре, ${DRAWER_DOOR_GAP} мм между тях${bottomNote ? `, ${bottomNote}` : ''}) или добави врата отдолу.`
      : `Остават ${formatMm(leftover)} мм. Натисни „Разпредели поравно“, за да влязат в челата с фугите.`
  }
  if (leftover < 0) return 'Челата излизат над корпуса.'
  return bottomNote
    ? `Челата запълват корпуса. Фуга ${DOOR_CLEARANCE_TOP} мм отгоре, ${bottomNote}, ${DRAWER_DOOR_GAP} мм между тях.`
    : `Челата запълват корпуса. Фуга ${DOOR_CLEARANCE_TOP} мм отгоре, ${DRAWER_DOOR_GAP} мм между тях.`
}

function combineHint(doorCount: number, fromOneBoard: boolean, adjacentParts = false): string {
  if (adjacentParts) {
    return fromOneBoard
      ? 'Горните и долните чела/врати се режат от една плоча за продължена фладера, кантират се, после се разрязват. Фуга 3 мм между частите.'
      : 'Горните и долните чела/врати се режат отделно. Фуга 3 мм между тях.'
  }
  const withDoor = doorCount === 1
  if (!fromOneBoard) {
    if (withDoor) return 'Челата и вратата се режат отделно.'
    return 'Челата се режат отделно.'
  }
  if (doorCount >= 2) {
    const who = doorCount === 2 ? 'Двете врати' : doorCount === 3 ? 'Трите врати' : 'Четирите врати'
    return `Челата се режат от една плоча за продължена фладера, кантират се, после се разрязват. ${who} са по-тесни и се режат отделно.`
  }
  if (withDoor) {
    return 'Челата и вратата се режат от една плоча за продължена фладера, кантират се, после се разрязват.'
  }
  return 'Челата се режат от една плоча за продължена фладера, кантират се, после се разрязват.'
}

function bedHint(
  len: string,
  wid: string,
  side: string,
  thick: string,
  head: boolean,
  headH: string,
): string {
  const parsed = parseBedParams({
    mattressLength: parseInt(len, 10),
    mattressWidth: parseInt(wid, 10),
    sideHeight: parseInt(side, 10),
    thickness: parseInt(thick, 10),
    headboard: head,
    headboardHeight: parseInt(headH, 10),
  })
  const m = measureBed(parsed)
  return `Легло ${formatMm(m.length)} × ${formatMm(m.width)} мм. Страници ${formatMm(m.sideLength)} × ${formatMm(m.sideHeight)}. Плот ${formatMm(m.topWidth)}. Вътрешни ${formatMm(m.innerHeight)} мм, със ${BED_INNER_DROP_MM} мм по-ниски. Плоскости ${formatMm(Math.round(m.supportWidth))} × ${formatMm(m.innerHeight)}.`
}

function BedOptions({
  lift,
  onLift,
  dampers,
  onDampers,
  headboard,
  onHeadboard,
  headHeight,
  onHeadHeight,
  hint,
}: {
  lift: boolean
  onLift: (next: boolean) => void
  dampers: boolean
  onDampers: (next: boolean) => void
  headboard: boolean
  onHeadboard: (next: boolean) => void
  headHeight: string
  onHeadHeight: (next: string) => void
  hint: string
}) {
  return (
    <div className="rounded border p-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={lift ? 'default' : 'outline'} onClick={() => onLift(!lift)}>
          Механизъм за повдигане
        </Button>
        {lift && (
          <Button type="button" size="sm" variant={dampers ? 'default' : 'outline'} onClick={() => onDampers(!dampers)}>
            С амортисьори
          </Button>
        )}
        <Button type="button" size="sm" variant={headboard ? 'default' : 'outline'} onClick={() => onHeadboard(!headboard)}>
          Табла
        </Button>
      </div>
      {headboard && (
        <div className="mt-2 max-w-xs">
          <NumField id="bed-head" label="Височина на таблата" value={headHeight} onChange={onHeadHeight} />
        </div>
      )}
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{hint}</p>
    </div>
  )
}

function NumField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <DraftNumber id={id} inputMode="numeric" value={value} onCommit={(n) => onChange(String(n))} />
    </div>
  )
}

const selectClass = cn(
  'flex h-9 w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-1 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
)
