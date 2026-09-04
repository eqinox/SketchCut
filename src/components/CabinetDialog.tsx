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
import {
  CABINET_TYPES,
  DEFAULT_KITCHEN_BASE_PARAMS,
  DEFAULT_PART_COLORS,
  DEFAULT_SHELF_FRONT_INSET,
  PART_COLOR_FIELDS,
  SCREW_5X60,
  SHELF_PIN,
  SHELF_PINS_PER_SHELF,
  SLIDE_KIND_LABEL,
  SLIDES_PER_DRAWER,
  WORK_HOURS_PER_DAY,
  cabinetPrice,
  eligibleSlideLengths,
  estimateFromPanels,
  fastenerUnitPriceEur,
  formatArea,
  formatEur,
  formatMinutes,
  generateCabinet,
  hardwareQtyById,
  hourlyRateEur,
  isSoftCloseSlide,
  parseKitchenBaseParams,
  parseSlideKind,
  scaleCabinetResult,
  slideUnitPriceEur,
  drawerBoxRails,
  remainingFrontHeight,
  canCombineFronts,
  DEFAULT_DRAWER_FRONT_HEIGHT,
  DRAWER_RAIL_BELOW_FRONT,
  MAX_DRAWERS,
  type CabinetInstance,
  type CabinetPartColors,
  type SlideKind,
} from '@/lib/cabinets'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import type { Sheet } from '@/types'
import { cn, formatMeters } from '@/lib/utils'

interface CabinetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: CabinetInstance | null
  sheets: Sheet[]
  dailyRateEur: number
  settings?: HardwareSettings
  onSave: (input: { typeId: string; params: Record<string, unknown>; quantity: number }) => void
}

export function CabinetDialog({ open, onOpenChange, editing, sheets, dailyRateEur, settings = DEFAULT_HARDWARE_SETTINGS, onSave }: CabinetDialogProps) {
  const isEdit = !!editing
  const initial = editing
    ? parseKitchenBaseParams(editing.params)
    : DEFAULT_KITCHEN_BASE_PARAMS

  const [typeId, setTypeId] = useState(editing?.typeId ?? 'kitchen-base')
  const [width, setWidth] = useState(String(initial.width))
  const [height, setHeight] = useState(String(initial.height))
  const [depth, setDepth] = useState(String(initial.depth))
  const [thickness, setThickness] = useState(String(initial.thickness))
  const [legHeight, setLegHeight] = useState(initial.legHeight === 150 ? 150 : 100)
  const [shelfCount, setShelfCount] = useState(initial.shelfCount)
  const [hasBack, setHasBack] = useState(initial.hasBack)
  const [doorCount, setDoorCount] = useState(initial.doorCount)
  const [drawerFrontHeights, setDrawerFrontHeights] = useState<string[]>(
    initial.drawerFrontHeights.map(String),
  )
  const [cutFromOneBoard, setCutFromOneBoard] = useState(initial.cutFromOneBoard)
  const [slideKind, setSlideKind] = useState<SlideKind>(parseSlideKind(initial.slideKind))
  const [slideLength, setSlideLength] = useState(initial.slideLength)
  const [quantity, setQuantity] = useState(String(editing?.quantity ?? 1))
  const [showDimLines, setShowDimLines] = useState(false)
  const [colors, setColors] = useState<CabinetPartColors>({
    ...DEFAULT_PART_COLORS,
    ...initial.colors,
  })

  const params = useMemo(
    () =>
      parseKitchenBaseParams({
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        depth: parseInt(depth, 10),
        thickness: parseInt(thickness, 10),
        legHeight,
        railWidth: DEFAULT_KITCHEN_BASE_PARAMS.railWidth,
        shelfCount,
        hasBack,
        doorCount,
        drawerFrontHeights: drawerFrontHeights.map((s) => parseInt(s, 10) || 0),
        cutFromOneBoard:
          cutFromOneBoard
          && canCombineFronts(
            drawerFrontHeights.filter((s) => (parseInt(s, 10) || 0) > 0).length,
            doorCount,
          ),
        slideKind,
        slideLength,
        colors,
      }),
    [width, height, depth, thickness, legHeight, shelfCount, hasBack, doorCount, drawerFrontHeights, cutFromOneBoard, slideKind, slideLength, colors],
  )

  const qty = Math.max(1, parseInt(quantity, 10) || 1)
  const result = useMemo(() => {
    try {
      return scaleCabinetResult(generateCabinet(typeId, { ...params }, settings), qty)
    } catch {
      return null
    }
  }, [typeId, params, qty, settings])

  const estimate = result ? estimateFromPanels(result.panels) : null
  const price = result ? cabinetPrice(result.hardware, result.labor, dailyRateEur, result.panels, sheets, settings) : null
  const screwUnit = fastenerUnitPriceEur({ ...SCREW_5X60, packPriceEur: settings.screw5x60_500PackEur })
  const pinQty = result ? hardwareQtyById(result.hardware, SHELF_PIN.id) : 0
  const hourly = hourlyRateEur(dailyRateEur)
  const error = validate(params)

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
            Размерите са на корпуса в мм. Крачетата са отделно. Детайлите и кантът се смятат автоматично.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cab-type">Тип</Label>
            <select
              id="cab-type"
              className={selectClass}
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
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
          <NumField id="cab-h" label="Височина корпус" value={height} onChange={setHeight} />
          <NumField id="cab-d" label="Дълбочина" value={depth} onChange={setDepth} />
          <NumField id="cab-t" label="Плоскост" value={thickness} onChange={setThickness} />
        </div>

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
            От пода до върха: {params.height + params.legHeight} мм · 4 крачета
          </p>
        </div>

        <div>
          <Label>Рафтове</Label>
          <div className="mt-1 flex gap-2">
            {([0, 1, 2, 3] as const).map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={shelfCount === n ? 'default' : 'outline'}
                onClick={() => setShelfCount(n)}
              >
                {n === 0 ? 'Без' : n}
              </Button>
            ))}
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {shelfCount === 0
              ? 'Без рафт'
              : `${shelfCount} ${shelfCount === 1 ? 'рафт' : 'рафта'} · равни празнини · ${shelfCount * SHELF_PINS_PER_SHELF} рафтоносача · ${formatEur(settings.shelfPinEur)}/бр. · дълбочина ${params.depth - DEFAULT_SHELF_FRONT_INSET} мм`}
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
              ? '3 мм фазер между страниците, отделен разкрой от ПДЧ.'
              : 'Без гръб.'}
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
                  const leftover = remainingFrontHeight(params.height, params.drawerFrontHeights, true)
                  const d = {
                    width: params.width / doorCount - 3 - 4,
                    height: leftover - 4,
                  }
                  return leftover > 4
                    ? `Рязане ${Math.round(d.width)} × ${Math.round(d.height)} мм · кант 2 мм от 4 страни`
                    : 'Няма място за врата — намалени челата или махни вратата.'
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
            {drawerHint(params)}
          </p>
        </div>

        {canCombineFronts(params.drawerFrontHeights.length, doorCount) && (
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

        {params.drawerFrontHeights.length > 0 && (
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
                    const next = eligibleSlideLengths(params.depth, kind)
                    if (!next.includes(slideLength)) setSlideLength(next[next.length - 1] ?? next[0])
                  }}
                >
                  {kind === 'roller' ? 'Ролкови' : kind === 'soft-full' ? 'Плавно пълно' : 'Плавно частично'}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Дължина</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {eligibleSlideLengths(params.depth, slideKind).map((len) => (
                <Button
                  key={len}
                  type="button"
                  size="sm"
                  variant={params.slideLength === len ? 'default' : 'outline'}
                  onClick={() => setSlideLength(len)}
                >
                  {len}
                </Button>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {SLIDE_KIND_LABEL[params.slideKind]} · {params.slideLength} мм ·{' '}
              {SLIDES_PER_DRAWER * params.drawerFrontHeights.length} бр. ×{' '}
              {formatEur(slideUnitPriceEur(params.slideKind, params.slideLength, settings))} ={' '}
              <strong>
                {formatEur(
                  slideUnitPriceEur(params.slideKind, params.slideLength, settings)
                    * SLIDES_PER_DRAWER
                    * params.drawerFrontHeights.length,
                )}
              </strong>
              {eligibleSlideLengths(params.depth, slideKind).length === 0
                ? ' · няма водач, който да влезе в тази дълбочина'
                : ` · влиза в корпус ${params.depth} мм`}
              {params.slideKind === 'roller'
                ? ' · 3 винтчета 3.5×16 на водач'
                : ' · 3 винтчета 3.5×16 + 4 за перките на водач'}
            </p>
            {[...new Set(params.drawerFrontHeights)].map((frontH) => {
              const box = drawerBoxRails(
                params.width,
                params.thickness,
                frontH,
                params.slideLength,
                isSoftCloseSlide(params.slideKind),
              )
              if (!box) return null
              const many = params.drawerFrontHeights.length > 1
              return (
                <p key={frontH} className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Царги{many ? ` ${frontH} мм` : ''}: вътрешни {Math.round(box.inner.width)}×{Math.round(box.inner.height)} мм (2 бр.) · външни{' '}
                  {Math.round(box.outer.width)}×{Math.round(box.outer.height)} мм (2 бр.) · кутия {Math.round(box.drawerOuterW)} мм
                  {isSoftCloseSlide(params.slideKind) ? ' · 5 мм луфт от страна' : ' · 12.5 мм луфт от страна'}
                </p>
              )
            })}
          </div>
        )}

        <div>
          <Label>Цветове</Label>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            По подразбиране плоскостите са еднакви. Смени само ако трябва да се отличават.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {PART_COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 text-xs">
                <input
                  type="color"
                  value={colors[key]}
                  onChange={(e) => setColors((c) => ({ ...c, [key]: e.target.value }))}
                  className="h-7 w-8 cursor-pointer rounded border border-[var(--color-border)] bg-transparent"
                  title={label}
                />
                {label}
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

        <CabinetPreview params={{ ...params }} showDimLines={showDimLines} />

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

            {price && (
              <div className="flex flex-wrap items-baseline gap-3 rounded-md bg-[var(--color-secondary)] px-3 py-2 text-sm">
                <span>
                  Винтове {SCREW_5X60.name}: кутия {SCREW_5X60.packQty} бр. = {formatEur(settings.screw5x60_500PackEur)}{' '}
                  · {formatEur(screwUnit, 3)}/бр.
                </span>
                {pinQty > 0 && (
                  <span>
                    {SHELF_PIN.name}: {pinQty} бр. · {formatEur(settings.shelfPinEur)}/бр.
                  </span>
                )}
                <span>
                  ПДЧ: <strong>{formatEur(price.chipboardEur)}</strong>
                </span>
                {price.hardboardEur > 0 && (
                  <span>
                    Фазер: <strong>{formatEur(price.hardboardEur)}</strong>
                  </span>
                )}
                <span>
                  Кант ({formatEur(settings.edgeMm2Eur, 2)}/м дебел, {formatEur(settings.edgeMm05Eur, 2)}/м
                  обикновен): <strong>{formatEur(price.edgeEur)}</strong>
                </span>
                <span>
                  Фурнитура: <strong>{formatEur(price.hardwareEur)}</strong>
                </span>
                <span>
                  Рязане: <strong>{formatMinutes(price.cuttingMinutes)}</strong>
                  {' · '}
                  Кантиране: <strong>{formatMinutes(price.edgingMinutes)}</strong>
                </span>
                {price.laborEur != null ? (
                  <span>
                    Труд: <strong>{formatEur(price.laborEur)}</strong>
                    {' — '}
                    при {formatEur(dailyRateEur)}/ден ({WORK_HOURS_PER_DAY} ч · {formatEur(hourly)}/ч)
                  </span>
                ) : (
                  <span>Труд: задай ставка €/ден в панела Шкафове, за да влезе в цената</span>
                )}
                <span>
                  Обща цена: <strong>{formatEur(price.totalEur)}</strong>
                </span>
              </div>
            )}

            <ul className="list-inside list-disc text-xs text-[var(--color-muted-foreground)]">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
              <li>Сглобяването още няма зададено време — ще влезе в цената, когато го попълним.</li>
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

function validate(p: ReturnType<typeof parseKitchenBaseParams>): string | null {
  if (p.width <= p.thickness * 2) return 'Ширината трябва да е по-голяма от двете страници.'
  if (p.height <= p.thickness + 20) return 'Височината на корпуса е твърде малка.'
  if (p.depth <= 0 || p.width <= 0) return 'Въведи валидни размери.'
  if (p.thickness < 8 || p.thickness > 36) return 'Дебелината на плоскостта трябва да е между 8 и 36 мм.'
  const minFront = DRAWER_RAIL_BELOW_FRONT + 20
  for (const h of p.drawerFrontHeights) {
    if (h < minFront) return `Челото на чекмеджето трябва да е поне ${minFront} мм.`
  }
  const leftover = remainingFrontHeight(p.height, p.drawerFrontHeights, p.doorCount > 0)
  if (leftover < 0) return 'Челата на чекмеджетата не събират във височината на корпуса (фуга 5 мм отгоре и 3 мм между тях).'
  if (p.doorCount > 0 && leftover < 80) return 'Останалата височина за вратата е твърде малка.'
  return null
}

function drawerHint(p: ReturnType<typeof parseKitchenBaseParams>): string {
  if (p.drawerFrontHeights.length === 0) {
    return 'Добави едно или повече чекмеджета — могат да са с различни височини, с или без врата отдолу.'
  }
  const leftover = remainingFrontHeight(p.height, p.drawerFrontHeights, p.doorCount > 0)
  if (p.doorCount > 0) {
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
