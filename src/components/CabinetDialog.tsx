import { useMemo, useState } from 'react'
import { Box, Plus, Trash2 } from 'lucide-react'
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
  DEFAULT_NIGHTSTAND_PARAMS,
  DEFAULT_PART_COLORS,
  DEFAULT_SECTION_PARAMS,
  DEFAULT_SHELF_FRONT_INSET,
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
  parseNightstandParams,
  parseSectionParams,
  parseSlideKind,
  scaleCabinetResult,
  slideUnitPriceEur,
  drawerBoxRails,
  remainingFrontHeight,
  equalDrawerFrontHeights,
  drawerFrontsAreEven,
  canCombineFronts,
  doorCutSize,
  doorCutRuleNote,
  DOOR_CLEARANCE_TOP,
  DRAWER_DOOR_GAP,
  DEFAULT_DRAWER_FRONT_HEIGHT,
  DRAWER_RAIL_BELOW_FRONT,
  MAX_DRAWERS,
  MAX_SHELVES,
  evenShelfGap,
  clothesRailLengthMm,
  hardboardCutSize,
  type CabinetInstance,
  type CabinetPartColors,
  type SlideKind,
  type CabinetZoneId,
  type DoorSpan,
  type ZoneFittings,
  MAX_FIXED_SHELVES,
  defaultFixedOffsetMm,
  defaultShelfFaces,
  fixedShelfMeasureLabel,
  layoutInterior,
  fittingsCountsFromParams,
  allDrawerFrontHeights,
  validateZoneFronts,
  type InteriorLayout,
  type PanelFace,
} from '@/lib/cabinets'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import type { AssemblyTimeSettings } from '@/lib/assembly-time'
import { DEFAULT_ASSEMBLY_TIME_SETTINGS } from '@/lib/assembly-time'
import { CabinetSizeBadge } from '@/components/CabinetSizeBadge'
import type { Sheet } from '@/types'
import { cn, formatMeters } from '@/lib/utils'

type ZoneUi = {
  shelfCount: number
  doorCount: 0 | 1 | 2
  drawerFrontHeights: string[]
  cutFromOneBoard: boolean
  hasClothesRail: boolean
}

function emptyZoneUi(): ZoneUi {
  return { shelfCount: 0, doorCount: 0, drawerFrontHeights: [], cutFromOneBoard: false, hasClothesRail: false }
}

function parseZoneUi(raw: ZoneFittings | undefined): ZoneUi {
  if (!raw) return emptyZoneUi()
  return {
    shelfCount: raw.shelfCount,
    doorCount: raw.doorCount,
    drawerFrontHeights: raw.drawerFrontHeights.map(String),
    cutFromOneBoard: raw.cutFromOneBoard,
    hasClothesRail: raw.hasClothesRail,
  }
}

function zoneUiToParams(z: ZoneUi): ZoneFittings {
  return {
    shelfCount: z.shelfCount,
    doorCount: z.doorCount,
    drawerFrontHeights: z.drawerFrontHeights.map((s) => parseInt(s, 10) || 0).filter((n) => n > 0),
    cutFromOneBoard: z.cutFromOneBoard,
    hasClothesRail: z.hasClothesRail,
  }
}

function filledDrawerRows(frontHeight: number, count: number, hasDoor: boolean): string[] {
  if (count < 1) return []
  if (hasDoor) return Array.from({ length: count }, () => String(DEFAULT_DRAWER_FRONT_HEIGHT))
  return equalDrawerFrontHeights(frontHeight, count).map(String)
}

type FrontTarget = CabinetZoneId | 'full'
type PendingAdd =
  | { kind: 'shelf' }
  | { kind: 'drawer' }
  | { kind: 'door'; count: 1 | 2 }
  | { kind: 'rail' }

const FULL_CABINET_LABEL = 'На целия шкаф'

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
    : DEFAULT_KITCHEN_BASE_PARAMS

  const initialBox =
    editing && editing.typeId === 'section'
      ? parseSectionParams(editing.params)
      : editing && editing.typeId === 'nightstand'
        ? parseNightstandParams(editing.params)
        : DEFAULT_NIGHTSTAND_PARAMS

  const initialFittings =
    editing?.typeId === 'kitchen-base'
      ? initialKitchen
      : editing?.typeId === 'nightstand' || editing?.typeId === 'section'
        ? initialBox
        : initialKitchen

  const [width, setWidth] = useState(String(editing?.params.width ?? DEFAULT_KITCHEN_BASE_PARAMS.width))
  const [height, setHeight] = useState(String(editing?.params.height ?? DEFAULT_KITCHEN_BASE_PARAMS.height))
  const [depth, setDepth] = useState(String(editing?.params.depth ?? DEFAULT_KITCHEN_BASE_PARAMS.depth))
  const [thickness, setThickness] = useState(String(editing?.params.thickness ?? DEFAULT_KITCHEN_BASE_PARAMS.thickness))
  const [legHeight, setLegHeight] = useState(initialKitchen.legHeight === 150 ? 150 : 100)
  const [shelfCount, setShelfCount] = useState(initialFittings.shelfCount)
  const [hasBack, setHasBack] = useState(initialFittings.hasBack)
  const [hasClothesRail, setHasClothesRail] = useState(initialFittings.hasClothesRail === true)
  const [doorCount, setDoorCount] = useState(initialFittings.doorCount)
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
  
  const [quantity, setQuantity] = useState(String(editing?.quantity ?? 1))
  const [showDimLines, setShowDimLines] = useState(false)
  const [showFronts, setShowFronts] = useState(false)
  const [fixedShelves, setFixedShelves] = useState<
    { from: 'bottom' | 'top'; fromFace: PanelFace; toFace: PanelFace; offsetMm: string }[]
  >(
    (initialFittings.fixedShelves ?? []).map((s) => {
      const faces = defaultShelfFaces(s.from)
      return {
        from: s.from,
        fromFace: s.fromFace ?? faces.fromFace,
        toFace: s.toFace ?? faces.toFace,
        offsetMm: String(s.offsetMm),
      }
    }),
  )
  const [doorSpan, setDoorSpan] = useState<DoorSpan>(initialFittings.doorSpan === 'zones' ? 'zones' : 'full')
  const [zoneUi, setZoneUi] = useState<Record<CabinetZoneId, ZoneUi>>({
    bottom: parseZoneUi(initialFittings.zones?.bottom),
    middle: parseZoneUi(initialFittings.zones?.middle),
    top: parseZoneUi(initialFittings.zones?.top),
  })
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null)
  const [colors, setColors] = useState<CabinetPartColors>({
    ...DEFAULT_PART_COLORS,
    ...(editing?.params.colors as CabinetPartColors | undefined),
  })

  const params = useMemo(() => {
    const hasFixed = fixedShelves.length > 0
    const fittings = {
      shelfCount: hasFixed ? 0 : shelfCount,
      hasBack,
      hasClothesRail: hasFixed ? false : hasClothesRail,
      doorCount,
      drawerFrontHeights: drawerFrontHeights.map((s) => parseInt(s, 10) || 0).filter((n) => n > 0),
      cutFromOneBoard,
      includeHandles,
      slideKind,
      slideLength,
      fixedShelves: fixedShelves
        .map((s) => ({
          from: s.from,
          fromFace: s.fromFace,
          toFace: s.toFace,
          offsetMm: parseInt(s.offsetMm, 10) || 0,
        }))
        .filter((s) => s.offsetMm > 0),
      doorSpan: hasFixed ? doorSpan : 'full' as DoorSpan,
      zones: hasFixed
        ? {
            bottom: { ...zoneUiToParams(zoneUi.bottom), cutFromOneBoard },
            middle: { ...zoneUiToParams(zoneUi.middle), cutFromOneBoard },
            top: { ...zoneUiToParams(zoneUi.top), cutFromOneBoard },
          }
        : {},
    }
    if (typeId === 'nightstand') {
      return parseNightstandParams({
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        depth: parseInt(depth, 10),
        thickness: parseInt(thickness, 10),
        useLegs,
        plinthCount,
        plinthHeight: parseInt(plinthHeight, 10),
        legHeight,
        colors,
        ...fittings,
      })
    }
    if (typeId === 'section') {
      return parseSectionParams({
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        depth: parseInt(depth, 10),
        thickness: parseInt(thickness, 10),
        useLegs: false,
        plinthCount,
        plinthHeight: parseInt(plinthHeight, 10),
        colors,
        ...fittings,
      })
    }

    return parseKitchenBaseParams({
      width: parseInt(width, 10),
      height: parseInt(height, 10),
      depth: parseInt(depth, 10),
      thickness: parseInt(thickness, 10),
      legHeight,
      railWidth: DEFAULT_KITCHEN_BASE_PARAMS.railWidth,
      colors,
      ...fittings,
    })
  }, [typeId, width, height, depth, thickness, legHeight, shelfCount, hasBack, hasClothesRail, doorCount, drawerFrontHeights, cutFromOneBoard, includeHandles, slideKind, slideLength, useLegs, plinthCount, plinthHeight, colors, fixedShelves, doorSpan, zoneUi])

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
  const slideDepth =
    typeId === 'kitchen-base'
      ? (params as ReturnType<typeof parseKitchenBaseParams>).depth
      : measureNightstand(params as ReturnType<typeof parseNightstandParams>, typeId === 'section').sideD
  const hasFittings = typeId === 'kitchen-base' || typeId === 'nightstand' || typeId === 'section'
  const innerH =
    typeId === 'kitchen-base'
      ? params.height - 2 * params.thickness
      : measureNightstand(params as ReturnType<typeof parseNightstandParams>, typeId === 'section').innerH
  const frontH = dialogFrontHeight(typeId, params)
  const layout = layoutInterior({
    innerH,
    thickness: params.thickness,
    fixedShelves: params.fixedShelves ?? [],
    doorSpan: params.doorSpan ?? 'full',
    doorCount: params.doorCount,
    shelfCount: params.shelfCount,
    drawerFrontHeights: params.drawerFrontHeights,
    cutFromOneBoard: params.cutFromOneBoard,
    hasClothesRail: params.hasClothesRail,
    zones: params.zones,
  })
  const error = validate(typeId, params, layout, frontH)
  const counts = fittingsCountsFromParams(params)
  const hasFixed = (params.fixedShelves?.length ?? 0) > 0
  const shelfGap = evenShelfGap(innerH, shelfCount, params.thickness)
  const backPlinth =
    typeId !== 'kitchen-base' && !(params as ReturnType<typeof parseNightstandParams>).useLegs
      ? (params as ReturnType<typeof parseNightstandParams>).plinthHeight
      : 0
  const backCut = hardboardCutSize(params.width, params.height, backPlinth)

  const patchZone = (id: CabinetZoneId, next: Partial<ZoneUi>) => {
    setZoneUi((z) => ({ ...z, [id]: { ...z[id], ...next } }))
  }

  const clearZoneDoors = () => {
    setZoneUi((z) => ({
      bottom: { ...z.bottom, doorCount: 0 },
      middle: { ...z.middle, doorCount: 0 },
      top: { ...z.top, doorCount: 0 },
    }))
  }

  const applyPending = (target: FrontTarget) => {
    if (!pendingAdd) return
    if (pendingAdd.kind === 'shelf') {
      if (target === 'full') {
        setZoneUi((z) => {
          const next = { ...z }
          for (const zone of layout.zones) {
            next[zone.id] = {
              ...next[zone.id],
              shelfCount: Math.min(MAX_SHELVES, next[zone.id].shelfCount + 1),
            }
          }
          return next
        })
      } else {
        patchZone(target, { shelfCount: Math.min(MAX_SHELVES, zoneUi[target].shelfCount + 1) })
      }
    } else if (pendingAdd.kind === 'drawer') {
      if (target === 'full') {
        const hasDoor = !hasFixed || doorSpan === 'full' ? doorCount > 0 : false
        setDrawerFrontHeights((rows) =>
          hasDoor
            ? [...rows, String(DEFAULT_DRAWER_FRONT_HEIGHT)]
            : filledDrawerRows(frontH, rows.length + 1, false),
        )
      } else {
        const hasDoor = doorSpan === 'zones' && zoneUi[target].doorCount > 0
        const zone = layout.zones.find((z) => z.id === target)
        const n = zoneUi[target].drawerFrontHeights.length + 1
        if (zone && !hasDoor) {
          patchZone(target, { drawerFrontHeights: filledDrawerRows(zone.frontHeight, n, false) })
        } else {
          patchZone(target, {
            drawerFrontHeights: [...zoneUi[target].drawerFrontHeights, String(DEFAULT_DRAWER_FRONT_HEIGHT)],
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
      if (target === 'full') {
        setZoneUi((z) => {
          const next = { ...z }
          for (const zone of layout.zones) {
            next[zone.id] = { ...next[zone.id], hasClothesRail: true }
          }
          return next
        })
      } else {
        patchZone(target, { hasClothesRail: true })
      }
    }
    setPendingAdd(null)
  }

  const startAdd = (next: PendingAdd) => {
    if (hasFixed && !layout.error) {
      setPendingAdd(next)
      return
    }
    if (next.kind === 'shelf') setShelfCount((n) => Math.min(MAX_SHELVES, n + 1))
    else if (next.kind === 'drawer') {
      setDrawerFrontHeights((rows) =>
        doorCount > 0
          ? [...rows, String(DEFAULT_DRAWER_FRONT_HEIGHT)]
          : filledDrawerRows(frontH, rows.length + 1, false),
      )
    }
    else if (next.kind === 'door') setDoorCount(next.count)
    else if (next.kind === 'rail') setHasClothesRail(true)
  }

  const parseDrawerRows = (rows: string[]) =>
    rows.map((s) => parseInt(s, 10) || 0).filter((n) => n > 0)

  const fullDrawerHasDoor = !hasFixed || doorSpan === 'full' ? doorCount > 0 : false
  const fullDrawerNums = parseDrawerRows(drawerFrontHeights)
  const canEqualizeFull =
    fullDrawerNums.length >= 1 && !fullDrawerHasDoor && !drawerFrontsAreEven(frontH, fullDrawerNums)
  const zoneEqualizeIds = hasFixed
    ? layout.zones
        .filter((z) => {
          const heights = parseDrawerRows(zoneUi[z.id].drawerFrontHeights)
          const hasDoor = doorSpan === 'zones' && zoneUi[z.id].doorCount > 0
          return heights.length >= 1 && !hasDoor && !drawerFrontsAreEven(z.frontHeight, heights)
        })
        .map((z) => z.id)
    : []
  const canEqualizeDrawers = canEqualizeFull || zoneEqualizeIds.length > 0
  const showCombineFronts =
    canCombineFronts(fullDrawerNums.length, fullDrawerHasDoor ? doorCount : 0) ||
    (hasFixed &&
      layout.zones.some((z) =>
        canCombineFronts(
          parseDrawerRows(zoneUi[z.id].drawerFrontHeights).length,
          doorSpan === 'zones' ? zoneUi[z.id].doorCount : 0,
        ),
      ))

  const equalizeDrawers = () => {
    if (canEqualizeFull) {
      setDrawerFrontHeights(equalDrawerFrontHeights(frontH, fullDrawerNums.length).map(String))
    }
    if (zoneEqualizeIds.length > 0) {
      setZoneUi((z) => {
        const next = { ...z }
        for (const id of zoneEqualizeIds) {
          const zone = layout.zones.find((row) => row.id === id)
          if (!zone) continue
          const n = parseDrawerRows(next[id].drawerFrontHeights).length
          next[id] = {
            ...next[id],
            drawerFrontHeights: equalDrawerFrontHeights(zone.frontHeight, n).map(String),
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
                  setShelfCount(0)
                  setHasBack(false)
                  setHasClothesRail(false)
                  setDoorCount(0)
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
                  setShelfCount(0)
                  setHasBack(false)
                  setHasClothesRail(false)
                  setDoorCount(0)
                  setDrawerFrontHeights([])
                  setCutFromOneBoard(false)
                  setIncludeHandles(true)
                  setFixedShelves([])
                  setDoorSpan('full')
                  setZoneUi({ bottom: emptyZoneUi(), middle: emptyZoneUi(), top: emptyZoneUi() })
                } else if (id === 'kitchen-base') {
                  setWidth(String(DEFAULT_KITCHEN_BASE_PARAMS.width))
                  setHeight(String(DEFAULT_KITCHEN_BASE_PARAMS.height))
                  setDepth(String(DEFAULT_KITCHEN_BASE_PARAMS.depth))
                  setThickness(String(DEFAULT_KITCHEN_BASE_PARAMS.thickness))
                  setHasBack(DEFAULT_KITCHEN_BASE_PARAMS.hasBack)
                  setHasClothesRail(false)
                  setIncludeHandles(true)
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
            <div>
              <Label>Крачета</Label>
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
            </div>
            )}

            <div>
              <Label>Фиксиран рафт</Label>
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                Хваща се с винтове 5×60 през страниците и разделя шкафа. До 2 рафта — 3 части (долна, средна, горна).
              </p>
              {fixedShelves.map((shelf, i) => (
                <div key={i} className="mt-2 space-y-2 rounded-md border border-[var(--color-border)] p-2">
                  <div className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-xs">Рафт {i + 1}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        const next = fixedShelves.filter((_, j) => j !== i)
                        if (next.length === 0) {
                          setShelfCount(
                            zoneUi.bottom.shelfCount + zoneUi.middle.shelfCount + zoneUi.top.shelfCount,
                          )
                          setDrawerFrontHeights([
                            ...zoneUi.top.drawerFrontHeights,
                            ...zoneUi.middle.drawerFrontHeights,
                            ...zoneUi.bottom.drawerFrontHeights,
                          ])
                          setHasClothesRail(
                            zoneUi.bottom.hasClothesRail || zoneUi.middle.hasClothesRail || zoneUi.top.hasClothesRail,
                          )
                          if (doorSpan === 'zones') {
                            const first = [zoneUi.top, zoneUi.middle, zoneUi.bottom].find((z) => z.doorCount > 0)
                            setDoorCount(first?.doorCount ?? 0)
                          }
                          setCutFromOneBoard(zoneUi.bottom.cutFromOneBoard)
                        }
                        setFixedShelves(next)
                      }}
                      aria-label={`Премахни фиксиран рафт ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
                    От {shelf.from === 'bottom' ? 'дъното' : typeId === 'kitchen-base' ? 'блендата' : 'плота'}
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
                      typeId === 'kitchen-base' ? 'блендата' : 'плота',
                    )}. Линията е на 3D изгледа.`}
                  </p>
                </div>
              ))}
              <div className="mt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={fixedShelves.length >= MAX_FIXED_SHELVES}
                  onClick={() => {
                    const offset = defaultFixedOffsetMm(innerH, params.thickness, fixedShelves.length)
                    if (fixedShelves.length === 0) {
                      setZoneUi({
                        bottom: {
                          ...emptyZoneUi(),
                          shelfCount,
                          hasClothesRail,
                        },
                        middle: emptyZoneUi(),
                        top: emptyZoneUi(),
                      })
                      setDoorSpan(doorCount > 0 ? 'full' : 'zones')
                      setShelfCount(0)
                      setHasClothesRail(false)
                      setPendingAdd(null)
                      setFixedShelves([
                        { from: 'bottom', ...defaultShelfFaces('bottom'), offsetMm: String(offset) },
                      ])
                    } else {
                      setFixedShelves((rows) => [
                        ...rows,
                        { from: 'top', ...defaultShelfFaces('top'), offsetMm: String(offset) },
                      ])
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Добави фиксиран рафт
                </Button>
              </div>
              {layout.error && (
                <p className="mt-1 text-xs text-[var(--color-destructive)]">{layout.error}</p>
              )}
              {hasFixed && !layout.error && (
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Шкафът е разделен на {layout.zones.length} части:{' '}
                  {layout.zones.map((z) => `${z.label} ${Math.round(z.innerH)} мм`).join(' · ')}. При
                  рафт, врата или чекмедже се пита в коя част.
                </p>
              )}
            </div>

            <div>
              <Label>Рафтове</Label>
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                {hasFixed
                  ? 'Подвижни рафтове с рафтоносачи — във всяка част отделно.'
                  : 'Равни празнини над, между и под рафтовете.'}
              </p>
              {!hasFixed && shelfCount > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="w-28 shrink-0 text-xs">
                    {shelfCount} {shelfCount === 1 ? 'рафт' : 'рафта'}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setShelfCount((n) => Math.max(0, n - 1))}
                    aria-label="Премахни рафт"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {hasFixed &&
                layout.zones.map((z) =>
                  zoneUi[z.id].shelfCount > 0 ? (
                    <div key={z.id} className="mt-2 flex items-center gap-2">
                      <span className="shrink-0 text-xs">
                        {zoneUi[z.id].shelfCount} {zoneUi[z.id].shelfCount === 1 ? 'рафт' : 'рафта'} · {z.label}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => patchZone(z.id, { shelfCount: Math.max(0, zoneUi[z.id].shelfCount - 1) })}
                        aria-label={`Премахни рафт от ${z.label}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null,
                )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={pendingAdd?.kind === 'shelf' ? 'default' : 'outline'}
                  disabled={counts.shelfCount >= MAX_SHELVES * Math.max(1, layout.zones.length)}
                  onClick={() => startAdd({ kind: 'shelf' })}
                >
                  <Plus className="h-4 w-4" />
                  Добави рафт
                </Button>
              </div>
              {pendingAdd?.kind === 'shelf' && (
                <WherePicker
                  zones={layout.zones}
                  allowFull
                  onPick={applyPending}
                  onCancel={() => setPendingAdd(null)}
                />
              )}
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {counts.shelfCount === 0
                  ? 'Без подвижен рафт'
                  : hasFixed
                    ? `${counts.shelfCount * SHELF_PINS_PER_SHELF} рафтоносача · ${formatEur(settings.hardware.shelfPinEur)}/бр.`
                    : `Разстояние между рафтовете: ${Math.round(shelfGap)} мм · ${shelfCount * SHELF_PINS_PER_SHELF} рафтоносача · ${formatEur(settings.hardware.shelfPinEur)}/бр. · дълбочина ${slideDepth - DEFAULT_SHELF_FRONT_INSET} мм`}
              </p>
            </div>

        <div>
          <Label>Фазер на гърба</Label>
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
        </div>

        <div>
          <Label>Лост за дрехи</Label>
          <div className="mt-1 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={
                (hasFixed ? counts.clothesRailCount > 0 : hasClothesRail) || pendingAdd?.kind === 'rail'
                  ? 'default'
                  : 'outline'
              }
              onClick={() => startAdd({ kind: 'rail' })}
            >
              С лост
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!(hasFixed ? counts.clothesRailCount > 0 : hasClothesRail) ? 'default' : 'outline'}
              onClick={() => {
                setPendingAdd(null)
                setHasClothesRail(false)
                setZoneUi((z) => ({
                  bottom: { ...z.bottom, hasClothesRail: false },
                  middle: { ...z.middle, hasClothesRail: false },
                  top: { ...z.top, hasClothesRail: false },
                }))
              }}
            >
              Без
            </Button>
          </div>
          {pendingAdd?.kind === 'rail' && (
            <WherePicker
              zones={layout.zones}
              allowFull
              onPick={applyPending}
              onCancel={() => setPendingAdd(null)}
            />
          )}
          {hasFixed &&
            layout.zones
              .filter((z) => zoneUi[z.id].hasClothesRail)
              .map((z) => (
                <p key={z.id} className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Лост в {z.label}.
                </p>
              ))}
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {(hasFixed ? counts.clothesRailCount > 0 : hasClothesRail)
              ? `Лост ${clothesRailLengthMm(params.width, params.thickness)} мм между страниците · ${formatEur(settings.hardware.clothesRailEurPerM)}/м.`
              : 'Без лост.'}
          </p>
        </div>

        <div>
          <Label>Врати</Label>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            {hasFixed
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
                    : !hasFixed && doorCount === n
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
          {hasFixed && doorSpan === 'full' && doorCount > 0 && (
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
          {hasFixed &&
            layout.zones.map((z) =>
              zoneUi[z.id].doorCount > 0 ? (
                <div key={z.id} className="mt-2 flex items-center gap-2">
                  <span className="text-xs">
                    {zoneUi[z.id].doorCount === 1 ? '1 врата' : '2 врати'} · {z.label} · фронт{' '}
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
              : doorSizeHint(params.width, frontH, layout, drawerFrontHeights, doorCount, doorSpan)}
          </p>
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
        </div>

        <div>
          <Label>Чекмеджета</Label>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            Отгоре надолу в избраната част, всяко със своя височина.
          </p>
          <div className="mt-2 space-y-2">
            {drawerFrontHeights.map((value, i) => (
              <div key={`full-${i}`} className="flex items-center gap-2">
                <Label htmlFor={`drawer-h-full-${i}`} className="w-36 shrink-0 text-xs">
                  Чело {i + 1}{hasFixed ? ` · ${FULL_CABINET_LABEL}` : ''} (мм)
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
                      return filledDrawerRows(frontH, next.length, false)
                    })
                  }
                  aria-label={`Премахни чекмедже ${i + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {hasFixed &&
              layout.zones.flatMap((z) =>
                zoneUi[z.id].drawerFrontHeights.map((value, i) => (
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
                          drawerFrontHeights: zoneUi[z.id].drawerFrontHeights.map((v, j) =>
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
                        const nextRows = zoneUi[z.id].drawerFrontHeights.filter((_, j) => j !== i)
                        const hasDoor = doorSpan === 'zones' && zoneUi[z.id].doorCount > 0
                        patchZone(z.id, {
                          drawerFrontHeights: hasDoor
                            ? nextRows
                            : filledDrawerRows(z.frontHeight, nextRows.length, false),
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
            {hasFixed
              ? [
                  fullDrawerNums.length > 0
                    ? drawerHint(frontH, fullDrawerHasDoor ? doorCount : 0, fullDrawerNums)
                    : null,
                  ...layout.zones.map((z) => {
                    const heights = parseDrawerRows(zoneUi[z.id].drawerFrontHeights)
                    if (heights.length === 0) return null
                    const hasDoor = doorSpan === 'zones' && zoneUi[z.id].doorCount > 0
                    return `${z.label}: ${drawerHint(z.frontHeight, hasDoor ? zoneUi[z.id].doorCount : 0, heights)}`
                  }),
                ]
                  .filter(Boolean)
                  .join(' ') ||
                'Добави едно или повече чекмеджета — могат да са с различни височини, с или без врата отдолу.'
              : drawerHint(frontH, doorCount, (params as { drawerFrontHeights: number[] }).drawerFrontHeights)}
          </p>
        </div>

        {showCombineFronts && (
          <div>
            <Label>Рязане</Label>
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
              {combineHint(!hasFixed || doorSpan === 'full' ? doorCount : 0, cutFromOneBoard)}
            </p>
          </div>
        )}

        {counts.drawerCount > 0 && (
          <div>
            <Label>Водачи</Label>
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
          </div>
        )}
          </>
        )}

        {(typeId === 'nightstand' || typeId === 'section') && (
          <>
            {typeId === 'nightstand' && (
            <div>
              <Label>Опора</Label>
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
            </div>
            )}

            {typeId === 'nightstand' && useLegs ? (
              <div>
                <Label>Крачета</Label>
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
              </div>
            ) : (
              <>
                <div>
                  <Label>Брой цокли</Label>
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
                </div>

                <div>
                  <Label htmlFor="plinth-height">Височина на цокъл (мм)</Label>
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
                </div>
              </>
            )}
          </>
        )}

        <div>
          <Label>Цветове</Label>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            По подразбиране плоскостите са еднакви. Смени само ако трябва да се отличават.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {PART_COLOR_FIELDS.filter(({ key }) => {
              if (typeId === 'nightstand' || typeId === 'section') {
                if (key === 'shelf' && counts.shelfCount === 0 && counts.fixedShelves === 0) return false
                if (key === 'leg' && (typeId === 'section' || !useLegs)) return false
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
                {(typeId === 'nightstand' || typeId === 'section') && key === 'rail' ? 'Плот' : label}
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
        </div>

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
                    const prevRed = idx > 0 && result.panels[idx - 1].highlightColor === 'red'
                    const nextRed = idx < result.panels.length - 1 && result.panels[idx + 1].highlightColor === 'red'
                    const isGroupStart = isRed && !prevRed
                    const isGroupEnd = isRed && !nextRed
                    const groupEdge = (side: 'first' | 'mid' | 'last') =>
                      cn(
                        !isRed && 'border-b border-[var(--color-border)]/50',
                        isRed && '!border-red-500',
                        isRed && side === 'first' && 'border-l-2',
                        isRed && side === 'last' && 'border-r-2',
                        isGroupStart && 'border-t-2',
                        isGroupEnd && 'border-b-2',
                      )
                    return (
                    <tr
                      key={`${panel.role}-${idx}`}
                      className={cn(isRed && 'text-red-400')}
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
                        isRed ? 'text-red-400/70' : 'text-[var(--color-muted-foreground)]',
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
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
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


function WherePicker({
  zones,
  allowFull,
  onPick,
  onCancel,
}: {
  zones: { id: CabinetZoneId; label: string }[]
  allowFull: boolean
  onPick: (target: FrontTarget) => void
  onCancel: () => void
}) {
  return (
    <div className="mt-2 rounded-md border border-[var(--color-border)] p-2">
      <p className="text-xs font-medium">В коя част?</p>
      <div className="mt-1 flex flex-wrap gap-2">
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
    </div>
  )
}

function doorSizeHint(
  width: number,
  frontH: number,
  layout: InteriorLayout,
  drawerFrontHeights: string[],
  doorCount: 0 | 1 | 2,
  doorSpan: DoorSpan,
): string {
  const fullDrawers = drawerFrontHeights.map((s) => parseInt(s, 10) || 0).filter((n) => n > 0)
  const parts: string[] = []
  if (doorSpan === 'full' && (doorCount === 1 || doorCount === 2)) {
    const leftover = remainingFrontHeight(frontH, fullDrawers, true)
    if (leftover <= 4) parts.push('Няма място за врата на целия шкаф.')
    else {
      const d = doorCutSize(width, frontH, doorCount)
      parts.push(
        `Цял шкаф: рязане ${Math.round(d.width)} × ${Math.round(leftover - 4)} мм · ${doorCutRuleNote({ withDrawerGaps: fullDrawers.length > 0 })}`,
      )
    }
  }
  for (const z of layout.zones) {
    if (layout.shelves.length === 0) continue
    if (!(z.doorCount === 1 || z.doorCount === 2)) continue
    const leftover = remainingFrontHeight(z.frontHeight, z.drawerFrontHeights, true)
    if (leftover <= 4) {
      parts.push(`${z.label}: няма място за врата.`)
      continue
    }
    const d = doorCutSize(width, leftover + DOOR_CLEARANCE_TOP, z.doorCount)
    parts.push(
      `${z.label}: рязане ${Math.round(d.width)} × ${Math.round(leftover - 4)} мм (отвор ${Math.round(z.frontHeight)} мм, ${doorCutRuleNote()})`,
    )
  }
  return parts.join(' ')
}

function dialogFrontHeight(
  typeId: string,
  params: { height: number; useLegs?: boolean; legHeight?: number; plinthHeight?: number },
): number {
  if (typeId === 'kitchen-base') return params.height
  return params.height - (params.useLegs ? params.legHeight ?? 0 : params.plinthHeight ?? 0)
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
    useLegs?: boolean
    legHeight?: number
    plinthHeight?: number
  },
  layout: InteriorLayout,
  frontH: number,
): string | null {
  if (typeId !== 'kitchen-base' && typeId !== 'nightstand' && typeId !== 'section') return null
  if (p.width <= p.thickness * 2) return 'Ширината трябва да е по-голяма от двете страници.'
  if (p.height <= p.thickness + 20) return 'Височината на корпуса е твърде малка.'
  if (p.depth <= 0 || p.width <= 0) return 'Въведи валидни размери.'
  if (p.thickness < 8 || p.thickness > 36) return 'Дебелината на плоскостта трябва да е между 8 и 36 мм.'
  const minFront = DRAWER_RAIL_BELOW_FRONT + 20
  const allDrawers = allDrawerFrontHeights(layout)
  for (const h of allDrawers) {
    if (h < minFront) return `Челото на чекмеджето трябва да е поне ${minFront} мм.`
  }
  const zoneErr = validateZoneFronts(layout, frontH)
  if (zoneErr) return zoneErr
  if (layout.shelves.length === 0) {
    const leftover = remainingFrontHeight(frontH, p.drawerFrontHeights, p.doorCount > 0)
    if (leftover < 0) {
      return `Челата на чекмеджетата не събират във височината на корпуса (фуга ${DOOR_CLEARANCE_TOP} мм отгоре и ${DRAWER_DOOR_GAP} мм между тях).`
    }
    if (p.doorCount > 0 && leftover < 80) return 'Останалата височина за вратата е твърде малка.'
  }
  return null
}

function drawerHint(frontHeight: number, doorCount: number, drawerFrontHeights: number[]): string {
  if (drawerFrontHeights.length === 0) {
    return 'Добави едно или повече чекмеджета — могат да са с различни височини, с или без врата отдолу.'
  }
  const leftover = remainingFrontHeight(frontHeight, drawerFrontHeights, doorCount > 0)
  if (doorCount > 0) {
    return leftover > 0
      ? `Вратата отдолу е ${Math.round(leftover)} мм. ${doorCutRuleNote({ withDrawerGaps: true })}.`
      : 'Челата заемат целия корпус — няма място за врата.'
  }
  if (leftover > 4) {
    return leftover >= 80
      ? `Остават ${Math.round(leftover)} мм. „Разпредели поравно“ ги слага в челата (фуга ${DOOR_CLEARANCE_TOP} мм отгоре, ${DRAWER_DOOR_GAP} мм между тях) или добави врата отдолу.`
      : `Остават ${Math.round(leftover)} мм. Натисни „Разпредели поравно“, за да влязат в челата с фугите.`
  }
  if (leftover < 0) return 'Челата излизат над корпуса.'
  return `Челата запълват корпуса. Фуга ${DOOR_CLEARANCE_TOP} мм отгоре, ${DRAWER_DOOR_GAP} мм между тях.`
}

function combineHint(doorCount: number, fromOneBoard: boolean): string {
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
