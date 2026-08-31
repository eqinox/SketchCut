import { useState } from 'react'
import { Settings } from 'lucide-react'
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
import type { HardwareSettings } from '@/lib/settings'
import { formatEur } from '@/lib/cabinets'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: HardwareSettings
  onSave: (settings: HardwareSettings) => void
  onReset: () => HardwareSettings
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
  onReset,
}: SettingsDialogProps) {
  const [hingeSoftClose, setHingeSoftClose] = useState(String(settings.hingeSoftCloseEur))
  const [hingeNormal, setHingeNormal] = useState(String(settings.hingeNormalEur))
  const [useNormal, setUseNormal] = useState(settings.useNormalHinge)
  const [hingeScrew, setHingeScrew] = useState(String(settings.hingeScrew1000PackEur))
  const [screw5x60, setScrew5x60] = useState(String(settings.screw5x60_500PackEur))
  const [shelfPin, setShelfPin] = useState(String(settings.shelfPinEur))

  const handleSave = () => {
    onSave({
      hingeSoftCloseEur: parseFloat(hingeSoftClose) || 0.70,
      hingeNormalEur: parseFloat(hingeNormal) || 0.20,
      useNormalHinge: useNormal,
      hingeScrew1000PackEur: parseFloat(hingeScrew) || 5.00,
      screw5x60_500PackEur: parseFloat(screw5x60) || 13.00,
      shelfPinEur: parseFloat(shelfPin) || 0.05,
    })
    onOpenChange(false)
  }

  const handleReset = () => {
    const defaults = onReset()
    setHingeSoftClose(String(defaults.hingeSoftCloseEur))
    setHingeNormal(String(defaults.hingeNormalEur))
    setUseNormal(defaults.useNormalHinge)
    setHingeScrew(String(defaults.hingeScrew1000PackEur))
    setScrew5x60(String(defaults.screw5x60_500PackEur))
    setShelfPin(String(defaults.shelfPinEur))
  }

  const currentHinge = useNormal ? hingeNormal : hingeSoftClose
  const hingeScrewUnit = (parseFloat(hingeScrew) || 5) / 1000
  const screw5x60Unit = (parseFloat(screw5x60) || 13) / 500

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Настройки на фурнитура
          </DialogTitle>
          <DialogDescription>
            Тук можеш да настроиш цените на фурнитурата. Промените се записват локално в браузъра.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-[var(--color-border)] p-4">
            <h3 className="mb-3 font-medium">Панти</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="hinge-soft-close">Панта плавно прибиране (€/бр.)</Label>
                <Input
                  id="hinge-soft-close"
                  type="number"
                  step="0.01"
                  min="0"
                  value={hingeSoftClose}
                  onChange={(e) => setHingeSoftClose(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="hinge-normal">Панта нормално прибиране (€/бр.)</Label>
                <Input
                  id="hinge-normal"
                  type="number"
                  step="0.01"
                  min="0"
                  value={hingeNormal}
                  onChange={(e) => setHingeNormal(e.target.value)}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={useNormal} onCheckedChange={(c) => setUseNormal(c === true)} />
                Използвай нормални панти по подразбиране
              </label>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Текуща цена на панта: <strong>{formatEur(parseFloat(currentHinge) || 0)}</strong>
                {useNormal ? ' (нормална)' : ' (плавно прибиране)'}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-[var(--color-border)] p-4">
            <h3 className="mb-3 font-medium">Винтове</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="hinge-screw">Винтчета за панти — кутия 1000 бр. (€)</Label>
                <Input
                  id="hinge-screw"
                  type="number"
                  step="0.01"
                  min="0"
                  value={hingeScrew}
                  onChange={(e) => setHingeScrew(e.target.value)}
                />
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Цена за 4 винтчета (1 панта): <strong>{formatEur(hingeScrewUnit * 4)}</strong>
                </p>
              </div>
              <div>
                <Label htmlFor="screw-5x60">Винт 5×60 за сглобяване — кутия 500 бр. (€)</Label>
                <Input
                  id="screw-5x60"
                  type="number"
                  step="0.01"
                  min="0"
                  value={screw5x60}
                  onChange={(e) => setScrew5x60(e.target.value)}
                />
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Цена на винт: <strong>{formatEur(screw5x60Unit, 3)}</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-[var(--color-border)] p-4">
            <h3 className="mb-3 font-medium">Рафтове</h3>
            <div>
              <Label htmlFor="shelf-pin">Рафтоносач (€/бр.)</Label>
              <Input
                id="shelf-pin"
                type="number"
                step="0.01"
                min="0"
                value={shelfPin}
                onChange={(e) => setShelfPin(e.target.value)}
              />
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                4 рафтоносача на рафт: <strong>{formatEur((parseFloat(shelfPin) || 0) * 4)}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleSave}>
            Запази настройките
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Върни стандартните
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
