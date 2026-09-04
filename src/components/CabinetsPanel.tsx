import { useState } from 'react'
import { Box, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CabinetDialog } from '@/components/CabinetDialog'
import {
  WORK_HOURS_PER_DAY,
  SCREW_5X60,
  SCREW_4X16,
  SCREW_4X20,
  SCREW_35X16,
  SHELF_PIN,
  cabinetPrice,
  formatEur,
  formatMinutes,
  generateCabinet,
  getCabinetType,
  hardwareCostById,
  hardwareQtyById,
  hourlyRateEur,
  parseKitchenBaseParams,
  scaleCabinetResult,
  type CabinetInstance,
} from '@/lib/cabinets'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import type { Sheet } from '@/types'

interface CabinetsPanelProps {
  cabinets: CabinetInstance[]
  sheets: Sheet[]
  dailyRateEur: number
  settings?: HardwareSettings
  onDailyRateChange: (value: number) => void
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
  settings = DEFAULT_HARDWARE_SETTINGS,
  onDailyRateChange,
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
          price: cabinetPrice(result.hardware, result.labor, dailyRateEur, result.panels, sheets, settings),
        },
      ]
    } catch {
      return []
    }
  })
  const hardwareTotal = priced.reduce((s, row) => s + row.price.hardwareEur, 0)
  const chipboardTotal = priced.reduce((s, row) => s + row.price.chipboardEur, 0)
  const hardboardTotal = priced.reduce((s, row) => s + row.price.hardboardEur, 0)
  const edgeTotal = priced.reduce((s, row) => s + row.price.edgeEur, 0)
  const laborParts = priced.map((row) => row.price.laborEur)
  const laborKnown = laborParts.length > 0 && laborParts.every((v) => v != null)
  const laborTotal = laborKnown ? laborParts.reduce((s, v) => s + (v ?? 0), 0) : null
  const cuttingMinutes = priced.reduce((s, row) => s + row.price.cuttingMinutes, 0)
  const edgingMinutes = priced.reduce((s, row) => s + row.price.edgingMinutes, 0)
  const grandTotal = priced.reduce((s, row) => s + row.price.totalEur, 0)
  const screwQty = priced.reduce((s, row) => s + hardwareQtyById(row.result.hardware, SCREW_5X60.id), 0)
  const screwCost = priced.reduce((s, row) => s + hardwareCostById(row.result.hardware, SCREW_5X60.id), 0)
  const pinQty = priced.reduce((s, row) => s + hardwareQtyById(row.result.hardware, SHELF_PIN.id), 0)
  const pinCost = priced.reduce((s, row) => s + hardwareCostById(row.result.hardware, SHELF_PIN.id), 0)
  const qtyOf = (id: string) => priced.reduce((s, row) => s + hardwareQtyById(row.result.hardware, id), 0)
  const costOf = (id: string) => priced.reduce((s, row) => s + hardwareCostById(row.result.hardware, id), 0)

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
                      {p.doorCount === 1 ? ' · 1 врата' : p.doorCount === 2 ? ' · 2 врати' : ''}
                      {p.drawerFrontHeights.length === 1
                        ? ` · 1 чекмедже ${p.drawerFrontHeights[0]} мм · водачи ${p.slideLength}`
                        : p.drawerFrontHeights.length > 1
                          ? ` · ${p.drawerFrontHeights.length} чекмеджета ${p.drawerFrontHeights.join('/')} мм · водачи ${p.slideLength}`
                          : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => applyRemove(c.id)}
                    >
                      <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="rounded-md bg-[var(--color-secondary)] px-3 py-2 text-sm">
            <p>
              Винтове {SCREW_5X60.name}: <strong>{screwQty} бр.</strong>
              {' · '}
              кутия {SCREW_5X60.packQty} бр. = {formatEur(settings.screw5x60_500PackEur)}
              {' · '}
              {formatEur(screwCost)}
            </p>
            {qtyOf(SCREW_4X16.id) > 0 && (
              <p>
                {SCREW_4X16.name}: <strong>{qtyOf(SCREW_4X16.id)} бр.</strong>
                {' · '}
                {formatEur(costOf(SCREW_4X16.id))}
                {' · '}
                {SCREW_4X20.name}: <strong>{qtyOf(SCREW_4X20.id)} бр.</strong>
                {' · '}
                {formatEur(costOf(SCREW_4X20.id))}
              </p>
            )}
            {qtyOf(SCREW_35X16.id) > 0 && (
              <p>
                {SCREW_35X16.name}: <strong>{qtyOf(SCREW_35X16.id)} бр.</strong>
                {' · '}
                {formatEur(costOf(SCREW_35X16.id))}
              </p>
            )}
            {pinQty > 0 && (
              <p>
                {SHELF_PIN.name}: <strong>{pinQty} бр.</strong>
                {' · '}
                {formatEur(settings.shelfPinEur, 2)}/бр.
                {' · '}
                {formatEur(pinCost)}
              </p>
            )}
            <p>
              ПДЧ: {formatEur(chipboardTotal)}
              {hardboardTotal > 0 ? ` · Фазер: ${formatEur(hardboardTotal)}` : ''}
              {' · '}
              Кант: {formatEur(edgeTotal)}
              {' · '}
              Фурнитура: {formatEur(hardwareTotal)}
            </p>
            <p>
              Рязане: {formatMinutes(cuttingMinutes)} (40 мин / плоча)
              {' · '}
              Кантиране: {formatMinutes(edgingMinutes)} (30 мин / плоча ПДЧ)
            </p>
            <p>
              {laborTotal == null
                ? 'Труд: задай ставка €/ден по-горе, за да влезе в сметката'
                : `Труд: ${formatEur(laborTotal)} — пресметнат при ${formatEur(dailyRateEur)}/ден (${WORK_HOURS_PER_DAY} ч · ${formatEur(hourly)}/ч)`}
            </p>
            <p>
              Обща цена: <strong>{formatEur(grandTotal)}</strong>
            </p>
          </div>
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
