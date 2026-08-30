import { useMemo, useState } from 'react'
import { Box } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  estimateFromPanels,
  formatArea,
  generateCabinet,
  parseKitchenBaseParams,
  scaleCabinetResult,
  type CabinetInstance,
} from '@/lib/cabinets'
import { cn, formatMeters } from '@/lib/utils'

interface CabinetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: CabinetInstance | null
  onSave: (input: { typeId: string; params: Record<string, unknown>; quantity: number }) => void
}

export function CabinetDialog({ open, onOpenChange, editing, onSave }: CabinetDialogProps) {
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
  const [quantity, setQuantity] = useState(String(editing?.quantity ?? 1))

  const params = useMemo(
    () =>
      parseKitchenBaseParams({
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        depth: parseInt(depth, 10),
        thickness: parseInt(thickness, 10),
        legHeight,
        railWidth: DEFAULT_KITCHEN_BASE_PARAMS.railWidth,
      }),
    [width, height, depth, thickness, legHeight],
  )

  const qty = Math.max(1, parseInt(quantity, 10) || 1)
  const result = useMemo(() => {
    try {
      return scaleCabinetResult(generateCabinet(typeId, { ...params }), qty)
    } catch {
      return null
    }
  }, [typeId, params, qty])

  const estimate = result ? estimateFromPanels(result.panels) : null
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

        <CabinetPreview params={{ ...params }} />

        {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}

        {result && estimate && (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted-foreground)]">
                    <th className="px-3 py-2">Детайл</th>
                    <th className="px-3 py-2">Размер</th>
                    <th className="px-3 py-2">Бр.</th>
                    <th className="px-3 py-2">Кант</th>
                  </tr>
                </thead>
                <tbody>
                  {result.panels.map((panel) => (
                    <tr key={panel.role} className="border-b border-[var(--color-border)]/50">
                      <td className="px-3 py-2 font-medium">{panel.name}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {panel.width} × {panel.height} мм
                      </td>
                      <td className="px-3 py-2">{panel.quantity}</td>
                      <td className="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
                        {panel.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3 rounded-md bg-[var(--color-secondary)] px-3 py-2 text-sm">
              <span>
                Материал: <strong>{formatArea(estimate.areaM2)}</strong>
              </span>
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
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Фурнитура (не се реже):{' '}
                {result.hardware.map((h) => `${h.name} × ${h.quantity}`).join(', ')}
              </p>
            )}

            <ul className="list-inside list-disc text-xs text-[var(--color-muted-foreground)]">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
              <li>Времето за рязане, кантиране и сглобяване ще се зададе по-нататък — тогава и цената за труд.</li>
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
  return null
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
