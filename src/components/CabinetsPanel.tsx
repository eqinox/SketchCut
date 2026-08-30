import { useState } from 'react'
import { Box, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CabinetDialog } from '@/components/CabinetDialog'
import {
  WORK_HOURS_PER_DAY,
  formatEur,
  getCabinetType,
  hourlyRateEur,
  parseKitchenBaseParams,
  type CabinetInstance,
} from '@/lib/cabinets'

interface CabinetsPanelProps {
  cabinets: CabinetInstance[]
  dailyRateEur: number
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
  dailyRateEur,
  onDailyRateChange,
  applyAdd,
  applyUpdate,
  applyRemove,
}: CabinetsPanelProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CabinetInstance | null>(null)
  const [formKey, setFormKey] = useState(0)
  const hourly = hourlyRateEur(dailyRateEur)

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
        <ul className="space-y-2">
          {cabinets.map((c, i) => {
            const type = getCabinetType(c.typeId)
            const p = parseKitchenBaseParams(c.params)
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
                  </div>
                  <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                    {p.width} × {p.height} × {p.depth} мм · крачета {p.legHeight} мм · от пода{' '}
                    {p.height + p.legHeight} мм
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
      )}

      <CabinetDialog
        key={formKey}
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSave={(input) => {
          if (editing) applyUpdate(editing.id, input)
          else applyAdd(input)
          setEditing(null)
        }}
      />
    </div>
  )
}
