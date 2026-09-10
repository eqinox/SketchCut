import { useEffect, useState } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ALL_SLIDE_LENGTHS,
  SLIDE_LENGTHS,
  formatEur,
} from '@/lib/cabinets'
import {
  DEFAULT_HARDWARE_SETTINGS,
  type HardwareSettings,
  type PriceByLength,
} from '@/lib/settings'
import {
  DEFAULT_ASSEMBLY_TIME_SETTINGS,
  SIZE_MEDIUM_SPAN_MM,
  SIZE_LARGE_SPAN_MM,
  BACK_LARGE_MIN_HEIGHT_MM,
  BACK_LARGE_MIN_WIDTH_MM,
  type AssemblyTimeSettings,
} from '@/lib/assembly-time'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: HardwareSettings
  onSave: (settings: HardwareSettings) => void
  onReset: () => HardwareSettings
  assemblyTimeSettings: AssemblyTimeSettings
  onSaveAssemblyTime: (settings: AssemblyTimeSettings) => void
  onResetAssemblyTime: () => AssemblyTimeSettings
}

function packUnit(packEur: string, packQty: number): number {
  return (parseFloat(packEur) || 0) / packQty
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
  onReset,
  assemblyTimeSettings,
  onSaveAssemblyTime,
  onResetAssemblyTime,
}: SettingsDialogProps) {
  const [hingeSoftClose, setHingeSoftClose] = useState('')
  const [hingeNormal, setHingeNormal] = useState('')
  const [useNormal, setUseNormal] = useState(false)
  const [smallScrew, setSmallScrew] = useState('')
  const [screw5x60, setScrew5x60] = useState('')
  const [shelfPin, setShelfPin] = useState('')
  const [handleNormal, setHandleNormal] = useState('')
  const [clothesRailPrice, setClothesRailPrice] = useState('')
  const [edgeMm2, setEdgeMm2] = useState('')
  const [edgeMm05, setEdgeMm05] = useState('')
  const [billWholeSheets, setBillWholeSheets] = useState(true)
  const [slideRoller, setSlideRoller] = useState<PriceByLength>({})
  const [slideSoftFull, setSlideSoftFull] = useState<PriceByLength>({})
  const [slideSoftPartial, setSlideSoftPartial] = useState<PriceByLength>({})
  
  // Assembly time settings state
  const [edgeUpTo50, setEdgeUpTo50] = useState('')
  const [edgeUpTo100, setEdgeUpTo100] = useState('')
  const [edgeUpTo150, setEdgeUpTo150] = useState('')
  const [edgeAdditional, setEdgeAdditional] = useState('')
  const [installLegs, setInstallLegs] = useState('')
  const [assembleRails, setAssembleRails] = useState('')
  const [shelfPinPair, setShelfPinPair] = useState('')
  const [backSmall, setBackSmall] = useState('')
  const [backLarge, setBackLarge] = useState('')
  const [plinthSmall, setPlinthSmall] = useState('')
  const [plinthMedium, setPlinthMedium] = useState('')
  const [plinthLarge, setPlinthLarge] = useState('')
  const [sidesSmall, setSidesSmall] = useState('')
  const [sidesMedium, setSidesMedium] = useState('')
  const [sidesLarge, setSidesLarge] = useState('')
  const [topSmall, setTopSmall] = useState('')
  const [topMedium, setTopMedium] = useState('')
  const [topLarge, setTopLarge] = useState('')
  const [clothesConsole, setClothesConsole] = useState('')
  const [clothesCut, setClothesCut] = useState('')
  const [clothesInstall, setClothesInstall] = useState('')
  const [drawerGuides, setDrawerGuides] = useState('')
  const [drawerBox, setDrawerBox] = useState('')
  const [drawerBack, setDrawerBack] = useState('')
  const [drawerRunners, setDrawerRunners] = useState('')
  const [drawerFront, setDrawerFront] = useState('')
  const [installDoor, setInstallDoor] = useState('')

  const applySettings = (s: HardwareSettings) => {
    setHingeSoftClose(String(s.hingeSoftCloseEur))
    setHingeNormal(String(s.hingeNormalEur))
    setUseNormal(s.useNormalHinge)
    setSmallScrew(String(s.smallScrew1000PackEur))
    setScrew5x60(String(s.screw5x60_500PackEur))
    setShelfPin(String(s.shelfPinEur))
    setHandleNormal(String(s.handleNormalEur))
    setClothesRailPrice(String(s.clothesRailEurPerM))
    setEdgeMm2(String(s.edgeMm2Eur))
    setEdgeMm05(String(s.edgeMm05Eur))
    setBillWholeSheets(s.billWholeSheets)
    setSlideRoller({ ...s.slideRollerEur })
    setSlideSoftFull({ ...s.slideSoftFullEur })
    setSlideSoftPartial({ ...s.slideSoftPartialEur })
  }
  
  const applyAssemblyTimeSettings = (s: AssemblyTimeSettings) => {
    setEdgeUpTo50(String(s.edgeBanding.thinEdgeUpTo50cm))
    setEdgeUpTo100(String(s.edgeBanding.thinEdgeUpTo100cm))
    setEdgeUpTo150(String(s.edgeBanding.thinEdgeUpTo150cm))
    setEdgeAdditional(String(s.edgeBanding.thinEdgeAdditionalPer50cm))
    setInstallLegs(String(s.installLegsMinutes))
    setAssembleRails(String(s.assembleTopRailsMinutes))
    setShelfPinPair(String(s.shelfPinPairMinutes))
    setBackSmall(String(s.backSmallMinutes))
    setBackLarge(String(s.backLargeMinutes))
    setPlinthSmall(String(s.plinthSmallMinutes))
    setPlinthMedium(String(s.plinthMediumMinutes))
    setPlinthLarge(String(s.plinthLargeMinutes))
    setSidesSmall(String(s.sidesToBottomSmallMinutes))
    setSidesMedium(String(s.sidesToBottomMediumMinutes))
    setSidesLarge(String(s.sidesToBottomLargeMinutes))
    setTopSmall(String(s.topSmallMinutes))
    setTopMedium(String(s.topMediumMinutes))
    setTopLarge(String(s.topLargeMinutes))
    setClothesConsole(String(s.clothesRailConsoleMinutes))
    setClothesCut(String(s.clothesRailCutMinutes))
    setClothesInstall(String(s.clothesRailInstallMinutes))
    setDrawerGuides(String(s.installDrawerGuidesMinutes))
    setDrawerBox(String(s.assembleDrawerBoxMinutes))
    setDrawerBack(String(s.attachDrawerBackMinutes))
    setDrawerRunners(String(s.attachDrawerRunnersMinutes))
    setDrawerFront(String(s.installDrawerFrontMinutes))
    setInstallDoor(String(s.installDoorMinutes))
  }

  useEffect(() => {
    if (open) {
      applySettings(settings)
      applyAssemblyTimeSettings(assemblyTimeSettings)
    }
  }, [open, settings, assemblyTimeSettings])

  const handleSave = () => {
    onSave({
      ...DEFAULT_HARDWARE_SETTINGS,
      hingeSoftCloseEur: parseFloat(hingeSoftClose) || DEFAULT_HARDWARE_SETTINGS.hingeSoftCloseEur,
      hingeNormalEur: parseFloat(hingeNormal) || DEFAULT_HARDWARE_SETTINGS.hingeNormalEur,
      useNormalHinge: useNormal,
      smallScrew1000PackEur: parseFloat(smallScrew) || DEFAULT_HARDWARE_SETTINGS.smallScrew1000PackEur,
      screw5x60_500PackEur: parseFloat(screw5x60) || DEFAULT_HARDWARE_SETTINGS.screw5x60_500PackEur,
      shelfPinEur: parseFloat(shelfPin) || DEFAULT_HARDWARE_SETTINGS.shelfPinEur,
      handleNormalEur: parseFloat(handleNormal) || DEFAULT_HARDWARE_SETTINGS.handleNormalEur,
      clothesRailEurPerM: parseFloat(clothesRailPrice) || DEFAULT_HARDWARE_SETTINGS.clothesRailEurPerM,
      edgeMm2Eur: parseFloat(edgeMm2) || DEFAULT_HARDWARE_SETTINGS.edgeMm2Eur,
      edgeMm05Eur: parseFloat(edgeMm05) || DEFAULT_HARDWARE_SETTINGS.edgeMm05Eur,
      billWholeSheets,
      slideRollerEur: { ...slideRoller },
      slideSoftFullEur: { ...slideSoftFull },
      slideSoftPartialEur: { ...slideSoftPartial },
    })
    onOpenChange(false)
  }

  const handleReset = () => {
    applySettings(onReset())
  }
  
  const handleSaveAssemblyTime = () => {
    onSaveAssemblyTime({
      ...DEFAULT_ASSEMBLY_TIME_SETTINGS,
      edgeBanding: {
        thinEdgeUpTo50cm: parseFloat(edgeUpTo50) || DEFAULT_ASSEMBLY_TIME_SETTINGS.edgeBanding.thinEdgeUpTo50cm,
        thinEdgeUpTo100cm: parseFloat(edgeUpTo100) || DEFAULT_ASSEMBLY_TIME_SETTINGS.edgeBanding.thinEdgeUpTo100cm,
        thinEdgeUpTo150cm: parseFloat(edgeUpTo150) || DEFAULT_ASSEMBLY_TIME_SETTINGS.edgeBanding.thinEdgeUpTo150cm,
        thinEdgeAdditionalPer50cm: parseFloat(edgeAdditional) || DEFAULT_ASSEMBLY_TIME_SETTINGS.edgeBanding.thinEdgeAdditionalPer50cm,
      },
      installLegsMinutes: parseFloat(installLegs) || DEFAULT_ASSEMBLY_TIME_SETTINGS.installLegsMinutes,
      assembleTopRailsMinutes: parseFloat(assembleRails) || DEFAULT_ASSEMBLY_TIME_SETTINGS.assembleTopRailsMinutes,
      shelfPinPairMinutes: parseFloat(shelfPinPair) || DEFAULT_ASSEMBLY_TIME_SETTINGS.shelfPinPairMinutes,
      backSmallMinutes: parseFloat(backSmall) || DEFAULT_ASSEMBLY_TIME_SETTINGS.backSmallMinutes,
      backLargeMinutes: parseFloat(backLarge) || DEFAULT_ASSEMBLY_TIME_SETTINGS.backLargeMinutes,
      plinthSmallMinutes: parseFloat(plinthSmall) || DEFAULT_ASSEMBLY_TIME_SETTINGS.plinthSmallMinutes,
      plinthMediumMinutes: parseFloat(plinthMedium) || DEFAULT_ASSEMBLY_TIME_SETTINGS.plinthMediumMinutes,
      plinthLargeMinutes: parseFloat(plinthLarge) || DEFAULT_ASSEMBLY_TIME_SETTINGS.plinthLargeMinutes,
      sidesToBottomSmallMinutes: parseFloat(sidesSmall) || DEFAULT_ASSEMBLY_TIME_SETTINGS.sidesToBottomSmallMinutes,
      sidesToBottomMediumMinutes: parseFloat(sidesMedium) || DEFAULT_ASSEMBLY_TIME_SETTINGS.sidesToBottomMediumMinutes,
      sidesToBottomLargeMinutes: parseFloat(sidesLarge) || DEFAULT_ASSEMBLY_TIME_SETTINGS.sidesToBottomLargeMinutes,
      topSmallMinutes: parseFloat(topSmall) || DEFAULT_ASSEMBLY_TIME_SETTINGS.topSmallMinutes,
      topMediumMinutes: parseFloat(topMedium) || DEFAULT_ASSEMBLY_TIME_SETTINGS.topMediumMinutes,
      topLargeMinutes: parseFloat(topLarge) || DEFAULT_ASSEMBLY_TIME_SETTINGS.topLargeMinutes,
      clothesRailConsoleMinutes: parseFloat(clothesConsole) || DEFAULT_ASSEMBLY_TIME_SETTINGS.clothesRailConsoleMinutes,
      clothesRailCutMinutes: parseFloat(clothesCut) || DEFAULT_ASSEMBLY_TIME_SETTINGS.clothesRailCutMinutes,
      clothesRailInstallMinutes: parseFloat(clothesInstall) || DEFAULT_ASSEMBLY_TIME_SETTINGS.clothesRailInstallMinutes,
      installDrawerGuidesMinutes: parseFloat(drawerGuides) || DEFAULT_ASSEMBLY_TIME_SETTINGS.installDrawerGuidesMinutes,
      assembleDrawerBoxMinutes: parseFloat(drawerBox) || DEFAULT_ASSEMBLY_TIME_SETTINGS.assembleDrawerBoxMinutes,
      attachDrawerBackMinutes: parseFloat(drawerBack) || DEFAULT_ASSEMBLY_TIME_SETTINGS.attachDrawerBackMinutes,
      attachDrawerRunnersMinutes: parseFloat(drawerRunners) || DEFAULT_ASSEMBLY_TIME_SETTINGS.attachDrawerRunnersMinutes,
      installDrawerFrontMinutes: parseFloat(drawerFront) || DEFAULT_ASSEMBLY_TIME_SETTINGS.installDrawerFrontMinutes,
      installDoorMinutes: parseFloat(installDoor) || DEFAULT_ASSEMBLY_TIME_SETTINGS.installDoorMinutes,
    })
    onOpenChange(false)
  }
  
  const handleResetAssemblyTime = () => {
    applyAssemblyTimeSettings(onResetAssemblyTime())
  }

  const currentHinge = useNormal ? hingeNormal : hingeSoftClose

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Настройки
          </DialogTitle>
          <DialogDescription>
            Всички настройки се записват локално. После ще се дърпат от базата.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="prices" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="prices">Цени</TabsTrigger>
            <TabsTrigger value="assembly-time">Време за изработка</TabsTrigger>
          </TabsList>

          <TabsContent value="prices" className="space-y-4 mt-4">
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
                {' · '}1 панта = 2× 4×16 + 2× 4×20
              </p>
            </div>
          </div>

          <div className="rounded-md border border-[var(--color-border)] p-4">
            <h3 className="mb-3 font-medium">Винтчета</h3>
            <div>
              <Label htmlFor="small-screw">4×16 / 4×20 / 3.5×16 / 3.5×20 — кутия 1000 бр. (€)</Label>
              <Input
                id="small-screw"
                type="number"
                step="0.01"
                min="0"
                value={smallScrew}
                onChange={(e) => setSmallScrew(e.target.value)}
              />
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                Една цена за всички дребни винтчета.{' '}
                1 бр. <strong>{formatEur(packUnit(smallScrew, 1000), 4)}</strong>
                {' · '}1 панта (2+2): {formatEur(packUnit(smallScrew, 1000) * 4, 3)}
                {' · '}ролков водач (3): {formatEur(packUnit(smallScrew, 1000) * 3, 3)}
                {' · '}плавно (3+4 перки): {formatEur(packUnit(smallScrew, 1000) * 7, 3)}
              </p>
            </div>
            <div className="mt-3">
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
                Цена на винт: <strong>{formatEur(packUnit(screw5x60, 500), 3)}</strong>
              </p>
            </div>
          </div>

          <div className="rounded-md border border-[var(--color-border)] p-4">
            <h3 className="mb-3 font-medium">Водачи (€/бр. по дължина)</h3>
            <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
              2 водача на чекмедже. Плавно прибиране: +4 винтчета 3.5×16 на водач за перките.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted-foreground)]">
                    <th className="px-2 py-1.5">мм</th>
                    <th className="px-2 py-1.5">Ролкови</th>
                    <th className="px-2 py-1.5">Плавно пълно</th>
                    <th className="px-2 py-1.5">Плавно частично</th>
                  </tr>
                </thead>
                <tbody>
                  {ALL_SLIDE_LENGTHS.map((len) => {
                    const key = String(len)
                    const hasRoller = SLIDE_LENGTHS.roller.includes(len)
                    const hasSoft = SLIDE_LENGTHS['soft-full'].includes(len)
                    return (
                      <tr key={len} className="border-b border-[var(--color-border)]/40">
                        <td className="px-2 py-1.5 tabular-nums">{len}</td>
                        <td className="px-2 py-1">
                          {hasRoller ? (
                            <PriceInput
                              value={slideRoller[key] ?? 0}
                              onChange={(n) => setSlideRoller((m) => ({ ...m, [key]: n }))}
                            />
                          ) : (
                            <span className="text-xs text-[var(--color-muted-foreground)]">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {hasSoft ? (
                            <PriceInput
                              value={slideSoftFull[key] ?? 0}
                              onChange={(n) => setSlideSoftFull((m) => ({ ...m, [key]: n }))}
                            />
                          ) : (
                            <span className="text-xs text-[var(--color-muted-foreground)]">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {hasSoft ? (
                            <PriceInput
                              value={slideSoftPartial[key] ?? 0}
                              onChange={(n) => setSlideSoftPartial((m) => ({ ...m, [key]: n }))}
                            />
                          ) : (
                            <span className="text-xs text-[var(--color-muted-foreground)]">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-[var(--color-border)] p-4">
              <h3 className="mb-3 font-medium">Рафтове</h3>
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
            <div className="rounded-md border border-[var(--color-border)] p-4">
              <h3 className="mb-3 font-medium">Лост за дрехи</h3>
              <Label htmlFor="clothes-rail">Лост (€/м)</Label>
              <Input
                id="clothes-rail"
                type="number"
                step="0.01"
                min="0"
                value={clothesRailPrice}
                onChange={(e) => setClothesRailPrice(e.target.value)}
              />
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                Дължината е вътрешната широчина (между страниците).
              </p>
            </div>
            <div className="rounded-md border border-[var(--color-border)] p-4">
              <h3 className="mb-3 font-medium">Дръжки</h3>
              <Label htmlFor="handle-normal">Обикновена дръжка (€/бр.)</Label>
              <Input
                id="handle-normal"
                type="number"
                step="0.01"
                min="0"
                value={handleNormal}
                onChange={(e) => setHandleNormal(e.target.value)}
              />
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                По 1 дръжка на врата и на чекмедже.
              </p>
            </div>
            <div className="rounded-md border border-[var(--color-border)] p-4">
              <h3 className="mb-3 font-medium">Кант (€/м)</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="edge-mm2">Кант 2 мм</Label>
                  <Input
                    id="edge-mm2"
                    type="number"
                    step="0.01"
                    min="0"
                    value={edgeMm2}
                    onChange={(e) => setEdgeMm2(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edge-mm05">Кант 0.5 мм</Label>
                  <Input
                    id="edge-mm05"
                    type="number"
                    step="0.01"
                    min="0"
                    value={edgeMm05}
                    onChange={(e) => setEdgeMm05(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="rounded-md border border-[var(--color-border)] p-4 sm:col-span-2">
              <h3 className="mb-3 font-medium">Плочи</h3>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={billWholeSheets}
                  onCheckedChange={(c) => setBillWholeSheets(c === true)}
                />
                <span>
                  Цена за цели закупени плочи
                  <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
                    Ако отидат 3,5 плочи, сметката е за 4 — толкова трябва да се купят. Без отметка се
                    брои само изразходваната част.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleSave}>
            Запази настройките за цени
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Върни стандартните
          </Button>
        </div>
          </TabsContent>

          <TabsContent value="assembly-time" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="rounded-md border border-[var(--color-border)] p-4">
                <h3 className="mb-3 font-medium">Обработка на кантирани страни (тънък кант)</h3>
                <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
                  Време за проходване с длето и шлайфане с шкурка на една кантирана страна.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="edge-up-to-50">До 50 см дълъг елемент (секунди)</Label>
                    <Input
                      id="edge-up-to-50"
                      type="number"
                      step="1"
                      min="0"
                      value={edgeUpTo50}
                      onChange={(e) => setEdgeUpTo50(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edge-up-to-100">До 1 метър дълъг елемент (секунди)</Label>
                    <Input
                      id="edge-up-to-100"
                      type="number"
                      step="1"
                      min="0"
                      value={edgeUpTo100}
                      onChange={(e) => setEdgeUpTo100(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edge-up-to-150">До 1.5 метра дълъг елемент (секунди)</Label>
                    <Input
                      id="edge-up-to-150"
                      type="number"
                      step="1"
                      min="0"
                      value={edgeUpTo150}
                      onChange={(e) => setEdgeUpTo150(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edge-additional">Допълнително на всеки 50 см (секунди)</Label>
                    <Input
                      id="edge-additional"
                      type="number"
                      step="1"
                      min="0"
                      value={edgeAdditional}
                      onChange={(e) => setEdgeAdditional(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-[var(--color-border)] p-4">
                <h3 className="mb-3 font-medium">Сглобяване на корпус</h3>
                <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
                  Малък: широчина до {SIZE_MEDIUM_SPAN_MM} мм. Среден: над {SIZE_MEDIUM_SPAN_MM} мм.
                  Голям: над {SIZE_LARGE_SPAN_MM} мм.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="install-legs">Слагане на 4 крачета на дъното (минути)</Label>
                    <Input
                      id="install-legs"
                      type="number"
                      step="0.5"
                      min="0"
                      value={installLegs}
                      onChange={(e) => setInstallLegs(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="assemble-rails">Сглобяване на 2 бленди горе (минути)</Label>
                    <Input
                      id="assemble-rails"
                      type="number"
                      step="0.5"
                      min="0"
                      value={assembleRails}
                      onChange={(e) => setAssembleRails(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="plinth-small">Цокъл към дъното — малък</Label>
                    <Input id="plinth-small" type="number" step="0.5" min="0" value={plinthSmall} onChange={(e) => setPlinthSmall(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="plinth-medium">Цокъл — среден</Label>
                    <Input id="plinth-medium" type="number" step="0.5" min="0" value={plinthMedium} onChange={(e) => setPlinthMedium(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="plinth-large">Цокъл — голям</Label>
                    <Input id="plinth-large" type="number" step="0.5" min="0" value={plinthLarge} onChange={(e) => setPlinthLarge(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="sides-small">Страници към дъното — малък</Label>
                    <Input id="sides-small" type="number" step="0.5" min="0" value={sidesSmall} onChange={(e) => setSidesSmall(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="sides-medium">Страници — среден</Label>
                    <Input id="sides-medium" type="number" step="0.5" min="0" value={sidesMedium} onChange={(e) => setSidesMedium(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="sides-large">Страници — голям</Label>
                    <Input id="sides-large" type="number" step="0.5" min="0" value={sidesLarge} onChange={(e) => setSidesLarge(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="top-small">Плот — малък</Label>
                    <Input id="top-small" type="number" step="0.5" min="0" value={topSmall} onChange={(e) => setTopSmall(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="top-medium">Плот — среден</Label>
                    <Input id="top-medium" type="number" step="0.5" min="0" value={topMedium} onChange={(e) => setTopMedium(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="top-large">Плот — голям</Label>
                    <Input id="top-large" type="number" step="0.5" min="0" value={topLarge} onChange={(e) => setTopLarge(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-[var(--color-border)] p-4">
                <h3 className="mb-3 font-medium">Гръб, рафтоносачи и лост</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="back-small">Слагане на гръб — малък (минути)</Label>
                    <Input id="back-small" type="number" step="0.5" min="0" value={backSmall} onChange={(e) => setBackSmall(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="back-large">Гръб — голям (минути)</Label>
                    <Input id="back-large" type="number" step="0.5" min="0" value={backLarge} onChange={(e) => setBackLarge(e.target.value)} />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Голям: над {BACK_LARGE_MIN_HEIGHT_MM} мм висок и над {BACK_LARGE_MIN_WIDTH_MM} мм широк.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="shelf-pin-pair">Рафтоносачи за 1 рафт (минути)</Label>
                    <Input id="shelf-pin-pair" type="number" step="0.5" min="0" value={shelfPinPair} onChange={(e) => setShelfPinPair(e.target.value)} />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      4 рафтоносача на рафт. 7 рафта × това време.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="clothes-console">Конзоли за лост (минути)</Label>
                    <Input id="clothes-console" type="number" step="0.5" min="0" value={clothesConsole} onChange={(e) => setClothesConsole(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="clothes-cut">Срязване на лоста (минути)</Label>
                    <Input id="clothes-cut" type="number" step="0.5" min="0" value={clothesCut} onChange={(e) => setClothesCut(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="clothes-install">Слагане на лоста (минути)</Label>
                    <Input id="clothes-install" type="number" step="0.5" min="0" value={clothesInstall} onChange={(e) => setClothesInstall(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-[var(--color-border)] p-4">
                <h3 className="mb-3 font-medium">Сглобяване на чекмедже</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="drawer-guides">Слагане на водачи на страниците (мин/водач)</Label>
                    <Input
                      id="drawer-guides"
                      type="number"
                      step="0.5"
                      min="0"
                      value={drawerGuides}
                      onChange={(e) => setDrawerGuides(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      За всеки следващ водач се добавя това време
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="drawer-box">Сглобяване на кутията на чекмеджето (минути)</Label>
                    <Input
                      id="drawer-box"
                      type="number"
                      step="0.5"
                      min="0"
                      value={drawerBox}
                      onChange={(e) => setDrawerBox(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="drawer-back">Слагане на гръб на чекмеджето (минути)</Label>
                    <Input
                      id="drawer-back"
                      type="number"
                      step="0.5"
                      min="0"
                      value={drawerBack}
                      onChange={(e) => setDrawerBack(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="drawer-runners">Слагане на водачите (минути)</Label>
                    <Input
                      id="drawer-runners"
                      type="number"
                      step="0.5"
                      min="0"
                      value={drawerRunners}
                      onChange={(e) => setDrawerRunners(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="drawer-front">Слагане на чело и регулация (минути)</Label>
                    <Input
                      id="drawer-front"
                      type="number"
                      step="0.5"
                      min="0"
                      value={drawerFront}
                      onChange={(e) => setDrawerFront(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Включва пробиване на дупки, слагане на челото и регулация на фугите
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
                  <strong>Общо време за 1 чекмедже:</strong> {' '}
                  {(
                    (parseFloat(drawerBox) || 0) +
                    (parseFloat(drawerBack) || 0) +
                    (parseFloat(drawerRunners) || 0) +
                    (parseFloat(drawerFront) || 0)
                  ).toFixed(1)} минути
                </p>
              </div>

              <div className="rounded-md border border-[var(--color-border)] p-4">
                <h3 className="mb-3 font-medium">Слагане на врата</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="install-door">Слагане на 1 врата (минути)</Label>
                    <Input
                      id="install-door"
                      type="number"
                      step="0.5"
                      min="0"
                      value={installDoor}
                      onChange={(e) => setInstallDoor(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Включва изчистване, взимане на ръбове, пробиване за панти и слагане
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSaveAssemblyTime}>
                Запази настройките за време
              </Button>
              <Button variant="outline" onClick={handleResetAssemblyTime}>
                Върни стандартните
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function PriceInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Input
      type="number"
      step="0.01"
      min="0"
      className="h-8 w-[5.5rem]"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  )
}
