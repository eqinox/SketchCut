import { useState } from 'react'
import { Box, Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { CabinetDialog } from '@/components/CabinetDialog'
import { PriceBreakdownView } from '@/components/PriceBreakdown'
import {
  WORK_HOURS_PER_DAY,
  cabinetPrice,
  explainCabinetsPrice,
  formatEur,
  generateCabinet,
  getCabinetType,
  hourlyRateEur,
  parseKitchenBaseParams,
  scaleCabinetResult,
  type CabinetInstance,
} from '@/lib/cabinets'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import type { AssemblyTimeSettings } from '@/lib/assembly-time'
import { DEFAULT_ASSEMBLY_TIME_SETTINGS } from '@/lib/assembly-time'
import type { Sheet } from '@/types'

interface CabinetsPanelProps {
  cabinets: CabinetInstance[]
  sheets: Sheet[]
  dailyRateEur: number
  settings?: { hardware: HardwareSettings; assemblyTime: AssemblyTimeSettings }
  onDailyRateChange: (value: number) => void
  onHardwareSettingsChange?: (settings: HardwareSettings) => void
  applyAdd: (input: { typeId: string; params: Record<string, unknown>; quantity: number }) => void
  applyUpdate: (
    cabinetId: string,
    input: { typeId: string; params: Record<string, unknown>; quantity: number },
  ) => void
  applyRemove: (cabinetId: string) => void
}

export function CabinetsPanel({
  cabinets,
  sheets,
  dailyRateEur,
  settings = { hardware: DEFAULT_HARDWARE_SETTINGS, assemblyTime: DEFAULT_ASSEMBLY_TIME_SETTINGS },
  onDailyRateChange,
  onHardwareSettingsChange,
  applyAdd,
  applyUpdate,
  applyRemove,
}: CabinetsPanelProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CabinetInstance | null>(null)
  const [formKey, setFormKey] = useState(0)
  const hourly = hourlyRateEur(dailyRateEur)
  const priced = cabinets.flatMap((c) => {
    try {
      const result = scaleCabinetResult(generateCabinet(c.typeId, c.params, settings), c.quantity)
      return [
        {
          cabinet: c,
          result,
          price: cabinetPrice(
            result.hardware,
            result.labor,
            dailyRateEur,
            result.panels,
            sheets,
            { ...settings.hardware, billWholeSheets: false },
          ),
        },
      ]
    } catch {
      return []
    }
  })
  const breakdown =
    priced.length > 0
      ? explainCabinetsPrice(
          priced.map((row) => {
            const type = getCabinetType(row.cabinet.typeId)
            const qty = row.cabinet.quantity > 1 ? ` ×${row.cabinet.quantity}` : ''
            const index = cabinets.findIndex((c) => c.id === row.cabinet.id) + 1
            return {
              label: `Ш${index} · ${type?.name ?? row.cabinet.name}${qty}`,
              panels: row.result.panels,
              hardware: row.result.hardware,
              assemblyMinutes: row.result.labor.assemblyMinutes,
              assemblySteps: row.result.labor.assemblySteps,
            }
          }),
          dailyRateEur,
          sheets,
          settings.hardware,
        )
      : null

  const openAdd = () => {
    setEditing(null)
    setFormKey((k) => k + 1)
    setOpen(true)
  }

  const openEdit = (cabinet: CabinetInstance) => {
    setEditing(cabinet)
    setFormKey((k) => k + 1)
    setOpen(true)
  }

  const copyCabinet = (cabinet: CabinetInstance) => {
    applyAdd({
      typeId: cabinet.typeId,
      params: structuredClone(cabinet.params),
      quantity: 1,
    })
  }

  const setCabinetQuantity = (cabinet: CabinetInstance, raw: string) => {
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 1) return
    applyUpdate(cabinet.id, {
      typeId: cabinet.typeId,
      params: cabinet.params,
      quantity: n,
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Шкафове</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Генерират детайли и кант за разкроя · лесно се добавят нови типове
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="daily-rate" className="text-xs">
              Ставка за тази кухня
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="daily-rate"
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                className="h-8 w-24"
                value={dailyRateEur || ''}
                placeholder="€"
                onChange={(e) => {
                  const n = parseFloat(e.target.value)
                  onDailyRateChange(Number.isFinite(n) && n >= 0 ? n : 0)
                }}
              />
              <span className="text-xs text-[var(--color-muted-foreground)]">€/ден</span>
            </div>
          </div>
          <p className="pb-1 text-xs text-[var(--color-muted-foreground)]">
            {WORK_HOURS_PER_DAY} ч работа
            {hourly > 0 ? ` · ${formatEur(hourly)}/ч` : ''}
          </p>
          <label className="flex max-w-[16rem] cursor-pointer items-start gap-2 pb-1 text-xs leading-snug">
            <Checkbox
              className="mt-0.5"
              checked={settings.hardware.billWholeSheets}
              onCheckedChange={(c) =>
                onHardwareSettingsChange?.({ ...settings.hardware, billWholeSheets: c === true })
              }
            />
            <span>
              Цели закупени плочи
              <span className="mt-0.5 block text-[var(--color-muted-foreground)]">
                3,5 изразходвани → цена за 4 плочи
              </span>
            </span>
          </label>
        </div>
      </div>

      <Button onClick={openAdd} variant="secondary" className="w-full sm:w-auto">
        <Plus className="h-4 w-4" />
        Добави шкаф
      </Button>

      {cabinets.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Няма добавени шкафове — започни с долен кухненски на крачета.
        </p>
      ) : (
        <div className="space-y-2">
          <ul className="space-y-2">
            {cabinets.map((c, i) => {
              const type = getCabinetType(c.typeId)
              const p = parseKitchenBaseParams(c.params)
              const row = priced.find((r) => r.cabinet.id === c.id)
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Box className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                      <span className="truncate text-sm font-medium">
                        Ш{i + 1} · {type?.name ?? c.name}
                      </span>
                      {c.quantity > 1 && (
                        <span className="text-xs text-[var(--color-muted-foreground)]">× {c.quantity}</span>
                      )}
                      {row && (
                        <span className="ml-auto shrink-0 text-xs tabular-nums text-[var(--color-muted-foreground)]">
                          {formatEur(row.price.totalEur)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                      {p.width} × {p.height} × {p.depth} мм · крачета {p.legHeight} мм
                      {p.shelfCount > 0
                        ? ` · ${p.shelfCount} ${p.shelfCount === 1 ? 'рафт' : 'рафта'}`
                        : ''}
                      {p.hasBack ? ' · фазер' : ''}
                      {p.hasClothesRail ? ' · лост' : ''}
                      {p.doorCount === 1 ? ' · 1 врата' : p.doorCount === 2 ? ' · 2 врати' : ''}
                      {p.drawerFrontHeights.length === 1
                        ? ` · 1 чекмедже ${p.drawerFrontHeights[0]} мм · водачи ${p.slideLength}`
                        : p.drawerFrontHeights.length > 1
                          ? ` · ${p.drawerFrontHeights.length} чекмеджета ${p.drawerFrontHeights.join('/')} мм · водачи ${p.slideLength}`
                          : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      title="Брой еднакви шкафа"
                      aria-label={`Брой еднакви за Ш${i + 1}`}
                      className="h-7 w-12 px-1 text-center"
                      value={c.quantity}
                      onChange={(e) => setCabinetQuantity(c, e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Копирай шкафа"
                      aria-label={`Копирай Ш${i + 1}`}
                      onClick={() => copyCabinet(c)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Редактирай" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Изтрий"
                      onClick={() => applyRemove(c.id)}
                    >
                      <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
          {breakdown && <PriceBreakdownView breakdown={breakdown} />}
        </div>
      )}

      <CabinetDialog
        key={formKey}
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        sheets={sheets}
        dailyRateEur={dailyRateEur}
        settings={settings}
        onSave={(input) => {
          if (editing) applyUpdate(editing.id, input)
          else applyAdd(input)
          setEditing(null)
        }}
      />
    </div>
  )
}
