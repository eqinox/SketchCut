import { useMemo, useState, type ReactNode } from 'react'
import { Box, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  DEFAULT_SHELF_FRONT_INSET,
  DEFAULT_RAIL_WIDTH,
  FASCIA_SETBACK_MM,
  kitchenClearInnerH,
  parseBoxTopStyle,
  parseKitchenTopStyle,
  PART_COLOR_FIELDS,
  SHELF_PINS_PER_SHELF,
  HANDLE_NORMAL,
  SLIDE_KIND_LABEL,
  SLIDES_PER_DRAWER,
  eligibleSlideLengths,
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
  slideUnitPriceEur,
  drawerBoxRails,
  remainingFrontHeight,
  equalDrawerFrontHeights,
  drawerFrontsAreEven,
  canCombineFronts,
  canCombineAdjacentZoneFronts,
  doorCutSize,
  doorCutRuleNote,
  DOOR_CLEARANCE_TOP,
  DOOR_EDGE_BOTH,
  DRAWER_DOOR_GAP,
  DEFAULT_DRAWER_FRONT_HEIGHT,
  DRAWER_RAIL_BELOW_FRONT,
  MAX_DRAWERS,
  MAX_SHELVES,
  MAX_CLOTHES_RAILS,
  DEFAULT_CLOTHES_RAIL_FROM_TOP_MM,
  evenShelfGap,
  clothesRailLengthMm,
  hardboardCutSize,
  parseDoorStyle,
  parseSlidingEdges,
  defaultSlidingEdges,
  centerSlidingPartition,
  layoutSlidingDoors,
  slidingEdgeLabel,
  slidingProfileMm,
  SLIDING_DRAWER_FROM_BOTTOM_MM,
  SLIDING_BOTTOM_TRACK_MM,
  isBuyoutDoorPanel,
  type CabinetInstance,
  type CabinetPartColors,
  type SlideKind,
  type CabinetZoneId,
  type DoorSpan,
  type ZoneFittings,
  type SideFace,
  type DoorStyle,
  type SlidingDoorEdges,
  type SlidingEdgeKind,
  MAX_PARTITIONS,
  MIN_ZONE_CLEAR_MM,
  defaultFixedOffsetMm,
  defaultPartitionOffsetMm,
  middlePartitionBetween,
  defaultShelfFaces,
  defaultPartitionFaces,
  evenShelfPlacements,
  pinShelfOpenings,
  fixedShelfMeasureLabel,
  movableShelfMeasureLabel,
  clothesRailMeasureLabel,
  partitionMeasureLabel,
  partitionOriginCaption,
  layoutInterior,
  fittingsCountsFromParams,
  allDrawerFrontHeights,
  validateZoneFronts,
  columnLabel,
  shelvesForColumn,
  canAddFixedShelfToColumn,
  canAddFixedShelfFull,
  canAddMoreFixedShelves,
  type InteriorLayout,
  type PanelFace,
  type CabinetTopStyle,
  type HoodShape,
} from '@/lib/cabinets'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import type { AssemblyTimeSettings } from '@/lib/assembly-time'
import { DEFAULT_ASSEMBLY_TIME_SETTINGS } from '@/lib/assembly-time'
import { CabinetSizeBadge } from '@/components/CabinetSizeBadge'
import type { Sheet } from '@/types'
import { cn, formatMeters } from '@/lib/utils'

type MovableShelfUi = {
  from: 'bottom' | 'top' | 'middle'
  fromFace: PanelFace
  toFace: PanelFace
  offsetMm: string
  /** Which remaining opening a middle shelf sits in (0 = lowest). */
  gapIndex?: number
}

type ClothesRailUi = {
  from: 'top' | 'bottom' | 'middle'
  offsetMm: string
}

type ZoneUi = {
  shelfCount: number
  movableShelves: MovableShelfUi[]
  doorCount: 0 | 1 | 2
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
  gapIndex?: number
}): MovableShelfUi {
  if (s.from === 'middle') {
    return {
      from: 'middle',
      fromFace: 'top',
      toFace: 'bottom',
      offsetMm: String(s.offsetMm || 0),
      gapIndex: s.gapIndex,
    }
  }
  const faces = defaultShelfFaces(s.from)
  return {
    from: s.from,
    fromFace: s.fromFace ?? faces.fromFace,
    toFace: s.toFace ?? faces.toFace,
    offsetMm: String(s.offsetMm),
  }
}

function displayedMovable(rows: MovableShelfUi[], count: number, innerH: number, thickness: number): MovableShelfUi[] {
  if (rows.length > 0) return rows
  return evenShelfPlacements(innerH, count, thickness).map(movableToUi)
}

function newMovableShelf(innerH: number, thickness: number, already: number): MovableShelfUi {
  const from = already === 0 ? ('bottom' as const) : ('top' as const)
  return {
    from,
    ...defaultShelfFaces(from),
    offsetMm: String(defaultFixedOffsetMm(innerH, thickness, already)),
  }
}

function newMiddlePinShelf(gapIndex?: number): MovableShelfUi {
  return { from: 'middle', fromFace: 'top', toFace: 'bottom', offsetMm: '0', gapIndex }
}

function fittingsFromMovable(
  rows: MovableShelfUi[],
  evenCount: number,
): { shelfCount: number; movableShelves: ReturnType<typeof rowsToSpecs> } {
  if (rows.length === 0) return { shelfCount: evenCount, movableShelves: [] }
  const movableShelves = rowsToSpecs(rows)
  return { shelfCount: movableShelves.length, movableShelves }
}

function rowsToSpecs(rows: MovableShelfUi[]) {
  return rows
    .map((s) => ({
      from: s.from,
      fromFace: s.fromFace,
      toFace: s.toFace,
      offsetMm: parseInt(s.offsetMm, 10) || 0,
      ...(s.from === 'middle' && s.gapIndex != null ? { gapIndex: s.gapIndex } : {}),
    }))
    .filter((s) => s.from === 'middle' || s.offsetMm > 0)
}

function railToUi(s: { from: 'top' | 'bottom' | 'middle'; offsetMm: number }): ClothesRailUi {
  return { from: s.from, offsetMm: String(s.from === 'middle' ? 0 : s.offsetMm) }
}

function railsToSpecs(rows: ClothesRailUi[]) {
  return rows
    .map((s) => ({
      from: s.from,
      offsetMm: s.from === 'middle' ? 0 : parseInt(s.offsetMm, 10) || 0,
    }))
    .filter((s) => s.from === 'middle' || s.offsetMm > 0)
}

function newClothesRail(innerH: number, already: number): ClothesRailUi {
  if (already === 0) return { from: 'top', offsetMm: String(DEFAULT_CLOTHES_RAIL_FROM_TOP_MM) }
  return {
    from: 'bottom',
    offsetMm: String(Math.max(MIN_ZONE_CLEAR_MM, Math.round(innerH / (already + 1)))),
  }
}

function newMiddleRail(): ClothesRailUi {
  return { from: 'middle', offsetMm: '0' }
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
    movableShelves: [...bottom.movableShelves, ...middle.movableShelves, ...top.movableShelves],
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
  | { kind: 'door'; count: 1 | 2 }
  | { kind: 'rail'; middle?: boolean }
  | { kind: 'fixed-shelf' }

type FixedShelfUi = {
  from: 'bottom' | 'top'
  fromFace: PanelFace
  toFace: PanelFace
  offsetMm: string
  columnIndex: number | null
}

const FULL_CABINET_LABEL = 'На целия шкаф'

function FormSection({
  title,
  summary,
  children,
  defaultOpen = true,
}: {
  title: string
  summary?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
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
        {!open && summary ? (
          <span className="ml-auto text-xs font-normal text-[var(--color-muted-foreground)]">{summary}</span>
        ) : null}
      </button>
      {open ? children : null}
    </div>
  )
}

function ShelfMeasureFields({
  from,
  fromFace,
  toFace,
  offsetMm,
  originHint,
  measureHint,
  offsetId,
  allowMiddle,
  onFrom,
  onFromFace,
  onToFace,
  onOffset,
}: {
  from: 'bottom' | 'top' | 'middle'
  fromFace: PanelFace
  toFace: PanelFace
  offsetMm: string
  originHint: string
  measureHint: string
  offsetId: string
  allowMiddle?: boolean
  onFrom: (from: 'bottom' | 'top' | 'middle') => void
  onFromFace: (face: PanelFace) => void
  onToFace: (face: PanelFace) => void
  onOffset: (value: string) => void
}) {
  const middle = from === 'middle'
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={from === 'bottom' ? 'default' : 'outline'}
          onClick={() => onFrom('bottom')}
        >
          Отдолу
        </Button>
        <Button
          type="button"
          size="sm"
          variant={from === 'top' ? 'default' : 'outline'}
          onClick={() => onFrom('top')}
        >
          Отгоре
        </Button>
        {allowMiddle && (
          <Button
            type="button"
            size="sm"
            variant={middle ? 'default' : 'outline'}
            onClick={() => onFrom('middle')}
          >
            По средата
          </Button>
        )}
      </div>
      <p className="text-xs text-[var(--color-muted-foreground)]">{originHint}</p>
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
            <Input
              id={offsetId}
              type="number"
              inputMode="numeric"
              min={1}
              value={offsetMm}
              onChange={(e) => onOffset(e.target.value)}
            />
          </div>
        </>
      )}
      <p className="text-xs text-[var(--color-muted-foreground)]">{measureHint}</p>
    </>
  )
}

interface CabinetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: CabinetInstance | null
  sheets: Sheet[]
  dailyRateEur: number
  settings?: { hardware: HardwareSettings; assemblyTime: AssemblyTimeSettings }
  onSave: (input: { typeId: string; params: Record<string, unknown>; quantity: number }) => void
}

export function CabinetDialog({ open, onOpenChange, editing, sheets, dailyRateEur, settings = { hardware: DEFAULT_HARDWARE_SETTINGS, assemblyTime: DEFAULT_ASSEMBLY_TIME_SETTINGS }, onSave }: CabinetDialogProps) {
  const isEdit = !!editing
  const [typeId, setTypeId] = useState(editing?.typeId ?? 'kitchen-base')
  
  const initialKitchen = editing && editing.typeId === 'kitchen-base'
    ? parseKitchenBaseParams(editing.params)
    : editing && editing.typeId === 'kitchen-wall'
      ? parseKitchenWallParams(editing.params)
      : DEFAULT_KITCHEN_BASE_PARAMS

  const initialBox =
    editing && editing.typeId === 'wardrobe'
      ? parseWardrobeParams(editing.params)
      : editing && editing.typeId === 'section'
        ? parseSectionParams(editing.params)
        : editing && editing.typeId === 'nightstand'
          ? parseNightstandParams(editing.params)
          : DEFAULT_NIGHTSTAND_PARAMS

  const initialFittings =
    editing?.typeId === 'kitchen-base' || editing?.typeId === 'kitchen-wall'
      ? initialKitchen
      : editing?.typeId === 'nightstand' || editing?.typeId === 'section' || editing?.typeId === 'wardrobe'
        ? initialBox
        : initialKitchen

  const [width, setWidth] = useState(String(editing?.params.width ?? DEFAULT_KITCHEN_BASE_PARAMS.width))
  const [height, setHeight] = useState(String(editing?.params.height ?? DEFAULT_KITCHEN_BASE_PARAMS.height))
  const [depth, setDepth] = useState(String(editing?.params.depth ?? DEFAULT_KITCHEN_BASE_PARAMS.depth))
  const [depthIncludesDoor, setDepthIncludesDoor] = useState<'with-door' | 'without-door'>('without-door')
  const [thickness, setThickness] = useState(String(editing?.params.thickness ?? DEFAULT_KITCHEN_BASE_PARAMS.thickness))
  const [legHeight, setLegHeight] = useState(
    'legHeight' in initialKitchen && initialKitchen.legHeight === 150 ? 150 : 100,
  )
  const [shelfCount, setShelfCount] = useState(initialFittings.shelfCount)
  const [movableShelves, setMovableShelves] = useState<MovableShelfUi[]>(
    (initialFittings.movableShelves ?? []).map(movableToUi),
  )
  const [hasBack, setHasBack] = useState(initialFittings.hasBack)
  const [clothesRails, setClothesRails] = useState<ClothesRailUi[]>(() => {
    const rows = (initialFittings.clothesRails ?? []).map(railToUi)
    if (rows.length > 0) return rows
    return initialFittings.hasClothesRail ? [newClothesRail(0, 0)] : []
  })
  const [doorCount, setDoorCount] = useState(initialFittings.doorCount)
  const [externalDoors, setExternalDoors] = useState(initialFittings.externalDoors === true)
  const [doorStyle, setDoorStyle] = useState<DoorStyle>(
    editing?.typeId === 'wardrobe' ? 'sliding' : parseDoorStyle(initialFittings.doorStyle),
  )
  const [slidingEdges, setSlidingEdges] = useState<SlidingDoorEdges[]>(
    parseSlidingEdges((initialFittings as { slidingEdges?: unknown }).slidingEdges, 2),
  )
  const [drawerFrontHeights, setDrawerFrontHeights] = useState<string[]>(
    initialFittings.drawerFrontHeights.map(String),
  )
  const [cutFromOneBoard, setCutFromOneBoard] = useState(initialFittings.cutFromOneBoard)
  const [includeHandles, setIncludeHandles] = useState(initialFittings.includeHandles !== false)
  const [slideKind, setSlideKind] = useState<SlideKind>(parseSlideKind(initialFittings.slideKind))
  const [slideLength, setSlideLength] = useState(initialFittings.slideLength)

  const [plinthCount, setPlinthCount] = useState<1 | 2>(initialBox.plinthCount)
  const [plinthHeight, setPlinthHeight] = useState(String(initialBox.plinthHeight))
  const [useLegs, setUseLegs] = useState(initialBox.useLegs)
  const [topStyle, setTopStyle] = useState<CabinetTopStyle>(() => {
    if (editing?.typeId === 'kitchen-base') return parseKitchenTopStyle(editing.params.topStyle)
    if (editing?.typeId === 'nightstand' || editing?.typeId === 'section' || editing?.typeId === 'wardrobe') {
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
  const [showFronts, setShowFronts] = useState(false)
  const [fixedShelves, setFixedShelves] = useState<FixedShelfUi[]>(
    (initialFittings.fixedShelves ?? []).map((s) => {
      const faces = defaultShelfFaces(s.from)
      return {
        from: s.from,
        fromFace: s.fromFace ?? faces.fromFace,
        toFace: s.toFace ?? faces.toFace,
        offsetMm: String(s.offsetMm),
        columnIndex: typeof s.columnIndex === 'number' ? s.columnIndex : null,
      }
    }),
  )
  const [partitions, setPartitions] = useState<
    {
      from: 'left' | 'right'
      fromPartition: number | null
      fromFace: SideFace
      toFace: SideFace
      offsetMm: string
    }[]
  >(
    (initialFittings.partitions ?? []).map((s) => {
      const faces = defaultPartitionFaces(s.from)
      return {
        from: s.from,
        fromPartition: typeof s.fromPartition === 'number' ? s.fromPartition : null,
        fromFace: s.fromFace ?? faces.fromFace,
        toFace: s.toFace ?? faces.toFace,
        offsetMm: String(s.offsetMm),
      }
    }),
  )
  const [doorSpan, setDoorSpan] = useState<DoorSpan>(initialFittings.doorSpan === 'zones' ? 'zones' : 'full')
  const [zoneUi, setZoneUi] = useState<Record<string, ZoneUi>>(zoneUiFromFittings(initialFittings.zones))
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null)
  const [colors, setColors] = useState<CabinetPartColors>({
    ...DEFAULT_PART_COLORS,
    ...(editing?.params.colors as CabinetPartColors | undefined),
  })

  const params = useMemo(() => {
    const inputDepth = parseInt(depth, 10)
    const inputThickness = parseInt(thickness, 10)
    const actualDepth = depthIncludesDoor === 'with-door' 
      ? inputDepth - inputThickness - 2 
      : inputDepth
    
    const hasSplit = fixedShelves.length > 0 || partitions.length > 0
    const movable = fittingsFromMovable(hasSplit ? [] : movableShelves, hasSplit ? 0 : shelfCount)
    const fittings = {
      shelfCount: movable.shelfCount,
      movableShelves: movable.movableShelves,
      hasBack,
      hasClothesRail: hasSplit ? false : clothesRails.length > 0,
      clothesRails: hasSplit ? [] : railsToSpecs(clothesRails),
      doorCount,
      doorStyle: typeId === 'wardrobe' ? 'sliding' : doorStyle,
      slidingEdges,
      drawerFrontHeights: drawerFrontHeights.map((s) => parseInt(s, 10) || 0).filter((n) => n > 0),
      cutFromOneBoard,
      includeHandles,
      slideKind,
      slideLength,
      externalDoors,
      fixedShelves: fixedShelves
        .map((s) => ({
          from: s.from,
          fromFace: s.fromFace,
          toFace: s.toFace,
          offsetMm: parseInt(s.offsetMm, 10) || 0,
          columnIndex: s.columnIndex,
        }))
        .filter((s) => s.offsetMm > 0),
      partitions: partitions
        .map((s) => ({
          from: s.from,
          fromPartition: s.fromPartition,
          fromFace: s.fromFace,
          toFace: s.toFace,
          offsetMm: parseInt(s.offsetMm, 10) || 0,
        }))
        .filter((s) => s.offsetMm > 0),
      doorSpan: hasSplit ? doorSpan : 'full' as DoorSpan,
      zones: hasSplit ? serializeZoneUi(zoneUi, cutFromOneBoard) : {},
    }
    if (typeId === 'nightstand') {
      return parseNightstandParams({
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        depth: actualDepth,
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
        depth: actualDepth,
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
        depth: actualDepth,
        thickness: inputThickness,
        useLegs: false,
        plinthCount,
        plinthHeight: parseInt(plinthHeight, 10),
        colors,
        topStyle,
        railWidth: DEFAULT_RAIL_WIDTH,
        ...fittings,
        doorStyle: 'sliding',
        doorCount: 2,
      })
    }
    if (typeId === 'kitchen-wall') {
      return parseKitchenWallParams({
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        depth: actualDepth,
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
      depth: actualDepth,
      thickness: inputThickness,
      legHeight,
      railWidth: DEFAULT_KITCHEN_BASE_PARAMS.railWidth,
      topStyle,
      colors,
      ...fittings,
    })
  }, [typeId, width, height, depth, depthIncludesDoor, thickness, legHeight, shelfCount, movableShelves, hasBack, clothesRails, doorCount, doorStyle, slidingEdges, drawerFrontHeights, cutFromOneBoard, includeHandles, slideKind, slideLength, useLegs, plinthCount, plinthHeight, colors, topStyle, hasHood, hoodShape, hoodDiameter, hoodRectW, hoodRectD, fixedShelves, partitions, doorSpan, zoneUi, externalDoors])

  const qty = Math.max(1, parseInt(quantity, 10) || 1)
  const result = useMemo(() => {
    try {
      return scaleCabinetResult(generateCabinet(typeId, { ...params }, settings), qty)
    } catch {
      return null
    }
  }, [typeId, params, qty, settings])

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
  const hasFittings = typeId === 'kitchen-base' || typeId === 'kitchen-wall' || typeId === 'nightstand' || typeId === 'section' || typeId === 'wardrobe'
  const isKitchenCarcass = typeId === 'kitchen-base' || typeId === 'kitchen-wall'
  const isPlinthBox = typeId === 'nightstand' || typeId === 'section' || typeId === 'wardrobe'
  const isSlidingCabinet = typeId === 'wardrobe' || (typeId === 'section' && doorStyle === 'sliding')
  const nsMeasure =
    isKitchenCarcass
      ? null
      : measureNightstand(params as ReturnType<typeof parseNightstandParams>, typeId === 'section' || typeId === 'wardrobe')
  const slideDepth = isKitchenCarcass ? params.depth : isSlidingCabinet ? nsMeasure!.partitionD : nsMeasure!.sideD
  const innerH =
    typeId === 'kitchen-base'
      ? kitchenClearInnerH(params.height, params.thickness, (params as ReturnType<typeof parseKitchenBaseParams>).topStyle)
      : typeId === 'kitchen-wall'
        ? params.height - 2 * params.thickness
        : nsMeasure!.innerH
  const topBoardCaption =
    typeId === 'kitchen-base'
      ? topStyle === 'rails'
        ? 'блендата'
        : 'горе'
      : topStyle === 'panel'
        ? 'плота'
        : 'горе'
  const innerW = isKitchenCarcass ? params.width - 2 * params.thickness : nsMeasure!.innerW
  const frontH = isKitchenCarcass ? params.height : nsMeasure!.frontHeight
  const drawerFrontH = isSlidingCabinet ? innerH : frontH
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
  const error = validate(typeId, params, layout, drawerFrontH, drawerBottomGap)
  const counts = fittingsCountsFromParams(params)
  const projectExternalDoors = settings.hardware.externalDoors
  const effectiveExternalDoors = projectExternalDoors || externalDoors
  const hasDoorsForSource = isSlidingCabinet ? doorCount === 2 : counts.doorCount > 0 || counts.drawerCount > 0
  const hasFixed = (params.fixedShelves?.length ?? 0) > 0
  const hasPartitions = (params.partitions?.length ?? 0) > 0
  const hasSplit = hasFixed || hasPartitions
  const middleBetweenExtras =
    pendingAdd?.kind === 'shelf' && pendingAdd.middle
      ? betweenRowExtras(layout.zones, layout.columns.length)
      : []
  const cabinetPinOpenings = pinShelfOpenings(
    rowsToSpecs(displayedMovable(movableShelves, shelfCount, innerH, params.thickness)),
    innerH,
    params.thickness,
  )
  const pinGapZoneExtras =
    pendingAdd?.kind === 'shelf' && pendingAdd.middle && hasSplit
      ? layout.zones.flatMap((z) => {
          const cur = zoneOf(zoneUi, z.id)
          const rows = displayedMovable(cur.movableShelves, cur.shelfCount, z.innerH, params.thickness)
          const openings = pinShelfOpenings(rowsToSpecs(rows), z.innerH, params.thickness)
          if (openings.length < 2) return []
          return openings.map((o) => ({
            id: `pin-gap:${z.id}:${o.index}`,
            label:
              openings.length === 2
                ? `${z.label} · ${o.index === 0 ? 'под рафта' : 'над рафта'}`
                : `${z.label} · ${o.label}`,
          }))
        })
      : []
  const pinSplitZoneIds = new Set(
    pinGapZoneExtras.map((e) => parsePinGapTarget(e.id)?.zoneId).filter((id): id is string => !!id),
  )
  const showCabinetPinParts =
    pendingAdd?.kind === 'shelf' && pendingAdd.middle === true && !hasSplit && cabinetPinOpenings.length > 1
  const shelfGap = evenShelfGap(innerH, shelfCount, params.thickness)
  const backPlinth =
    typeId !== 'kitchen-base' && !(params as ReturnType<typeof parseNightstandParams>).useLegs
      ? (params as ReturnType<typeof parseNightstandParams>).plinthHeight
      : 0
  const backCut = hardboardCutSize(params.width, params.height, backPlinth)

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
        setMovableShelves([
          ...zoneOf(zoneUi, 'bottom').movableShelves,
          ...zoneOf(zoneUi, 'middle').movableShelves,
          ...zoneOf(zoneUi, 'top').movableShelves,
        ])
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

  const addFixedShelf = (columnIndex: number | null) => {
    const colCount = Math.max(1, layout.columns.length)
    if (columnIndex != null && !canAddFixedShelfToColumn(fixedShelves, columnIndex)) return
    if (columnIndex == null && !canAddFixedShelfFull(fixedShelves, colCount)) return
    const already =
      columnIndex == null
        ? Math.max(0, ...Array.from({ length: colCount }, (_, c) => shelvesForColumn(fixedShelves, c).length))
        : shelvesForColumn(fixedShelves, columnIndex).length
    const offset = defaultFixedOffsetMm(innerH, params.thickness, already)
    const from = already === 0 ? 'bottom' as const : 'top' as const
    commitFixedShelves([
      ...fixedShelves,
      { from, ...defaultShelfFaces(from), offsetMm: String(offset), columnIndex },
    ])
  }

  const addPinShelfRows = (
    innerHMm: number,
    rows: MovableShelfUi[],
    evenCount: number,
    middle = false,
    gapIndex?: number,
  ): MovableShelfUi[] => {
    const current = displayedMovable(rows, evenCount, innerHMm, params.thickness)
    if (current.length >= MAX_SHELVES) return current
    return [...current, middle ? newMiddlePinShelf(gapIndex) : newMovableShelf(innerHMm, params.thickness, current.length)]
  }

  const addCabinetPinShelf = (middle = false, gapIndex?: number) => {
    const next = addPinShelfRows(innerH, movableShelves, shelfCount, middle, gapIndex)
    setMovableShelves(next)
    setShelfCount(next.length)
  }

  const applyPending = (target: FrontTarget) => {
    if (!pendingAdd) return
    if (pendingAdd.kind === 'fixed-shelf') {
      addFixedShelf(target === 'full' ? null : Number.parseInt(/^c(\d+)/.exec(target)?.[1] ?? '', 10) || 0)
      return
    }
    if (pendingAdd.kind === 'shelf') {
      const middle = pendingAdd.middle === true
      const pinGap = parsePinGapTarget(target)
      if (pinGap) {
        if (pinGap.zoneId) {
          const zone = layout.zones.find((row) => row.id === pinGap.zoneId)
          const zoneH = zone?.innerH ?? innerH
          setZoneUi((z) => {
            const cur = zoneOf(z, pinGap.zoneId!)
            const nextRows = addPinShelfRows(zoneH, cur.movableShelves, cur.shelfCount, true, pinGap.gapIndex)
            return { ...z, [pinGap.zoneId!]: { ...cur, movableShelves: nextRows, shelfCount: nextRows.length } }
          })
        } else {
          addCabinetPinShelf(true, pinGap.gapIndex)
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
            const nextRows = addPinShelfRows(zone.innerH, cur.movableShelves, cur.shelfCount, middle)
            next[zone.id] = { ...cur, movableShelves: nextRows, shelfCount: nextRows.length }
          }
          return next
        })
      } else if (zoneId) {
        const zone = layout.zones.find((row) => row.id === zoneId)
        const zoneH = zone?.innerH ?? innerH
        setZoneUi((z) => {
          const cur = zoneOf(z, zoneId)
          const nextRows = addPinShelfRows(zoneH, cur.movableShelves, cur.shelfCount, middle)
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
        const hasDoor = isSlidingCabinet ? false : doorSpan === 'zones' && cur.doorCount > 0
        const zone = layout.zones.find((z) => z.id === target)
        const n = cur.drawerFrontHeights.length + 1
        if (zone && !hasDoor) {
          patchZone(target, {
            drawerFrontHeights: filledDrawerRows(
              zone.frontHeight,
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
      const pushRail = (id: CabinetZoneId) => {
        const cur = zoneOf(zoneUi, id)
        if (cur.clothesRails.length >= MAX_CLOTHES_RAILS) return cur
        const zone = layout.zones.find((z) => z.id === id)
        const nextRails = [
          ...cur.clothesRails,
          middle ? newMiddleRail() : newClothesRail(zone?.innerH ?? innerH, cur.clothesRails.length),
        ]
        return { ...cur, clothesRails: nextRails, hasClothesRail: true }
      }
      if (target === 'full') {
        setZoneUi((z) => {
          const next = { ...z }
          for (const zone of layout.zones) {
            next[zone.id] = pushRail(zone.id)
          }
          return next
        })
      } else {
        patchZone(target, pushRail(target))
      }
    }
    setPendingAdd(null)
  }

  const startAdd = (next: PendingAdd) => {
    if (next.kind === 'shelf' && next.middle) {
      if (hasSplit && !layout.error) {
        setPendingAdd(next)
        return
      }
      const current = displayedMovable(movableShelves, shelfCount, innerH, params.thickness)
      const openings = pinShelfOpenings(rowsToSpecs(current), innerH, params.thickness)
      if (openings.length > 1) {
        setPendingAdd(next)
        return
      }
      addCabinetPinShelf(true, openings.length === 1 ? 0 : undefined)
      return
    }
    if (hasSplit && !layout.error) {
      setPendingAdd(next)
      return
    }
    if (next.kind === 'shelf') addCabinetPinShelf(next.middle === true)
    else if (next.kind === 'drawer') {
      setDrawerFrontHeights((rows) =>
        !isSlidingCabinet && doorCount > 0
          ? [...rows, String(DEFAULT_DRAWER_FRONT_HEIGHT)]
          : filledDrawerRows(drawerFrontH, rows.length + 1, false, drawerBottomGap),
      )
    }
    else if (next.kind === 'door') setDoorCount(next.count)
    else if (next.kind === 'rail') {
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
            !drawerFrontsAreEven(z.frontHeight, heights, z.y0 <= 0.5 ? drawerBottomGap : 0)
          )
        })
        .map((z) => z.id)
    : []
  const canEqualizeDrawers = canEqualizeFull || zoneEqualizeIds.length > 0
  const adjacentCombine = hasSplit && canCombineAdjacentZoneFronts(layout.zones)
  const showCombineFronts =
    !effectiveExternalDoors &&
    (canCombineFronts(fullDrawerNums.length, fullDrawerHasDoor ? doorCount : 0) ||
      (hasSplit &&
        layout.zones.some((z) =>
          canCombineFronts(
            parseDrawerRows(zoneOf(zoneUi, z.id).drawerFrontHeights).length,
            doorSpan === 'zones' ? zoneOf(zoneUi, z.id).doorCount : 0,
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
              zone.frontHeight,
              n,
              zone.y0 <= 0.5 ? drawerBottomGap : 0,
            ).map(String),
          }
        }
        return next
      })
    }
  }

  const handleSave = () => {
    if (error) return
    onSave({ typeId, params: { ...params }, quantity: qty })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактирай шкаф' : 'Добави шкаф'}</DialogTitle>
          <DialogDescription>
            {typeId === 'nightstand'
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
                if (id === 'nightstand') {
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
                  const center = centerSlidingPartition(d.width, d.thickness)
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
                  setSlidingEdges(defaultSlidingEdges(2))
                  setDrawerFrontHeights([])
                  setCutFromOneBoard(false)
                  setIncludeHandles(true)
                  setFixedShelves([])
                  setPartitions([
                    {
                      from: center.from,
                      fromPartition: null,
                      fromFace: center.fromFace ?? 'right',
                      toFace: center.toFace ?? 'right',
                      offsetMm: String(center.offsetMm),
                    },
                  ])
                  setDoorSpan('full')
                  setZoneUi({
                    c0: emptyZoneUi(),
                    c1: emptyZoneUi(),
                  })
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
          </div>
          <div>
            <Label htmlFor="cab-qty">Брой еднакви</Label>
            <Input
              id="cab-qty"
              type="number"
              inputMode="numeric"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Един шкаф, повторен толкова пъти в разкроя и цената. Например 10.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumField id="cab-w" label="Ширина" value={width} onChange={setWidth} />
          <NumField id="cab-h" label={typeId === 'kitchen-base' ? 'Височина корпус' : 'Височина'} value={height} onChange={setHeight} />
          <NumField id="cab-d" label="Дълбочина" value={depth} onChange={setDepth} />
          <NumField id="cab-t" label="Плоскост" value={thickness} onChange={setThickness} />
        </div>
        
        <div className="flex items-center gap-4 rounded border p-2">
          <span className="text-sm font-medium">Дълбочината е:</span>
          <div className="flex items-center gap-2">
            <Checkbox
              id="depth-without-door"
              checked={depthIncludesDoor === 'without-door'}
              onCheckedChange={(checked) => {
                if (checked) setDepthIncludesDoor('without-door')
              }}
            />
            <Label htmlFor="depth-without-door" className="cursor-pointer text-sm font-normal">
              Без вратата
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="depth-with-door"
              checked={depthIncludesDoor === 'with-door'}
              onCheckedChange={(checked) => {
                if (checked) setDepthIncludesDoor('with-door')
              }}
            />
            <Label htmlFor="depth-with-door" className="cursor-pointer text-sm font-normal">
              Заедно с вратата
            </Label>
          </div>
        </div>
        
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
                Хваща се с винтове 5×60 през страниците и разделя частта. До 2 рафта на част — долна, средна,
                горна.
                {layout.columns.length > 1 ? ' След разделителна страница избираш в коя част да го сложиш.' : ''}
              </p>
              {fixedShelves.map((shelf, i) => (
                <div key={i} className="mt-2 space-y-2 rounded-md border border-[var(--color-border)] p-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-28 shrink-0 text-xs">
                      Рафт {i + 1}
                      {layout.columns.length > 1
                        ? ` · ${
                            shelf.columnIndex == null
                              ? FULL_CABINET_LABEL
                              : columnLabel(shelf.columnIndex, layout.columns.length)
                          }`
                        : ''}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => commitFixedShelves(fixedShelves.filter((_, j) => j !== i))}
                      aria-label={`Премахни фиксиран рафт ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {layout.columns.length > 1 && (
                    <>
                      <p className="text-xs text-[var(--color-muted-foreground)]">В коя част</p>
                      <div className="flex flex-wrap gap-2">
                        {layout.columns.map((_, c) => {
                          const others = fixedShelves.filter((_, j) => j !== i)
                          const taken = !canAddFixedShelfToColumn(others, c) && shelf.columnIndex !== c
                          return (
                            <Button
                              key={`fs-col-${i}-${c}`}
                              type="button"
                              size="sm"
                              disabled={taken}
                              variant={shelf.columnIndex === c ? 'default' : 'outline'}
                              onClick={() =>
                                commitFixedShelves(
                                  fixedShelves.map((r, j) => (j === i ? { ...r, columnIndex: c } : r)),
                                )
                              }
                            >
                              {columnLabel(c, layout.columns.length)}
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
                              fixedShelves.map((r, j) => (j === i ? { ...r, columnIndex: null } : r)),
                            )
                          }
                        >
                          {FULL_CABINET_LABEL}
                        </Button>
                      </div>
                    </>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={shelf.from === 'bottom' ? 'default' : 'outline'}
                      onClick={() =>
                        setFixedShelves((rows) =>
                          rows.map((r, j) =>
                            j === i ? { ...r, from: 'bottom', ...defaultShelfFaces('bottom') } : r,
                          ),
                        )
                      }
                    >
                      Отдолу
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={shelf.from === 'top' ? 'default' : 'outline'}
                      onClick={() =>
                        setFixedShelves((rows) =>
                          rows.map((r, j) =>
                            j === i ? { ...r, from: 'top', ...defaultShelfFaces('top') } : r,
                          ),
                        )
                      }
                    >
                      Отгоре
                    </Button>
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    От {shelf.from === 'bottom' ? 'дъното' : topStyle === 'none' || topStyle === 'fascia' ? 'горе' : typeId === 'kitchen-base' ? 'блендата' : 'плота'}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={shelf.fromFace === 'bottom' ? 'default' : 'outline'}
                      onClick={() =>
                        setFixedShelves((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, fromFace: 'bottom' } : r)),
                        )
                      }
                    >
                      Долна страна
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={shelf.fromFace === 'top' ? 'default' : 'outline'}
                      onClick={() =>
                        setFixedShelves((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, fromFace: 'top' } : r)),
                        )
                      }
                    >
                      Горна страна
                    </Button>
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">До рафта</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={shelf.toFace === 'bottom' ? 'default' : 'outline'}
                      onClick={() =>
                        setFixedShelves((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, toFace: 'bottom' } : r)),
                        )
                      }
                    >
                      Долна страна
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={shelf.toFace === 'top' ? 'default' : 'outline'}
                      onClick={() =>
                        setFixedShelves((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, toFace: 'top' } : r)),
                        )
                      }
                    >
                      Горна страна
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`fixed-off-${i}`} className="w-28 shrink-0 text-xs">
                      Размер (мм)
                    </Label>
                    <Input
                      id={`fixed-off-${i}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={shelf.offsetMm}
                      onChange={(e) =>
                        setFixedShelves((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, offsetMm: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {`${fixedShelfMeasureLabel(
                      {
                        from: shelf.from,
                        fromFace: shelf.fromFace,
                        toFace: shelf.toFace,
                        offsetMm: parseInt(shelf.offsetMm, 10) || 0,
                      },
                      typeId === 'kitchen-base'
                        ? topStyle === 'rails'
                          ? 'блендата'
                          : 'горе'
                        : topStyle === 'panel'
                          ? 'плота'
                          : 'горе',
                    )}. Линията е на 3D изгледа.`}
                  </p>
                </div>
              ))}
              <div className="mt-2">
                <Button
                  type="button"
                  size="sm"
                  variant={pendingAdd?.kind === 'fixed-shelf' ? 'default' : 'outline'}
                  disabled={!canAddMoreFixedShelves(fixedShelves, Math.max(1, layout.columns.length))}
                  onClick={() => {
                    if (layout.columns.length > 1) {
                      setPendingAdd({ kind: 'fixed-shelf' })
                      return
                    }
                    addFixedShelf(null)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Добави фиксиран рафт
                </Button>
              </div>
              {pendingAdd?.kind === 'fixed-shelf' && layout.columns.length > 1 && (
                <WherePicker
                  zones={layout.columns
                    .map((_, c) => ({
                      id: `c${c}`,
                      label: columnLabel(c, layout.columns.length),
                    }))
                    .filter((_, c) => canAddFixedShelfToColumn(fixedShelves, c))}
                  allowFull={canAddFixedShelfFull(fixedShelves, layout.columns.length)}
                  onPick={applyPending}
                  onCancel={() => setPendingAdd(null)}
                />
              )}
              {layout.error && layout.shelves.length > 0 && (
                <p className="mt-1 text-xs text-[var(--color-destructive)]">{layout.error}</p>
              )}
            </FormSection>

            <FormSection defaultOpen={false}
              title="Разделителна страница"
              summary={partitions.length > 0 ? `${partitions.length} бр.` : 'няма'}
            >
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                Вътрешна страница — сяда на дъното, не на пода. Мери се от лявата/дясната страница на корпуса
                или от вече добавена страница. До 3 страници — 4 части.
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
                          setMovableShelves(cols.flatMap((z) => z.movableShelves))
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
                              ? { ...r, from: 'left', fromPartition: null, ...defaultPartitionFaces('left') }
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
                              ? { ...r, from: 'right', fromPartition: null, ...defaultPartitionFaces('right') }
                              : r,
                          ),
                        )
                      }
                    >
                      Дясна страница
                    </Button>
                  </div>
                  {part.fromPartition != null && (
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
                    <Input
                      id={`part-off-${i}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={part.offsetMm}
                      onChange={(e) =>
                        setPartitions((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, offsetMm: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Или постави по средата между:</p>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const options: { left: 'left-side' | number; right: 'right-side' | number; label: string }[] = []
                        const sortedPartitions = [...layout.partitions].sort((a, b) => a.xLeft - b.xLeft)
                        
                        options.push({
                          left: 'left-side',
                          right: sortedPartitions.length > 0 ? sortedPartitions[0].specIndex : 'right-side',
                          label: sortedPartitions.length > 0 
                            ? `Лява и Стр. ${sortedPartitions[0].specIndex + 1}`
                            : 'Лява и Дясна'
                        })
                        
                        for (let idx = 0; idx < sortedPartitions.length - 1; idx++) {
                          const leftPart = sortedPartitions[idx]
                          const rightPart = sortedPartitions[idx + 1]
                          options.push({
                            left: leftPart.specIndex,
                            right: rightPart.specIndex,
                            label: `Стр. ${leftPart.specIndex + 1} и Стр. ${rightPart.specIndex + 1}`
                          })
                        }
                        
                        if (sortedPartitions.length > 0) {
                          const lastPart = sortedPartitions[sortedPartitions.length - 1]
                          options.push({
                            left: lastPart.specIndex,
                            right: 'right-side',
                            label: `Стр. ${lastPart.specIndex + 1} и Дясна`
                          })
                        }
                        
                        return options.filter(opt => 
                          opt.left !== i && opt.right !== i
                        ).map((opt, optIdx) => (
                          <Button
                            key={optIdx}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const middleSpec = middlePartitionBetween(
                                opt.left,
                                opt.right,
                                layout.partitions,
                                innerW,
                                params.thickness
                              )
                              if (middleSpec) {
                                setPartitions((rows) =>
                                  rows.map((r, j) => 
                                    j === i 
                                      ? { 
                                          ...r,
                                          from: middleSpec.from,
                                          fromPartition: middleSpec.fromPartition ?? null,
                                          fromFace: middleSpec.fromFace,
                                          toFace: middleSpec.toFace,
                                          offsetMm: String(middleSpec.offsetMm)
                                        }
                                      : r
                                  )
                                )
                              }
                            }}
                          >
                            {opt.label}
                          </Button>
                        ))
                      })()}
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {`${partitionMeasureLabel({
                      from: part.from,
                      fromPartition: part.fromPartition,
                      fromFace: part.fromFace,
                      toFace: part.toFace,
                      offsetMm: parseInt(part.offsetMm, 10) || 0,
                    })}. На 3D изгледа линията върви между тези две страни.`}
                  </p>
                </div>
              ))}
              <div className="mt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={partitions.length >= MAX_PARTITIONS}
                  onClick={() => {
                    if (partitions.length === 0) {
                      const center = centerSlidingPartition(params.width, params.thickness)
                      const offset = isSlidingCabinet
                        ? center.offsetMm
                        : defaultPartitionOffsetMm(innerW, params.thickness, 0)
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
                      setPendingAdd(null)
                      setPartitions([
                        {
                          from: 'left',
                          fromPartition: null,
                          ...(isSlidingCabinet
                            ? { fromFace: center.fromFace ?? 'right', toFace: center.toFace ?? 'right' }
                            : defaultPartitionFaces('left')),
                          offsetMm: String(offset),
                        },
                      ])
                    } else {
                      const lastIdx = partitions.length - 1
                      const last = layout.partitions.find((p) => p.specIndex === lastIdx)
                      const remain = last ? Math.max(0, innerW - last.xRight) : innerW
                      const offset =
                        remain > MIN_ZONE_CLEAR_MM * 2
                          ? Math.max(MIN_ZONE_CLEAR_MM, Math.round(remain / 2))
                          : defaultPartitionOffsetMm(innerW, params.thickness, partitions.length)
                      const nextCol = partitions.length + 1
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
                      setPartitions((rows) => {
                        if (rows.length >= MAX_PARTITIONS) return rows
                        return [
                          ...rows,
                          {
                            from: 'left' as const,
                            fromPartition: lastIdx,
                            ...defaultPartitionFaces('left'),
                            offsetMm: String(offset),
                          },
                        ]
                      })
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Добави разделителна страница
                </Button>
              </div>
              {layout.error && layout.partitions.length > 0 && (
                <p className="mt-1 text-xs text-[var(--color-destructive)]">{layout.error}</p>
              )}
            </FormSection>

            {hasSplit && !layout.error && (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Шкафът е разделен на {layout.zones.length} части:{' '}
                {layout.zones
                  .map((z) => `${z.label} ${Math.round(z.innerW)}×${Math.round(z.innerH)} мм`)
                  .join(' · ')}
                . При рафт, врата или чекмедже се пита в коя част.
              </p>
            )}

            <FormSection defaultOpen={false}
              title="Рафтове"
              summary={counts.shelfCount > 0 ? `${counts.shelfCount} бр.` : 'няма'}
            >
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                Подвижни рафтове с рафтоносачи. Отгоре, отдолу или по средата на оставащия отвор. Рафт на точно
                разстояние дели отвора на части — после слагаш рафт по средата над или под него.
              </p>
              {!hasSplit && (() => {
                const rows = displayedMovable(movableShelves, shelfCount, innerH, params.thickness)
                const allMiddle = shelfCount > 0 && rows.every(r => r.from === 'middle')
                const cabinetShelfGap = allMiddle
                  ? evenShelfGap(innerH, shelfCount, params.thickness)
                  : 0
                return (
                  <>
                    {rows.map((shelf, i) => (
                      <div key={`pin-${i}`} className="mt-2 space-y-2 rounded-md border border-[var(--color-border)] p-2">
                        <div className="flex items-center gap-2">
                          <span className="min-w-28 shrink-0 text-xs">Рафт {i + 1}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              const next = displayedMovable(movableShelves, shelfCount, innerH, params.thickness).filter(
                                (_, j) => j !== i,
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
                          allowMiddle
                          originHint={
                            shelf.from === 'middle'
                              ? 'По средата на отвора между рафтовете — равни празнини над и под рафта'
                              : `От ${shelf.from === 'bottom' ? 'дъното' : topBoardCaption}`
                          }
                          measureHint={`${movableShelfMeasureLabel(
                            layout.zones[0]?.movable[i] ?? {
                              from: shelf.from,
                              fromFace: shelf.fromFace,
                              toFace: shelf.toFace,
                              offsetMm: parseInt(shelf.offsetMm, 10) || 0,
                            },
                            topBoardCaption,
                          )}${shelf.from === 'middle' ? '' : '. Линията е на 3D изгледа.'}`}
                          offsetId={`pin-off-${i}`}
                          onFrom={(from) => {
                            const current = displayedMovable(movableShelves, shelfCount, innerH, params.thickness)
                            const next = current.map((r, j) =>
                              j === i
                                ? from === 'middle'
                                  ? newMiddlePinShelf()
                                  : { ...r, from, ...defaultShelfFaces(from) }
                                : r,
                            )
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
                    ))}
                    {cabinetShelfGap > 0 && (
                      <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
                        Разстояние между рафтовете: {Math.round(cabinetShelfGap)} мм
                      </p>
                    )}
                  </>
                )
              })()}
              {hasSplit &&
                layout.zones.map((z) => {
                  const cur = zoneOf(zoneUi, z.id)
                  const rows = displayedMovable(cur.movableShelves, cur.shelfCount, z.innerH, params.thickness)
                  const allMiddle = cur.shelfCount > 0 && rows.every(r => r.from === 'middle')
                  const zoneShelfGap = allMiddle
                    ? evenShelfGap(z.innerH, cur.shelfCount, params.thickness)
                    : 0
                  return (
                    <div key={`zone-${z.id}`}>
                      {rows.map((shelf, i) => (
                        <div key={`pin-${z.id}-${i}`} className="mt-2 space-y-2 rounded-md border border-[var(--color-border)] p-2">
                          <div className="flex items-center gap-2">
                            <span className="min-w-28 shrink-0 text-xs">
                              Рафт {i + 1} · {z.label}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              onClick={() => {
                                const nextRows = displayedMovable(
                                  cur.movableShelves,
                                  cur.shelfCount,
                                  z.innerH,
                                  params.thickness,
                                ).filter((_, j) => j !== i)
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
                            allowMiddle
                            originHint={
                              shelf.from === 'middle'
                                ? `По средата на отвора между рафтовете · ${z.label}`
                                : `От ${shelf.from === 'bottom' ? 'долната плоскост' : 'горната плоскост'} · ${z.label}`
                            }
                            measureHint={`${movableShelfMeasureLabel(
                              z.movable[i] ?? {
                                from: shelf.from,
                                fromFace: shelf.fromFace,
                                toFace: shelf.toFace,
                                offsetMm: parseInt(shelf.offsetMm, 10) || 0,
                              },
                              'горната плоскост',
                              'долната плоскост',
                            )}${shelf.from === 'middle' ? '' : '. Линията е на 3D изгледа.'}`}
                            offsetId={`pin-off-${z.id}-${i}`}
                            onFrom={(from) => {
                              const nextRows = displayedMovable(
                                cur.movableShelves,
                                cur.shelfCount,
                                z.innerH,
                                params.thickness,
                              ).map((r, j) =>
                                j === i
                                  ? from === 'middle'
                                    ? newMiddlePinShelf()
                                    : { ...r, from, ...defaultShelfFaces(from) }
                                  : r,
                              )
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
                      ))}
                      {zoneShelfGap > 0 && (
                        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
                          {z.label}: Разстояние между рафтовете: {Math.round(zoneShelfGap)} мм
                        </p>
                      )}
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
                      ? cabinetPinOpenings.map((o) => ({
                          id: `pin-gap:${o.index}`,
                          label: o.label,
                        }))
                      : pendingAdd.middle
                        ? layout.zones.filter((z) => !pinSplitZoneIds.has(z.id))
                        : layout.zones
                  }
                  extras={hasSplit ? [...middleBetweenExtras, ...pinGapZoneExtras] : undefined}
                  allowFull={hasSplit && !showCabinetPinParts}
                  hint={
                    showCabinetPinParts
                      ? 'Рафтът на точно разстояние дели шкафа. Избери в коя част да е рафтът по средата.'
                      : pinGapZoneExtras.length > 0
                        ? 'Рафт на точно разстояние дели частта — избери над или под него.'
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
                      ? `${counts.shelfCount * SHELF_PINS_PER_SHELF} рафтоносача · ${formatEur(settings.hardware.shelfPinEur)}/бр. · дълбочина ${slideDepth - DEFAULT_SHELF_FRONT_INSET} мм`
                      : `Разстояние между рафтовете: ${Math.round(shelfGap)} мм · ${shelfCount * SHELF_PINS_PER_SHELF} рафтоносача · ${formatEur(settings.hardware.shelfPinEur)}/бр. · дълбочина ${slideDepth - DEFAULT_SHELF_FRONT_INSET} мм`}
              </p>
            </FormSection>

        <FormSection defaultOpen={false} title="Фазер на гърба" summary={hasBack ? 'С фазер' : 'Без'}>
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
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {hasBack
              ? backPlinth > 0
                ? `Рязане ${backCut.width} × ${backCut.height} мм — цокълът ${backPlinth} мм не се покрива.`
                : `Рязане ${backCut.width} × ${backCut.height} мм — покрива целия гръб.`
              : 'Без гръб.'}
          </p>
        </FormSection>

        <FormSection defaultOpen={false}
          title="Лост за дрехи"
          summary={counts.clothesRailCount > 0 ? `${counts.clothesRailCount} бр.` : 'няма'}
        >
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            Между страниците. Отгоре (обикновено 48 мм), отдолу или по средата на отвора.
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
                          j === i ? { from: 'bottom', offsetMm: r.from === 'middle' ? String(DEFAULT_CLOTHES_RAIL_FROM_TOP_MM) : r.offsetMm } : r,
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
                          j === i ? { from: 'top', offsetMm: r.from === 'middle' ? String(DEFAULT_CLOTHES_RAIL_FROM_TOP_MM) : r.offsetMm } : r,
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
                      setClothesRails((rows) => rows.map((r, j) => (j === i ? newMiddleRail() : r)))
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
                    <Input
                      id={`rail-off-${i}`}
                      type="number"
                      min={1}
                      value={rail.offsetMm}
                      onChange={(e) =>
                        setClothesRails((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, offsetMm: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                )}
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {`${clothesRailMeasureLabel(
                    { from: rail.from, offsetMm: parseInt(rail.offsetMm, 10) || 0 },
                    topBoardCaption,
                  )}${rail.from === 'middle' ? '.' : '. Линията е на 3D изгледа.'}`}
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
                              ? { from: 'bottom', offsetMm: r.from === 'middle' ? String(DEFAULT_CLOTHES_RAIL_FROM_TOP_MM) : r.offsetMm }
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
                              ? { from: 'top', offsetMm: r.from === 'middle' ? String(DEFAULT_CLOTHES_RAIL_FROM_TOP_MM) : r.offsetMm }
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
                          clothesRails: rows.map((r, j) => (j === i ? newMiddleRail() : r)),
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
                      <Input
                        id={`rail-off-${z.id}-${i}`}
                        type="number"
                        min={1}
                        value={rail.offsetMm}
                        onChange={(e) =>
                          patchZone(z.id, {
                            clothesRails: rows.map((r, j) =>
                              j === i ? { ...r, offsetMm: e.target.value } : r,
                            ),
                            hasClothesRail: true,
                          })
                        }
                      />
                    </div>
                  )}
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {`${clothesRailMeasureLabel(
                      { from: rail.from, offsetMm: parseInt(rail.offsetMm, 10) || 0 },
                      topBoardCaption,
                    )}${rail.from === 'middle' ? '.' : '. Линията е на 3D изгледа.'}`}
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
          {pendingAdd?.kind === 'rail' && (
            <WherePicker
              zones={layout.zones}
              allowFull
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
          summary={
            isSlidingCabinet
              ? doorCount > 0
                ? `Плъзгащи ${doorCount}`
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
                  ? 'Две плъзгащи врати покриват целия гардероб и се препокриват с 10 мм. Кант дръжка или тапа се слага след рязането.'
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
                      setDoorCount(2)
                      setDoorSpan('full')
                      setSlidingEdges(defaultSlidingEdges(2))
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
                    variant={doorCount === 2 ? 'default' : 'outline'}
                    onClick={() => {
                      setDoorCount(2)
                      setDoorSpan('full')
                      setPendingAdd(null)
                      clearZoneDoors()
                    }}
                  >
                    2 врати
                  </Button>
                </div>
              )}
              {doorCount === 2 &&
                !effectiveExternalDoors &&
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
              <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
                {doorCount !== 2 || !nsMeasure
                  ? 'Без плъзгащи врати.'
                  : layoutSlidingDoors({
                      innerW: nsMeasure.innerW,
                      innerH: nsMeasure.innerH,
                      thickness: params.thickness,
                      partitions: layout.partitions,
                      edges: slidingEdges,
                    })
                      .map((leaf) =>
                        effectiveExternalDoors
                          ? `${leaf.name}: поръчай габарит ${Math.round(leaf.gabaritW)} × ${Math.round(leaf.gabaritH)} мм.`
                          : `${leaf.name}: габарит ${Math.round(leaf.gabaritW)} × ${Math.round(leaf.gabaritH)} мм · рязане ${Math.round(leaf.cutW)} × ${Math.round(leaf.cutH)} мм (ляво ${slidingEdgeLabel(leaf.edges.left)} ${slidingProfileMm(leaf.edges.left)} мм, дясно ${slidingEdgeLabel(leaf.edges.right)} ${slidingProfileMm(leaf.edges.right)} мм).`,
                      )
                      .join(' ')}
              </p>
              {doorCount === 2 && (
                <DoorSourcePicker
                  external={effectiveExternalDoors}
                  projectForced={projectExternalDoors}
                  onChange={setExternalDoors}
                />
              )}
            </>
          ) : (
            <>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            {hasSplit
              ? 'Могат да са на една част или на целия шкаф. Долу на 0, горе фуга 3 мм.'
              : 'Долу на 0, горе фуга 3 мм, странично 1.5 мм отляво и отдясно.'}
          </p>
          <div className="mt-1 flex gap-2">
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
            {([1, 2] as const).map((n) => (
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
                {n === 1 ? '1 врата' : '2 врати'}
              </Button>
            ))}
          </div>
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
                {doorCount === 1 ? '1 врата' : '2 врати'} · {FULL_CABINET_LABEL}
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
                    {zoneOf(zoneUi, z.id).doorCount === 1 ? '1 врата' : '2 врати'} · {z.label} · фронт{' '}
                    {Math.round(z.frontHeight)} мм
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
              ? 'Без врати — шкафът може да е само с чекмеджета.'
              : doorSizeHint(
                  params.width,
                  frontH,
                  layout,
                  drawerFrontHeights,
                  doorCount,
                  doorSpan,
                  !effectiveExternalDoors,
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
              checked={includeHandles}
              onCheckedChange={(c) => setIncludeHandles(c === true)}
            />
            Дръжки в цената
          </label>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {(() => {
              const n = counts.doorCount + counts.drawerCount
              if (n === 0) return 'По 1 обикновена дръжка на врата и на чекмедже.'
              if (!includeHandles) return 'Дръжките не влизат в цената.'
              const unit = settings.hardware.handleNormalEur
              return `${n} бр. ${HANDLE_NORMAL.name} · по 1 на врата и на чекмедже · ${formatEur(unit)}/бр. = ${formatEur(n * unit)}`
            })()}
          </p>
            </>
          )}
        </FormSection>

        <FormSection defaultOpen={false}
          title="Чекмеджета"
          summary={counts.drawerCount > 0 ? `${counts.drawerCount} бр.` : 'няма'}
        >
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            Отгоре надолу в избраната част, всяко със своя височина.
          </p>
          <div className="mt-2 space-y-2">
            {drawerFrontHeights.map((value, i) => (
              <div key={`full-${i}`} className="flex items-center gap-2">
                <Label htmlFor={`drawer-h-full-${i}`} className="w-36 shrink-0 text-xs">
                  Чело {i + 1}{hasSplit ? ` · ${FULL_CABINET_LABEL}` : ''} (мм)
                </Label>
                <Input
                  id={`drawer-h-full-${i}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={value}
                  onChange={(e) =>
                    setDrawerFrontHeights((rows) => rows.map((v, j) => (j === i ? e.target.value : v)))
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
                    <Input
                      id={`drawer-h-${z.id}-${i}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={value}
                      onChange={(e) =>
                        patchZone(z.id, {
                          drawerFrontHeights: zoneOf(zoneUi, z.id).drawerFrontHeights.map((v, j) =>
                            j === i ? e.target.value : v,
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
                        patchZone(z.id, {
                          drawerFrontHeights: hasDoor
                            ? nextRows
                            : filledDrawerRows(
                                z.frontHeight,
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
              disabled={counts.drawerCount >= MAX_DRAWERS}
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
                    return `${z.label}: ${drawerHint(z.frontHeight, hasDoor ? zoneOf(zoneUi, z.id).doorCount : 0, heights, z.y0 <= 0.5 ? drawerBottomGap : 0)}`
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
                !hasSplit || doorSpan === 'full' ? doorCount : 0,
                cutFromOneBoard,
                adjacentCombine,
              )}
            </p>
          </FormSection>
        )}

        {counts.drawerCount > 0 && (
          <FormSection defaultOpen={false}
            title="Водачи"
            summary={
              slideKind === 'roller' ? 'Ролкови' : slideKind === 'soft-full' ? 'Плавно пълно' : 'Плавно частично'
            }
          >
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
                      : ` · влиза в корпус ${slideDepth} мм`}
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
                drawerFrontHeights: number[]
                width: number
                thickness: number
              }
              return [...new Set(allDrawerFrontHeights(layout))].map((drawerH) => {
              const box = drawerBoxRails(
                fit.width,
                fit.thickness,
                drawerH,
                fit.slideLength,
                isSoftCloseSlide(fit.slideKind),
              )
              if (!box) return null
              const many = counts.drawerCount > 1
              return (
                <p key={drawerH} className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Царги{many ? ` ${drawerH} мм` : ''}: вътрешни {Math.round(box.inner.width)}×{Math.round(box.inner.height)} мм (2 бр.) · външни{' '}
                  {Math.round(box.outer.width)}×{Math.round(box.outer.height)} мм (2 бр.) · кутия {Math.round(box.drawerOuterW)} мм
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
            {typeId === 'nightstand' && (
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

            {typeId === 'nightstand' && useLegs ? (
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
                    <Input
                      id="plinth-height"
                      type="number"
                      inputMode="numeric"
                      min={40}
                      max={150}
                      value={plinthHeight}
                      onChange={(e) => setPlinthHeight(e.target.value)}
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
            По подразбиране плоскостите са еднакви. Смени само ако трябва да се отличават.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {PART_COLOR_FIELDS.filter(({ key }) => {
              if (typeId === 'kitchen-wall') {
                if (key === 'leg') return false
                if (key === 'shelf' && counts.shelfCount === 0 && counts.fixedShelves === 0) return false
              }
              if (typeId === 'nightstand' || typeId === 'section' || typeId === 'wardrobe') {
                if (key === 'shelf' && counts.shelfCount === 0 && counts.fixedShelves === 0) return false
                if (key === 'leg' && (typeId === 'section' || typeId === 'wardrobe' || !useLegs)) return false
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
              onClick={() => setColors({ ...DEFAULT_PART_COLORS })}
            >
              Еднакви
            </Button>
          </div>
        </FormSection>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={showDimLines}
              onCheckedChange={(c) => setShowDimLines(c === true)}
            />
            Оразмерителни линии
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={showFronts}
              onCheckedChange={(c) => setShowFronts(c === true)}
            />
            Покажи вратите и челата
          </label>
        </div>

        <CabinetPreview typeId={typeId} params={{ ...params }} showDimLines={showDimLines} showFronts={showFronts} />

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
                      </td>
                      <td className={cn('px-3 py-2 tabular-nums', groupEdge('mid'))}>
                        {panel.width} × {panel.height} мм
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

        <Button className="w-full" onClick={handleSave} disabled={!!error}>
          <Box className="h-4 w-4" />
          {isEdit ? 'Запази промените' : 'Добави в разкроя'}
        </Button>
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
      const prefix = multiCol ? `${columnLabel(c, Math.max(colCount, byCol.size)).replace(/ част$/, '')}: ` : ''
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

function doorSizeHint(
  width: number,
  frontH: number,
  layout: InteriorLayout,
  drawerFrontHeights: string[],
  doorCount: 0 | 1 | 2,
  doorSpan: DoorSpan,
  subtractEdge = true,
): string {
  const fullDrawers = drawerFrontHeights.map((s) => parseInt(s, 10) || 0).filter((n) => n > 0)
  const edge = subtractEdge ? DOOR_EDGE_BOTH : 0
  const cutOpts = subtractEdge ? undefined : { subtractEdge: false as const }
  const parts: string[] = []
  if (doorSpan === 'full' && (doorCount === 1 || doorCount === 2)) {
    const leftover = remainingFrontHeight(frontH, fullDrawers, true)
    if (leftover <= edge) parts.push('Няма място за врата на целия шкаф.')
    else {
      const d = doorCutSize(width, frontH, doorCount, cutOpts)
      parts.push(
        `Цял шкаф: ${subtractEdge ? 'рязане' : 'поръчай'} ${Math.round(d.width)} × ${Math.round(leftover - edge)} мм · ${doorCutRuleNote({ withDrawerGaps: fullDrawers.length > 0, subtractEdge })}`,
      )
    }
  }
  for (const z of layout.zones) {
    if (layout.shelves.length === 0 && layout.partitions.length === 0) continue
    if (!(z.doorCount === 1 || z.doorCount === 2)) continue
    const leftover = remainingFrontHeight(z.frontHeight, z.drawerFrontHeights, true)
    if (leftover <= edge) {
      parts.push(`${z.label}: няма място за врата.`)
      continue
    }
    const w = z.frontWidth > 0 ? z.frontWidth : width
    const d = doorCutSize(w, leftover + DOOR_CLEARANCE_TOP, z.doorCount, cutOpts)
    parts.push(
      `${z.label}: ${subtractEdge ? 'рязане' : 'поръчай'} ${Math.round(d.width)} × ${Math.round(leftover - edge)} мм (отвор ${Math.round(z.frontHeight)} мм, ${doorCutRuleNote({ subtractEdge })})`,
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
): string | null {
  if (typeId !== 'kitchen-base' && typeId !== 'kitchen-wall' && typeId !== 'nightstand' && typeId !== 'section' && typeId !== 'wardrobe') return null
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
  const zoneErr = validateZoneFronts(layout, frontH, clearanceBottom)
  if (zoneErr) return zoneErr
  if (layout.shelves.length === 0 && layout.partitions.length === 0) {
    const leftover = remainingFrontHeight(frontH, p.drawerFrontHeights, hingedDoors > 0, clearanceBottom)
    if (leftover < 0) {
      return clearanceBottom > 0
        ? `Челата на чекмеджетата не събират във височината (фуга ${DOOR_CLEARANCE_TOP} мм отгоре, ${clearanceBottom} мм отдолу заради лайсната и ${DRAWER_DOOR_GAP} мм между тях).`
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
): string {
  if (drawerFrontHeights.length === 0) {
    return 'Добави едно или повече чекмеджета — могат да са с различни височини, с или без врата отдолу.'
  }
  const leftover = remainingFrontHeight(frontHeight, drawerFrontHeights, doorCount > 0, clearanceBottom)
  const bottomNote =
    clearanceBottom > 0
      ? `${clearanceBottom} мм отдолу (${SLIDING_BOTTOM_TRACK_MM} мм лайсна + ${clearanceBottom - SLIDING_BOTTOM_TRACK_MM} мм да не търкат)`
      : null
  if (doorCount > 0) {
    return leftover > 0
      ? `Вратата отдолу е ${Math.round(leftover)} мм. ${doorCutRuleNote({ withDrawerGaps: true })}.`
      : 'Челата заемат целия корпус — няма място за врата.'
  }
  if (leftover > 4) {
    return leftover >= 80
      ? `Остават ${Math.round(leftover)} мм. „Разпредели поравно“ ги слага в челата (фуга ${DOOR_CLEARANCE_TOP} мм отгоре, ${DRAWER_DOOR_GAP} мм между тях${bottomNote ? `, ${bottomNote}` : ''}) или добави врата отдолу.`
      : `Остават ${Math.round(leftover)} мм. Натисни „Разпредели поравно“, за да влязат в челата с фугите.`
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
  if (doorCount === 2) {
    return 'Челата се режат от една плоча за продължена фладера, кантират се, после се разрязват. Двете врати са по-тесни и се режат отделно.'
  }
  if (withDoor) {
    return 'Челата и вратата се режат от една плоча за продължена фладера, кантират се, после се разрязват.'
  }
  return 'Челата се режат от една плоча за продължена фладера, кантират се, после се разрязват.'
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
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
      />
    </div>
  )
}

const selectClass = cn(
  'flex h-9 w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-1 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
)
