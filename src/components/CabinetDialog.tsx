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
  canCombineFronts,
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
} from '@/lib/cabinets'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import type { AssemblyTimeSettings } from '@/lib/assembly-time'
import { DEFAULT_ASSEMBLY_TIME_SETTINGS } from '@/lib/assembly-time'
import type { Sheet } from '@/types'
import { cn, formatMeters } from '@/lib/utils'

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
  const [colors, setColors] = useState<CabinetPartColors>({
    ...DEFAULT_PART_COLORS,
    ...(editing?.params.colors as CabinetPartColors | undefined),
  })

  const params = useMemo(() => {
    const fittings = {
      shelfCount,
      hasBack,
      hasClothesRail,
      doorCount,
      drawerFrontHeights: drawerFrontHeights.map((s) => parseInt(s, 10) || 0),
      cutFromOneBoard:
        cutFromOneBoard
        && canCombineFronts(
          drawerFrontHeights.filter((s) => (parseInt(s, 10) || 0) > 0).length,
          doorCount,
        ),
      includeHandles,
      slideKind,
      slideLength,
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
  }, [typeId, width, height, depth, thickness, legHeight, shelfCount, hasBack, hasClothesRail, doorCount, drawerFrontHeights, cutFromOneBoard, includeHandles, slideKind, slideLength, useLegs, plinthCount, plinthHeight, colors])

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
  const error = validate(typeId, params)
  const frontH = dialogFrontHeight(typeId, params)
  const slideDepth =
    typeId === 'kitchen-base'
      ? (params as ReturnType<typeof parseKitchenBaseParams>).depth
      : measureNightstand(params as ReturnType<typeof parseNightstandParams>, typeId === 'section').sideD
  const hasFittings = typeId === 'kitchen-base' || typeId === 'nightstand' || typeId === 'section'
  const innerH =
    typeId === 'kitchen-base'
      ? params.height - 2 * params.thickness
      : measureNightstand(params as ReturnType<typeof parseNightstandParams>, typeId === 'section').innerH
  const shelfGap = evenShelfGap(innerH, shelfCount, params.thickness)
  const backPlinth =
    typeId !== 'kitchen-base' && !(params as ReturnType<typeof parseNightstandParams>).useLegs
      ? (params as ReturnType<typeof parseNightstandParams>).plinthHeight
      : 0
  const backCut = hardboardCutSize(params.width, params.height, backPlinth)

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
                } else if (id === 'kitchen-base') {
                  setWidth(String(DEFAULT_KITCHEN_BASE_PARAMS.width))
                  setHeight(String(DEFAULT_KITCHEN_BASE_PARAMS.height))
                  setDepth(String(DEFAULT_KITCHEN_BASE_PARAMS.depth))
                  setThickness(String(DEFAULT_KITCHEN_BASE_PARAMS.thickness))
                  setHasBack(DEFAULT_KITCHEN_BASE_PARAMS.hasBack)
                  setHasClothesRail(false)
                  setIncludeHandles(true)
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
            <Label htmlFor="cab-qty">Брой шкафа</Label>
            <Input
              id="cab-qty"
              type="number"
              inputMode="numeric"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumField id="cab-w" label="Ширина" value={width} onChange={setWidth} />
          <NumField id="cab-h" label={typeId === 'kitchen-base' ? 'Височина корпус' : 'Височина'} value={height} onChange={setHeight} />
          <NumField id="cab-d" label="Дълбочина" value={depth} onChange={setDepth} />
          <NumField id="cab-t" label="Плоскост" value={thickness} onChange={setThickness} />
        </div>

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
              <Label>Рафтове</Label>
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                Равни празнини над, между и под рафтовете.
              </p>
              {shelfCount > 0 && (
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={shelfCount >= MAX_SHELVES}
                  onClick={() => setShelfCount((n) => Math.min(MAX_SHELVES, n + 1))}
                >
                  <Plus className="h-4 w-4" />
                  Добави рафт
                </Button>
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {shelfCount === 0
                  ? 'Без рафт'
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
              variant={hasClothesRail ? 'default' : 'outline'}
              onClick={() => setHasClothesRail(true)}
            >
              С лост
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!hasClothesRail ? 'default' : 'outline'}
              onClick={() => setHasClothesRail(false)}
            >
              Без
            </Button>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {hasClothesRail
              ? `Лост ${clothesRailLengthMm(params.width, params.thickness)} мм между страниците · ${formatEur(settings.hardware.clothesRailEurPerM)}/м.`
              : 'Без лост.'}
          </p>
        </div>

        <div>
          <Label>Врати</Label>
          <div className="mt-1 flex gap-2">
            {([0, 1, 2] as const).map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={doorCount === n ? 'default' : 'outline'}
                onClick={() => setDoorCount(n)}
              >
                {n === 0 ? 'Без' : n === 1 ? '1 врата' : '2 врати'}
              </Button>
            ))}
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {doorCount === 0
              ? 'Без врати — шкафът може да е само с чекмеджета.'
              : (() => {
                  const leftover = remainingFrontHeight(frontH, drawerFrontHeights.map((s) => parseInt(s, 10) || 0).filter((n) => n > 0), true)
                  const d = {
                    width: params.width / doorCount - 3 - 4,
                    height: leftover - 4,
                  }
                  return leftover > 4
                    ? `Рязане ${Math.round(d.width)} × ${Math.round(d.height)} мм · кант 2 мм от 4 страни`
                    : 'Няма място за врата — намалени челата или махни вратата.'
                })()}
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
              const n =
                doorCount +
                drawerFrontHeights.filter((s) => (parseInt(s, 10) || 0) > 0).length
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
            Отгоре надолу, всяко със своя височина. Може без врата.
          </p>
          <div className="mt-2 space-y-2">
            {drawerFrontHeights.map((value, i) => (
              <div key={i} className="flex items-center gap-2">
                <Label htmlFor={`drawer-h-${i}`} className="w-28 shrink-0 text-xs">
                  Чело {i + 1} (мм)
                </Label>
                <Input
                  id={`drawer-h-${i}`}
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
                  onClick={() => setDrawerFrontHeights((rows) => rows.filter((_, j) => j !== i))}
                  aria-label={`Премахни чекмедже ${i + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={drawerFrontHeights.length >= MAX_DRAWERS}
              onClick={() => {
                setDrawerFrontHeights((rows) => [...rows, String(DEFAULT_DRAWER_FRONT_HEIGHT)])
              }}
            >
              <Plus className="h-4 w-4" />
              Добави чекмедже
            </Button>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {drawerHint(frontH, doorCount, (params as { drawerFrontHeights: number[] }).drawerFrontHeights)}
          </p>
        </div>

        {canCombineFronts((params as { drawerFrontHeights: number[] }).drawerFrontHeights.length, doorCount) && (
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
              {combineHint(doorCount, cutFromOneBoard)}
            </p>
          </div>
        )}

        {(params as { drawerFrontHeights: number[] }).drawerFrontHeights.length > 0 && (
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
                    {SLIDES_PER_DRAWER * fit.drawerFrontHeights.length} бр. ×{' '}
                    {formatEur(slideUnitPriceEur(fit.slideKind, fit.slideLength, settings.hardware))} ={' '}
                    <strong>
                      {formatEur(
                        slideUnitPriceEur(fit.slideKind, fit.slideLength, settings.hardware)
                          * SLIDES_PER_DRAWER
                          * fit.drawerFrontHeights.length,
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
              return [...new Set(fit.drawerFrontHeights)].map((drawerH) => {
              const box = drawerBoxRails(
                fit.width,
                fit.thickness,
                drawerH,
                fit.slideLength,
                isSoftCloseSlide(fit.slideKind),
              )
              if (!box) return null
              const many = fit.drawerFrontHeights.length > 1
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
                if (key === 'shelf' && shelfCount === 0) return false
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

        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={showDimLines}
              onCheckedChange={(c) => setShowDimLines(c === true)}
            />
            Оразмерителни линии
          </label>
        </div>

        <CabinetPreview typeId={typeId} params={{ ...params }} showDimLines={showDimLines} />

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
): string | null {
  if (typeId !== 'kitchen-base' && typeId !== 'nightstand' && typeId !== 'section') return null
  if (p.width <= p.thickness * 2) return 'Ширината трябва да е по-голяма от двете страници.'
  if (p.height <= p.thickness + 20) return 'Височината на корпуса е твърде малка.'
  if (p.depth <= 0 || p.width <= 0) return 'Въведи валидни размери.'
  if (p.thickness < 8 || p.thickness > 36) return 'Дебелината на плоскостта трябва да е между 8 и 36 мм.'
  const minFront = DRAWER_RAIL_BELOW_FRONT + 20
  for (const h of p.drawerFrontHeights) {
    if (h < minFront) return `Челото на чекмеджето трябва да е поне ${minFront} мм.`
  }
  const leftover = remainingFrontHeight(dialogFrontHeight(typeId, p), p.drawerFrontHeights, p.doorCount > 0)
  if (leftover < 0) return 'Челата на чекмеджетата не събират във височината на корпуса (фуга 5 мм отгоре и 3 мм между тях).'
  if (p.doorCount > 0 && leftover < 80) return 'Останалата височина за вратата е твърде малка.'
  return null
}

function drawerHint(frontHeight: number, doorCount: number, drawerFrontHeights: number[]): string {
  if (drawerFrontHeights.length === 0) {
    return 'Добави едно или повече чекмеджета — могат да са с различни височини, с или без врата отдолу.'
  }
  const leftover = remainingFrontHeight(frontHeight, drawerFrontHeights, doorCount > 0)
  if (doorCount > 0) {
    return leftover > 0
      ? `Вратата отдолу е ${Math.round(leftover)} мм. Фуга 5 мм отгоре, 3 мм между челата.`
      : 'Челата заемат целия корпус — няма място за врата.'
  }
  if (leftover > 4) return `Остават ${Math.round(leftover)} мм. Коригирай височините или добави още чекмедже.`
  if (leftover < 0) return 'Челата излизат над корпуса.'
  return 'Челата запълват корпуса. Фуга 5 мм отгоре, 3 мм между тях.'
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
