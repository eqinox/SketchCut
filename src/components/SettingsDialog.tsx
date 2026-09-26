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
  DEFAULT_SLIDING_LINKS,
  SLIDING_TRACK_COLOR_IDS,
  SLIDING_TRACK_COLOR_LABELS,
  type SlidingHardwareLinks,
  type SlidingProfileSku,
  type SlidingTrackColor,
} from '@/lib/sliding-hardware'
import {
  DEFAULT_ASSEMBLY_TIME_SETTINGS,
  cabinetSizeAxisDefinitionText,
  cabinetSizeScoringHelp,
  classifyCabinetSize,
  formatCabinetSizeBreakdown,
  normalizeAxisLimits,
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
  signedIn?: boolean
}

function packUnit(packEur: string, packQty: number): number {
  return (parseFloat(packEur) || 0) / packQty
}

function parsePositiveMm(raw: string, fallback: number): number {
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.round(n)
}

function SizeAxisFields({
  id,
  title,
  smallValue,
  mediumValue,
  onSmallChange,
  onMediumChange,
}: {
  id: string
  title: string
  smallValue: string
  mediumValue: string
  onSmallChange: (value: string) => void
  onMediumChange: (value: string) => void
}) {
  const small = parsePositiveMm(smallValue, 1)
  const mediumRaw = parsePositiveMm(mediumValue, small + 1)
  const invalid = mediumRaw <= small
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium">{title}</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-small`}>Малък до (мм)</Label>
          <Input
            id={`${id}-small`}
            type="number"
            step="1"
            min="1"
            value={smallValue}
            onChange={(e) => onSmallChange(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`${id}-medium`}>Среден до (мм)</Label>
          <Input
            id={`${id}-medium`}
            type="number"
            step="1"
            min="1"
            value={mediumValue}
            onChange={(e) => onMediumChange(e.target.value)}
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        {cabinetSizeAxisDefinitionText(small, mediumRaw)}
      </p>
      {invalid && (
        <p className="mt-1 text-xs text-red-600">
          Средният трябва да е над малкия. При запис ще стане {small + 1} мм.
        </p>
      )}
    </div>
  )
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
  signedIn = false,
}: SettingsDialogProps) {
  const [hingeSoftClose, setHingeSoftClose] = useState('')
  const [hingeNormal, setHingeNormal] = useState('')
  const [useNormal, setUseNormal] = useState(false)
  const [smallScrew, setSmallScrew] = useState('')
  const [screw5x60, setScrew5x60] = useState('')
  const [shelfPin, setShelfPin] = useState('')
  const [handleNormal, setHandleNormal] = useState('')
  const [clothesRailPrice, setClothesRailPrice] = useState('')
  const [slidingUpperTrack, setSlidingUpperTrack] = useState<Record<SlidingTrackColor, string>>(
    Object.fromEntries(SLIDING_TRACK_COLOR_IDS.map((id) => [id, ''])) as Record<SlidingTrackColor, string>,
  )
  const [slidingLowerTrack, setSlidingLowerTrack] = useState<Record<SlidingTrackColor, string>>(
    Object.fromEntries(SLIDING_TRACK_COLOR_IDS.map((id) => [id, ''])) as Record<SlidingTrackColor, string>,
  )
  const [slidingMvp005Kit, setSlidingMvp005Kit] = useState('')
  const [slidingSoftClose, setSlidingSoftClose] = useState('')
  const [slidingHandleSkus, setSlidingHandleSkus] = useState<SlidingProfileSku[]>([])
  const [slidingHandlePrices, setSlidingHandlePrices] = useState<Record<string, string>>({})
  const [slidingCapSkus, setSlidingCapSkus] = useState<SlidingProfileSku[]>([])
  const [slidingCapPrices, setSlidingCapPrices] = useState<Record<string, string>>({})
  const [slidingLinks, setSlidingLinks] = useState<SlidingHardwareLinks>({ ...DEFAULT_SLIDING_LINKS })
  const [edgeMm2, setEdgeMm2] = useState('')
  const [edgeMm05, setEdgeMm05] = useState('')
  const [billWholeSheets, setBillWholeSheets] = useState(true)
  const [chipboardPrice, setChipboardPrice] = useState('')
  const [hardboardPrice, setHardboardPrice] = useState('')
  const [billWholeHardboardSheets, setBillWholeHardboardSheets] = useState(true)
  const [skipCuttingEdgingLabor, setSkipCuttingEdgingLabor] = useState(false)
  const [skipBoardAndEdgeCost, setSkipBoardAndEdgeCost] = useState(false)
  const [externalDoors, setExternalDoors] = useState(false)
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
  const [frontFascia, setFrontFascia] = useState('')
  const [prepareWallSides, setPrepareWallSides] = useState('')
  const [assembleWallCarcass, setAssembleWallCarcass] = useState('')
  const [shelfPinPair, setShelfPinPair] = useState('')
  const [shelfPinExtra, setShelfPinExtra] = useState('')
  const [shelfPinPairDeep, setShelfPinPairDeep] = useState('')
  const [shelfPinDeepMinDepth, setShelfPinDeepMinDepth] = useState('')
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
  const [topCornersSmall, setTopCornersSmall] = useState('')
  const [topCornersMedium, setTopCornersMedium] = useState('')
  const [topCornersLarge, setTopCornersLarge] = useState('')
  const [clothesConsole, setClothesConsole] = useState('')
  const [clothesCut, setClothesCut] = useState('')
  const [clothesInstall, setClothesInstall] = useState('')
  const [drawerGuides, setDrawerGuides] = useState('')
  const [drawerGuidesDeep, setDrawerGuidesDeep] = useState('')
  const [drawerGuidesSoft, setDrawerGuidesSoft] = useState('')
  const [drawerGuideDeepMinHeight, setDrawerGuideDeepMinHeight] = useState('')
  const [softGrooveFirst, setSoftGrooveFirst] = useState('')
  const [softGrooveExtra, setSoftGrooveExtra] = useState('')
  const [drawerBox, setDrawerBox] = useState('')
  const [drawerBack, setDrawerBack] = useState('')
  const [drawerRunners, setDrawerRunners] = useState('')
  const [drawerFront, setDrawerFront] = useState('')
  const [frontEdgeSmall, setFrontEdgeSmall] = useState('')
  const [frontEdgeTall, setFrontEdgeTall] = useState('')
  const [installDoorSmall, setInstallDoorSmall] = useState('')
  const [installDoorTall, setInstallDoorTall] = useState('')
  const [tallDoorRouter, setTallDoorRouter] = useState('')
  const [tallDoorMinHeight, setTallDoorMinHeight] = useState('')
  const [installUpperTrack, setInstallUpperTrack] = useState('')
  const [installLowerTrack, setInstallLowerTrack] = useState('')
  const [installSlidingDoorHardware, setInstallSlidingDoorHardware] = useState('')
  const [sizeWidthSmall, setSizeWidthSmall] = useState('')
  const [sizeWidthMedium, setSizeWidthMedium] = useState('')
  const [sizeHeightSmall, setSizeHeightSmall] = useState('')
  const [sizeHeightMedium, setSizeHeightMedium] = useState('')
  const [sizeDepthSmall, setSizeDepthSmall] = useState('')
  const [sizeDepthMedium, setSizeDepthMedium] = useState('')
  const [partitionMark, setPartitionMark] = useState('')
  const [fixedShelfMark, setFixedShelfMark] = useState('')
  const [partitionDetailSmall, setPartitionDetailSmall] = useState('')
  const [partitionDetailMedium, setPartitionDetailMedium] = useState('')
  const [partitionDetailLarge, setPartitionDetailLarge] = useState('')
  const [backLargeMinHeight, setBackLargeMinHeight] = useState('')
  const [backLargeMinWidth, setBackLargeMinWidth] = useState('')

  const applySettings = (s: HardwareSettings) => {
    setHingeSoftClose(String(s.hingeSoftCloseEur))
    setHingeNormal(String(s.hingeNormalEur))
    setUseNormal(s.useNormalHinge)
    setSmallScrew(String(s.smallScrew1000PackEur))
    setScrew5x60(String(s.screw5x60_500PackEur))
    setShelfPin(String(s.shelfPinEur))
    setHandleNormal(String(s.handleNormalEur))
    setClothesRailPrice(String(s.clothesRailEurPerM))
    setSlidingUpperTrack(
      Object.fromEntries(SLIDING_TRACK_COLOR_IDS.map((id) => [id, String(s.slidingUpperTrackEur[id])])) as Record<
        SlidingTrackColor,
        string
      >,
    )
    setSlidingLowerTrack(
      Object.fromEntries(SLIDING_TRACK_COLOR_IDS.map((id) => [id, String(s.slidingLowerTrackEur[id])])) as Record<
        SlidingTrackColor,
        string
      >,
    )
    setSlidingMvp005Kit(String(s.slidingMvp005KitEur))
    setSlidingSoftClose(String(s.slidingSoftCloseEur))
    setSlidingHandleSkus(s.slidingHandleSkus.map((sku) => ({ ...sku })))
    setSlidingHandlePrices(Object.fromEntries(s.slidingHandleSkus.map((sku) => [sku.id, String(sku.priceEur)])))
    setSlidingCapSkus(s.slidingCapSkus.map((sku) => ({ ...sku })))
    setSlidingCapPrices(Object.fromEntries(s.slidingCapSkus.map((sku) => [sku.id, String(sku.priceEur)])))
    setSlidingLinks({ ...s.slidingLinks })
    setEdgeMm2(String(s.edgeMm2Eur))
    setEdgeMm05(String(s.edgeMm05Eur))
    setBillWholeSheets(s.billWholeSheets)
    setChipboardPrice(String(s.chipboardPriceEur))
    setHardboardPrice(String(s.hardboardPriceEur))
    setBillWholeHardboardSheets(s.billWholeHardboardSheets)
    setSkipCuttingEdgingLabor(s.skipCuttingEdgingLabor)
    setSkipBoardAndEdgeCost(s.skipBoardAndEdgeCost)
    setExternalDoors(s.externalDoors)
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
    setFrontFascia(String(s.installFrontFasciaMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.installFrontFasciaMinutes))
    setPrepareWallSides(String(s.prepareWallSidesMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.prepareWallSidesMinutes))
    setAssembleWallCarcass(String(s.assembleWallCarcassMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.assembleWallCarcassMinutes))
    setShelfPinPair(String(s.shelfPinPairMinutes))
    setShelfPinExtra(String(s.shelfPinExtraMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.shelfPinExtraMinutes))
    setShelfPinPairDeep(String(s.shelfPinPairDeepMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.shelfPinPairDeepMinutes))
    setShelfPinDeepMinDepth(String(s.shelfPinDeepMinDepthMm ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.shelfPinDeepMinDepthMm))
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
    setTopCornersSmall(String(s.topCornersSmallMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.topCornersSmallMinutes))
    setTopCornersMedium(String(s.topCornersMediumMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.topCornersMediumMinutes))
    setTopCornersLarge(String(s.topCornersLargeMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.topCornersLargeMinutes))
    setClothesConsole(String(s.clothesRailConsoleMinutes))
    setClothesCut(String(s.clothesRailCutMinutes))
    setClothesInstall(String(s.clothesRailInstallMinutes))
    setDrawerGuides(String(s.installDrawerGuidesMinutes))
    setDrawerGuidesDeep(String(s.installDrawerGuidesDeepMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.installDrawerGuidesDeepMinutes))
    setDrawerGuidesSoft(String(s.installDrawerGuidesSoftMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.installDrawerGuidesSoftMinutes))
    setDrawerGuideDeepMinHeight(String(s.drawerGuideDeepMinHeightMm ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.drawerGuideDeepMinHeightMm))
    setSoftGrooveFirst(String(s.softCloseGrooveFirstPairMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.softCloseGrooveFirstPairMinutes))
    setSoftGrooveExtra(String(s.softCloseGrooveExtraPairMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.softCloseGrooveExtraPairMinutes))
    setDrawerBox(String(s.assembleDrawerBoxMinutes))
    setDrawerBack(String(s.attachDrawerBackMinutes))
    setDrawerRunners(String(s.attachDrawerRunnersMinutes))
    setDrawerFront(String(s.installDrawerFrontMinutes))
    setFrontEdgeSmall(String(s.frontEdgeTakeSmallMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.frontEdgeTakeSmallMinutes))
    setFrontEdgeTall(String(s.frontEdgeTakeTallMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.frontEdgeTakeTallMinutes))
    setInstallDoorSmall(String(s.installDoorSmallMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.installDoorSmallMinutes))
    setInstallDoorTall(String(s.installDoorTallMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.installDoorTallMinutes))
    setTallDoorRouter(String(s.tallDoorRouterMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.tallDoorRouterMinutes))
    setTallDoorMinHeight(String(s.tallDoorMinHeightMm ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.tallDoorMinHeightMm))
    setInstallUpperTrack(String(s.installUpperTrackMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.installUpperTrackMinutes))
    setInstallLowerTrack(String(s.installLowerTrackMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.installLowerTrackMinutes))
    setInstallSlidingDoorHardware(
      String(s.installSlidingDoorHardwareMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.installSlidingDoorHardwareMinutes),
    )
    setSizeWidthSmall(String(s.widthSmallMaxMm ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.widthSmallMaxMm))
    setSizeWidthMedium(String(s.widthMediumMaxMm ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.widthMediumMaxMm))
    setSizeHeightSmall(String(s.heightSmallMaxMm ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.heightSmallMaxMm))
    setSizeHeightMedium(String(s.heightMediumMaxMm ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.heightMediumMaxMm))
    setSizeDepthSmall(String(s.depthSmallMaxMm ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.depthSmallMaxMm))
    setSizeDepthMedium(String(s.depthMediumMaxMm ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.depthMediumMaxMm))
    setPartitionMark(String(s.partitionMarkMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.partitionMarkMinutes))
    setFixedShelfMark(String(s.fixedShelfMarkMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.fixedShelfMarkMinutes))
    setPartitionDetailSmall(
      String(s.partitionDetailMarkSmallMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.partitionDetailMarkSmallMinutes),
    )
    setPartitionDetailMedium(
      String(s.partitionDetailMarkMediumMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.partitionDetailMarkMediumMinutes),
    )
    setPartitionDetailLarge(
      String(s.partitionDetailMarkLargeMinutes ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.partitionDetailMarkLargeMinutes),
    )
    setBackLargeMinHeight(String(s.backLargeMinHeightMm ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.backLargeMinHeightMm))
    setBackLargeMinWidth(String(s.backLargeMinWidthMm ?? DEFAULT_ASSEMBLY_TIME_SETTINGS.backLargeMinWidthMm))
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
      slidingHandleEurPerM: DEFAULT_HARDWARE_SETTINGS.slidingHandleEurPerM,
      slidingCapEurPerM: DEFAULT_HARDWARE_SETTINGS.slidingCapEurPerM,
      slidingUpperTrackEur: Object.fromEntries(
        SLIDING_TRACK_COLOR_IDS.map((id) => [
          id,
          parseFloat(slidingUpperTrack[id]) || DEFAULT_HARDWARE_SETTINGS.slidingUpperTrackEur[id],
        ]),
      ) as Record<SlidingTrackColor, number>,
      slidingLowerTrackEur: Object.fromEntries(
        SLIDING_TRACK_COLOR_IDS.map((id) => [
          id,
          parseFloat(slidingLowerTrack[id]) || DEFAULT_HARDWARE_SETTINGS.slidingLowerTrackEur[id],
        ]),
      ) as Record<SlidingTrackColor, number>,
      slidingMvp005KitEur: parseFloat(slidingMvp005Kit) || DEFAULT_HARDWARE_SETTINGS.slidingMvp005KitEur,
      slidingSoftCloseEur: parseFloat(slidingSoftClose) || DEFAULT_HARDWARE_SETTINGS.slidingSoftCloseEur,
      slidingHandleSkus: slidingHandleSkus.map((sku) => ({
        ...sku,
        priceEur: parseFloat(slidingHandlePrices[sku.id]) || sku.priceEur,
      })),
      slidingCapSkus: slidingCapSkus.map((sku) => ({
        ...sku,
        priceEur: parseFloat(slidingCapPrices[sku.id]) || sku.priceEur,
      })),
      slidingLinks: { ...slidingLinks },
      clothesRailEurPerM: parseFloat(clothesRailPrice) || DEFAULT_HARDWARE_SETTINGS.clothesRailEurPerM,
      edgeMm2Eur: parseFloat(edgeMm2) || DEFAULT_HARDWARE_SETTINGS.edgeMm2Eur,
      edgeMm05Eur: parseFloat(edgeMm05) || DEFAULT_HARDWARE_SETTINGS.edgeMm05Eur,
      billWholeSheets,
      chipboardPriceEur: parseFloat(chipboardPrice) || DEFAULT_HARDWARE_SETTINGS.chipboardPriceEur,
      hardboardPriceEur: parseFloat(hardboardPrice) || DEFAULT_HARDWARE_SETTINGS.hardboardPriceEur,
      billWholeHardboardSheets,
      skipCuttingEdgingLabor,
      skipBoardAndEdgeCost,
      externalDoors,
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
    const width = normalizeAxisLimits(
      parsePositiveMm(sizeWidthSmall, DEFAULT_ASSEMBLY_TIME_SETTINGS.widthSmallMaxMm),
      parsePositiveMm(sizeWidthMedium, DEFAULT_ASSEMBLY_TIME_SETTINGS.widthMediumMaxMm),
    )
    const height = normalizeAxisLimits(
      parsePositiveMm(sizeHeightSmall, DEFAULT_ASSEMBLY_TIME_SETTINGS.heightSmallMaxMm),
      parsePositiveMm(sizeHeightMedium, DEFAULT_ASSEMBLY_TIME_SETTINGS.heightMediumMaxMm),
    )
    const depth = normalizeAxisLimits(
      parsePositiveMm(sizeDepthSmall, DEFAULT_ASSEMBLY_TIME_SETTINGS.depthSmallMaxMm),
      parsePositiveMm(sizeDepthMedium, DEFAULT_ASSEMBLY_TIME_SETTINGS.depthMediumMaxMm),
    )
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
      installFrontFasciaMinutes: parseFloat(frontFascia) || DEFAULT_ASSEMBLY_TIME_SETTINGS.installFrontFasciaMinutes,
      prepareWallSidesMinutes: parseFloat(prepareWallSides) || DEFAULT_ASSEMBLY_TIME_SETTINGS.prepareWallSidesMinutes,
      assembleWallCarcassMinutes: parseFloat(assembleWallCarcass) || DEFAULT_ASSEMBLY_TIME_SETTINGS.assembleWallCarcassMinutes,
      shelfPinPairMinutes: parseFloat(shelfPinPair) || DEFAULT_ASSEMBLY_TIME_SETTINGS.shelfPinPairMinutes,
      shelfPinExtraMinutes: parseFloat(shelfPinExtra) || DEFAULT_ASSEMBLY_TIME_SETTINGS.shelfPinExtraMinutes,
      shelfPinPairDeepMinutes: parseFloat(shelfPinPairDeep) || DEFAULT_ASSEMBLY_TIME_SETTINGS.shelfPinPairDeepMinutes,
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
      topCornersSmallMinutes: parseFloat(topCornersSmall) || DEFAULT_ASSEMBLY_TIME_SETTINGS.topCornersSmallMinutes,
      topCornersMediumMinutes: parseFloat(topCornersMedium) || DEFAULT_ASSEMBLY_TIME_SETTINGS.topCornersMediumMinutes,
      topCornersLargeMinutes: parseFloat(topCornersLarge) || DEFAULT_ASSEMBLY_TIME_SETTINGS.topCornersLargeMinutes,
      clothesRailConsoleMinutes: parseFloat(clothesConsole) || DEFAULT_ASSEMBLY_TIME_SETTINGS.clothesRailConsoleMinutes,
      clothesRailCutMinutes: parseFloat(clothesCut) || DEFAULT_ASSEMBLY_TIME_SETTINGS.clothesRailCutMinutes,
      clothesRailInstallMinutes: parseFloat(clothesInstall) || DEFAULT_ASSEMBLY_TIME_SETTINGS.clothesRailInstallMinutes,
      installDrawerGuidesMinutes: parseFloat(drawerGuides) || DEFAULT_ASSEMBLY_TIME_SETTINGS.installDrawerGuidesMinutes,
      installDrawerGuidesDeepMinutes: parseFloat(drawerGuidesDeep) || DEFAULT_ASSEMBLY_TIME_SETTINGS.installDrawerGuidesDeepMinutes,
      installDrawerGuidesSoftMinutes: parseFloat(drawerGuidesSoft) || DEFAULT_ASSEMBLY_TIME_SETTINGS.installDrawerGuidesSoftMinutes,
      drawerGuideDeepMinHeightMm: parsePositiveMm(drawerGuideDeepMinHeight, DEFAULT_ASSEMBLY_TIME_SETTINGS.drawerGuideDeepMinHeightMm),
      softCloseGrooveFirstPairMinutes: parseFloat(softGrooveFirst) || DEFAULT_ASSEMBLY_TIME_SETTINGS.softCloseGrooveFirstPairMinutes,
      softCloseGrooveExtraPairMinutes: parseFloat(softGrooveExtra) || DEFAULT_ASSEMBLY_TIME_SETTINGS.softCloseGrooveExtraPairMinutes,
      assembleDrawerBoxMinutes: parseFloat(drawerBox) || DEFAULT_ASSEMBLY_TIME_SETTINGS.assembleDrawerBoxMinutes,
      attachDrawerBackMinutes: parseFloat(drawerBack) || DEFAULT_ASSEMBLY_TIME_SETTINGS.attachDrawerBackMinutes,
      attachDrawerRunnersMinutes: parseFloat(drawerRunners) || DEFAULT_ASSEMBLY_TIME_SETTINGS.attachDrawerRunnersMinutes,
      installDrawerFrontMinutes: parseFloat(drawerFront) || DEFAULT_ASSEMBLY_TIME_SETTINGS.installDrawerFrontMinutes,
      frontEdgeTakeSmallMinutes: parseFloat(frontEdgeSmall) || DEFAULT_ASSEMBLY_TIME_SETTINGS.frontEdgeTakeSmallMinutes,
      frontEdgeTakeTallMinutes: parseFloat(frontEdgeTall) || DEFAULT_ASSEMBLY_TIME_SETTINGS.frontEdgeTakeTallMinutes,
      installDoorSmallMinutes: parseFloat(installDoorSmall) || DEFAULT_ASSEMBLY_TIME_SETTINGS.installDoorSmallMinutes,
      installDoorTallMinutes: parseFloat(installDoorTall) || DEFAULT_ASSEMBLY_TIME_SETTINGS.installDoorTallMinutes,
      tallDoorRouterMinutes: parseFloat(tallDoorRouter) || DEFAULT_ASSEMBLY_TIME_SETTINGS.tallDoorRouterMinutes,
      tallDoorMinHeightMm: parsePositiveMm(tallDoorMinHeight, DEFAULT_ASSEMBLY_TIME_SETTINGS.tallDoorMinHeightMm),
      installUpperTrackMinutes: parseFloat(installUpperTrack) || DEFAULT_ASSEMBLY_TIME_SETTINGS.installUpperTrackMinutes,
      installLowerTrackMinutes: parseFloat(installLowerTrack) || DEFAULT_ASSEMBLY_TIME_SETTINGS.installLowerTrackMinutes,
      installSlidingDoorHardwareMinutes:
        parseFloat(installSlidingDoorHardware) || DEFAULT_ASSEMBLY_TIME_SETTINGS.installSlidingDoorHardwareMinutes,
      partitionMarkMinutes: parseFloat(partitionMark) || DEFAULT_ASSEMBLY_TIME_SETTINGS.partitionMarkMinutes,
      fixedShelfMarkMinutes: parseFloat(fixedShelfMark) || DEFAULT_ASSEMBLY_TIME_SETTINGS.fixedShelfMarkMinutes,
      partitionDetailMarkSmallMinutes:
        parseFloat(partitionDetailSmall) || DEFAULT_ASSEMBLY_TIME_SETTINGS.partitionDetailMarkSmallMinutes,
      partitionDetailMarkMediumMinutes:
        parseFloat(partitionDetailMedium) || DEFAULT_ASSEMBLY_TIME_SETTINGS.partitionDetailMarkMediumMinutes,
      partitionDetailMarkLargeMinutes:
        parseFloat(partitionDetailLarge) || DEFAULT_ASSEMBLY_TIME_SETTINGS.partitionDetailMarkLargeMinutes,
      widthSmallMaxMm: width.smallMaxMm,
      widthMediumMaxMm: width.mediumMaxMm,
      heightSmallMaxMm: height.smallMaxMm,
      heightMediumMaxMm: height.mediumMaxMm,
      depthSmallMaxMm: depth.smallMaxMm,
      depthMediumMaxMm: depth.mediumMaxMm,
      backLargeMinHeightMm: parsePositiveMm(backLargeMinHeight, DEFAULT_ASSEMBLY_TIME_SETTINGS.backLargeMinHeightMm),
      backLargeMinWidthMm: parsePositiveMm(backLargeMinWidth, DEFAULT_ASSEMBLY_TIME_SETTINGS.backLargeMinWidthMm),
      shelfPinDeepMinDepthMm: parsePositiveMm(shelfPinDeepMinDepth, DEFAULT_ASSEMBLY_TIME_SETTINGS.shelfPinDeepMinDepthMm),
    })
    onOpenChange(false)
  }
  
  const handleResetAssemblyTime = () => {
    applyAssemblyTimeSettings(onResetAssemblyTime())
  }

  const currentHinge = useNormal ? hingeNormal : hingeSoftClose
  const previewWidth = normalizeAxisLimits(
    parsePositiveMm(sizeWidthSmall, DEFAULT_ASSEMBLY_TIME_SETTINGS.widthSmallMaxMm),
    parsePositiveMm(sizeWidthMedium, DEFAULT_ASSEMBLY_TIME_SETTINGS.widthMediumMaxMm),
  )
  const previewHeight = normalizeAxisLimits(
    parsePositiveMm(sizeHeightSmall, DEFAULT_ASSEMBLY_TIME_SETTINGS.heightSmallMaxMm),
    parsePositiveMm(sizeHeightMedium, DEFAULT_ASSEMBLY_TIME_SETTINGS.heightMediumMaxMm),
  )
  const previewDepth = normalizeAxisLimits(
    parsePositiveMm(sizeDepthSmall, DEFAULT_ASSEMBLY_TIME_SETTINGS.depthSmallMaxMm),
    parsePositiveMm(sizeDepthMedium, DEFAULT_ASSEMBLY_TIME_SETTINGS.depthMediumMaxMm),
  )
  const previewExample = classifyCabinetSize(
    { width: 600, height: 720, depth: 560 },
    {
      ...DEFAULT_ASSEMBLY_TIME_SETTINGS,
      widthSmallMaxMm: previewWidth.smallMaxMm,
      widthMediumMaxMm: previewWidth.mediumMaxMm,
      heightSmallMaxMm: previewHeight.smallMaxMm,
      heightMediumMaxMm: previewHeight.mediumMaxMm,
      depthSmallMaxMm: previewDepth.smallMaxMm,
      depthMediumMaxMm: previewDepth.mediumMaxMm,
    },
  )
  const previewSizeText = `Пример 600 × 720 × 560 мм → ${formatCabinetSizeBreakdown(previewExample)} (${previewExample.score} т.)`
  const previewBackHeight = parsePositiveMm(backLargeMinHeight, DEFAULT_ASSEMBLY_TIME_SETTINGS.backLargeMinHeightMm)
  const previewBackWidth = parsePositiveMm(backLargeMinWidth, DEFAULT_ASSEMBLY_TIME_SETTINGS.backLargeMinWidthMm)
  const previewShelfPinDepth = parsePositiveMm(shelfPinDeepMinDepth, DEFAULT_ASSEMBLY_TIME_SETTINGS.shelfPinDeepMinDepthMm)
  const previewDrawerGuideHeight = parsePositiveMm(drawerGuideDeepMinHeight, DEFAULT_ASSEMBLY_TIME_SETTINGS.drawerGuideDeepMinHeightMm)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Настройки
          </DialogTitle>
          <DialogDescription>
            {signedIn
              ? 'Настройките се пазят в акаунта ти и се дърпат при вход. Копие остава и на това устройство.'
              : 'Без вход настройките се пазят само на това устройство. След вход се записват в акаунта.'}
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
            <div className="rounded-md border border-[var(--color-border)] p-4 sm:col-span-2">
              <h3 className="mb-1 font-medium">Плъзгащи врати (гардероб)</h3>
              <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
                Релсите и профилите се продават на цели пръти — в сметката влиза цялата цена, дори да се отреже.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">Горна релса 3 м (€)</p>
                  <div className="space-y-2">
                    {SLIDING_TRACK_COLOR_IDS.map((id) => (
                      <div key={`u-${id}`} className="grid grid-cols-[7rem_1fr] items-center gap-2">
                        <Label htmlFor={`upper-track-${id}`}>{SLIDING_TRACK_COLOR_LABELS[id]}</Label>
                        <Input
                          id={`upper-track-${id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={slidingUpperTrack[id]}
                          onChange={(e) => setSlidingUpperTrack((prev) => ({ ...prev, [id]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Долна релса 3 м (€)</p>
                  <div className="space-y-2">
                    {SLIDING_TRACK_COLOR_IDS.map((id) => (
                      <div key={`l-${id}`} className="grid grid-cols-[7rem_1fr] items-center gap-2">
                        <Label htmlFor={`lower-track-${id}`}>{SLIDING_TRACK_COLOR_LABELS[id]}</Label>
                        <Input
                          id={`lower-track-${id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={slidingLowerTrack[id]}
                          onChange={(e) => setSlidingLowerTrack((prev) => ({ ...prev, [id]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="mvp005-kit">Механизъм MVP-005 (€ / врата)</Label>
                  <Input
                    id="mvp005-kit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={slidingMvp005Kit}
                    onChange={(e) => setSlidingMvp005Kit(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    2 горни + 2 долни ролки. На гардероб с 2 врати — 2 комплекта.
                  </p>
                </div>
                <div>
                  <Label htmlFor="sliding-soft-close">Плавно прибиране (€ / бр.)</Label>
                  <Input
                    id="sliding-soft-close"
                    type="number"
                    step="0.01"
                    min="0"
                    value={slidingSoftClose}
                    onChange={(e) => setSlidingSoftClose(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <p className="mb-2 text-sm font-medium">Кант дръжка D1L (€ / прът)</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[var(--color-muted-foreground)]">
                      <th className="py-1 pr-2 font-medium">Код</th>
                      <th className="py-1 pr-2 font-medium">Цвят</th>
                      <th className="py-1 pr-2 font-medium">Дължина</th>
                      <th className="py-1 font-medium">Цена €</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slidingHandleSkus.map((sku) => (
                      <tr key={sku.id} className="border-t border-[var(--color-border)]">
                        <td className="py-1 pr-2">{sku.code}</td>
                        <td className="py-1 pr-2">{sku.color}</td>
                        <td className="py-1 pr-2">{sku.lengthMm} мм</td>
                        <td className="py-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={slidingHandlePrices[sku.id] ?? String(sku.priceEur)}
                            onChange={(e) =>
                              setSlidingHandlePrices((prev) => ({ ...prev, [sku.id]: e.target.value }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 overflow-x-auto">
                <p className="mb-2 text-sm font-medium">Профил D2 18 мм (€ / прът)</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[var(--color-muted-foreground)]">
                      <th className="py-1 pr-2 font-medium">Код</th>
                      <th className="py-1 pr-2 font-medium">Цвят</th>
                      <th className="py-1 pr-2 font-medium">Дължина</th>
                      <th className="py-1 font-medium">Цена €</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slidingCapSkus.map((sku) => (
                      <tr key={sku.id} className="border-t border-[var(--color-border)]">
                        <td className="py-1 pr-2">{sku.code}</td>
                        <td className="py-1 pr-2">{sku.color}</td>
                        <td className="py-1 pr-2">{sku.lengthMm} мм</td>
                        <td className="py-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={slidingCapPrices[sku.id] ?? String(sku.priceEur)}
                            onChange={(e) =>
                              setSlidingCapPrices((prev) => ({ ...prev, [sku.id]: e.target.value }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Линкове</p>
                {(
                  [
                    ['d1Handle', 'Кант дръжка D1L'],
                    ['d2Profile', 'Профил D2 18 мм'],
                    ['mvp005System', 'Система MVP-005 (релси)'],
                    ['mvp005Mechanism', 'Механизъм MVP-005'],
                    ['softClose', 'Плавно прибиране'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <Label htmlFor={`sliding-link-${key}`}>{label}</Label>
                    <Input
                      id={`sliding-link-${key}`}
                      type="url"
                      value={slidingLinks[key]}
                      onChange={(e) => setSlidingLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
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
              <div className="space-y-4">
                <div>
                  <Label htmlFor="chipboard-price">Цена на ПДЧ (€/плоча)</Label>
                  <Input
                    id="chipboard-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={chipboardPrice}
                    onChange={(e) => setChipboardPrice(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    Стандартен размер ПДЧ: 2780 × 2040 мм
                  </p>
                </div>
                <div>
                  <Label htmlFor="hardboard-price">Цена на фазер (€/плоча)</Label>
                  <Input
                    id="hardboard-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={hardboardPrice}
                    onChange={(e) => setHardboardPrice(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    Стандартен размер фазер: 2800 × 2070 мм, 3 мм дебелина
                  </p>
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={billWholeSheets}
                    onCheckedChange={(c) => setBillWholeSheets(c === true)}
                  />
                  <span>
                    Цена за цели закупени плочи ПДЧ
                    <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
                      Ако отидат 3,5 плочи, сметката е за 4 — толкова трябва да се купят. Без отметка се
                      брои само изразходваната част.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={billWholeHardboardSheets}
                    onCheckedChange={(c) => setBillWholeHardboardSheets(c === true)}
                  />
                  <span>
                    Цена за цели закупени плочи фазер
                    <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
                      Ако отидат 3,5 плочи, сметката е за 4 — толкова трябва да се купят. Без отметка се
                      брои само изразходваната част.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={skipCuttingEdgingLabor || skipBoardAndEdgeCost}
                    disabled={skipBoardAndEdgeCost}
                    onCheckedChange={(c) => setSkipCuttingEdgingLabor(c === true)}
                  />
                  <span>
                    Без труд за рязане и кантиране
                    <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
                      Рязането, машинното кантиране и обработката на кант не влизат в цената. Остава
                      сглобяването.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={skipBoardAndEdgeCost}
                    onCheckedChange={(c) => setSkipBoardAndEdgeCost(c === true)}
                  />
                  <span>
                    Без цена на плочи и кант
                    <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
                      ПДЧ, фазер, кант и трудът за рязане и кантиране не влизат в сметката.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={externalDoors}
                    onCheckedChange={(c) => setExternalDoors(c === true)}
                  />
                  <span>
                    Външни врати и чела
                    <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
                      Поръчват се отделно: само фуги, без кант, без разкрой. Без ръбчета и фреза —
                      остава пробиване на панти и слагане на чело. Може и по шкаф при създаване.
                    </span>
                  </span>
                </label>
              </div>
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
                <h3 className="mb-3 font-medium">Размер на шкафа</h3>
                <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
                  Малък, среден и голям се смятат по широчина, височина и дълбочина заедно. Времената за
                  цокъл, страници и плот ползват общия размер. {cabinetSizeScoringHelp()}
                </p>
                <div className="space-y-4">
                  <SizeAxisFields
                    id="size-width"
                    title="Широчина"
                    smallValue={sizeWidthSmall}
                    mediumValue={sizeWidthMedium}
                    onSmallChange={setSizeWidthSmall}
                    onMediumChange={setSizeWidthMedium}
                  />
                  <SizeAxisFields
                    id="size-height"
                    title="Височина"
                    smallValue={sizeHeightSmall}
                    mediumValue={sizeHeightMedium}
                    onSmallChange={setSizeHeightSmall}
                    onMediumChange={setSizeHeightMedium}
                  />
                  <SizeAxisFields
                    id="size-depth"
                    title="Дълбочина"
                    smallValue={sizeDepthSmall}
                    mediumValue={sizeDepthMedium}
                    onSmallChange={setSizeDepthSmall}
                    onMediumChange={setSizeDepthMedium}
                  />
                </div>
                <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">{previewSizeText}</p>
              </div>

              <div className="rounded-md border border-[var(--color-border)] p-4">
                <h3 className="mb-3 font-medium">Начертаване</h3>
                <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
                  Отделно от сглобяването. Всяка разделителна страница се чертае на дъното и на плота (или
                  блендите). Ако има разделители, операции като рафтоносачи, водачи и лост получават допълнително
                  време × броя страници според размера на шкафа (30 сек / 1 мин / 1 мин 30 сек).
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="partition-mark">Разделителна страница на дъното или плота (минути)</Label>
                    <Input
                      id="partition-mark"
                      type="number"
                      step="0.5"
                      min="0"
                      value={partitionMark}
                      onChange={(e) => setPartitionMark(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="fixed-shelf-mark">Фиксиран рафт (минути)</Label>
                    <Input
                      id="fixed-shelf-mark"
                      type="number"
                      step="0.5"
                      min="0"
                      value={fixedShelfMark}
                      onChange={(e) => setFixedShelfMark(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="partition-detail-small">Допълнително на операция — малък</Label>
                    <Input
                      id="partition-detail-small"
                      type="number"
                      step="0.5"
                      min="0"
                      value={partitionDetailSmall}
                      onChange={(e) => setPartitionDetailSmall(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="partition-detail-medium">Допълнително на операция — среден</Label>
                    <Input
                      id="partition-detail-medium"
                      type="number"
                      step="0.5"
                      min="0"
                      value={partitionDetailMedium}
                      onChange={(e) => setPartitionDetailMedium(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="partition-detail-large">Допълнително на операция — голям</Label>
                    <Input
                      id="partition-detail-large"
                      type="number"
                      step="0.5"
                      min="0"
                      value={partitionDetailLarge}
                      onChange={(e) => setPartitionDetailLarge(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-[var(--color-border)] p-4">
                <h3 className="mb-3 font-medium">Сглобяване на корпус</h3>
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
                  <div>
                    <Label htmlFor="front-fascia">Бленда надолу за мивка (минути)</Label>
                    <Input
                      id="front-fascia"
                      type="number"
                      step="0.5"
                      min="0"
                      value={frontFascia}
                      onChange={(e) => setFrontFascia(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Една бленда на долен шкаф за мивка. При повече колони — по толкова на бленда.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="prepare-wall-sides">Приготвяне на страниците — горен шкаф (минути)</Label>
                    <Input
                      id="prepare-wall-sides"
                      type="number"
                      step="0.5"
                      min="0"
                      value={prepareWallSides}
                      onChange={(e) => setPrepareWallSides(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Подготовка на двете страници преди сглобяване на корпуса.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="assemble-wall-carcass">Страници с плота и дъното — горен шкаф (минути)</Label>
                    <Input
                      id="assemble-wall-carcass"
                      type="number"
                      step="0.5"
                      min="0"
                      value={assembleWallCarcass}
                      onChange={(e) => setAssembleWallCarcass(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Сглобяване на страниците с плота и дъното на горен шкаф.
                    </p>
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
                  <div>
                    <Label htmlFor="top-corners-small">Плот с ъгълчета — малък</Label>
                    <Input id="top-corners-small" type="number" step="0.5" min="0" value={topCornersSmall} onChange={(e) => setTopCornersSmall(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="top-corners-medium">Плот с ъгълчета — среден</Label>
                    <Input id="top-corners-medium" type="number" step="0.5" min="0" value={topCornersMedium} onChange={(e) => setTopCornersMedium(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="top-corners-large">Плот с ъгълчета — голям</Label>
                    <Input id="top-corners-large" type="number" step="0.5" min="0" value={topCornersLarge} onChange={(e) => setTopCornersLarge(e.target.value)} />
                  </div>
                </div>
                <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
                  Вътрешен плот (секция) ползва „Плот“. Външен плот върху страниците с ъгълчета отвътре — по 1 мин повече.
                </p>
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
                  </div>
                  <div>
                    <Label htmlFor="back-large-min-height">Голям гръб — мин. височина (мм)</Label>
                    <Input
                      id="back-large-min-height"
                      type="number"
                      step="1"
                      min="1"
                      value={backLargeMinHeight}
                      onChange={(e) => setBackLargeMinHeight(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="back-large-min-width">Голям гръб — мин. широчина (мм)</Label>
                    <Input
                      id="back-large-min-width"
                      type="number"
                      step="1"
                      min="1"
                      value={backLargeMinWidth}
                      onChange={(e) => setBackLargeMinWidth(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Голям гръб: над {previewBackHeight} мм висок и над {previewBackWidth} мм широк.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="shelf-pin-pair">Рафтоносачи — първи рафт (минути)</Label>
                    <Input id="shelf-pin-pair" type="number" step="0.5" min="0" value={shelfPinPair} onChange={(e) => setShelfPinPair(e.target.value)} />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      На 1 шкаф, при дълбочина до {previewShelfPinDepth} мм. 4 рафтоносача на рафт.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="shelf-pin-extra">Рафтоносачи — всеки следващ (минути)</Label>
                    <Input id="shelf-pin-extra" type="number" step="0.5" min="0" value={shelfPinExtra} onChange={(e) => setShelfPinExtra(e.target.value)} />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Същият шкаф, всеки следващ рафт. И при дълбок шкаф.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="shelf-pin-pair-deep">Рафтоносачи — дълбок, първи рафт (минути)</Label>
                    <Input id="shelf-pin-pair-deep" type="number" step="0.5" min="0" value={shelfPinPairDeep} onChange={(e) => setShelfPinPairDeep(e.target.value)} />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      При дълбочина над {previewShelfPinDepth} мм. Следващите пак по горното време.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="shelf-pin-deep-min">Дълбок шкаф — над (мм)</Label>
                    <Input
                      id="shelf-pin-deep-min"
                      type="number"
                      step="1"
                      min="1"
                      value={shelfPinDeepMinDepth}
                      onChange={(e) => setShelfPinDeepMinDepth(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Над {previewShelfPinDepth} мм дълбочина се ползва по-дългото време за рафтоносачи. Водачите имат и условие за височина.
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
                    <Label htmlFor="drawer-guides">Водачи на страниците (минути)</Label>
                    <Input
                      id="drawer-guides"
                      type="number"
                      step="0.5"
                      min="0"
                      value={drawerGuides}
                      onChange={(e) => setDrawerGuides(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      За 1 чекмедже. И при дълбочина над {previewShelfPinDepth} мм, ако височината е под {previewDrawerGuideHeight} мм.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="drawer-guides-deep">Водачи — дълбок шкаф (минути)</Label>
                    <Input
                      id="drawer-guides-deep"
                      type="number"
                      step="0.5"
                      min="0"
                      value={drawerGuidesDeep}
                      onChange={(e) => setDrawerGuidesDeep(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Дълбочина над {previewShelfPinDepth} мм и височина от {previewDrawerGuideHeight} мм нагоре.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="drawer-guides-soft">Водачи — плавно прибиране (минути)</Label>
                    <Input
                      id="drawer-guides-soft"
                      type="number"
                      step="0.5"
                      min="0"
                      value={drawerGuidesSoft}
                      onChange={(e) => setDrawerGuidesSoft(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      За 1 чекмедже с плавно прибиране, вместо малко/дълбоко.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="soft-groove-first">Канал на високите царги — първи чифт (минути)</Label>
                    <Input
                      id="soft-groove-first"
                      type="number"
                      step="0.5"
                      min="0"
                      value={softGrooveFirst}
                      onChange={(e) => setSoftGrooveFirst(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      За целия проект. Първите 2 по-високи царги (1 чекмедже).
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="soft-groove-extra">Канал — всеки следващ чифт (минути)</Label>
                    <Input
                      id="soft-groove-extra"
                      type="number"
                      step="0.5"
                      min="0"
                      value={softGrooveExtra}
                      onChange={(e) => setSoftGrooveExtra(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Същият проект, не на шкаф. 4 чекмеджета = {parseFloat(softGrooveFirst) || 10} + 3×{parseFloat(softGrooveExtra) || 1} мин.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="drawer-guide-deep-min-height">Водачи — мин. височина (мм)</Label>
                    <Input
                      id="drawer-guide-deep-min-height"
                      type="number"
                      step="1"
                      min="1"
                      value={drawerGuideDeepMinHeight}
                      onChange={(e) => setDrawerGuideDeepMinHeight(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Дълбок над {previewShelfPinDepth} мм, но висок под {previewDrawerGuideHeight} мм, все още се брои за малък.
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
                      Включва пробиване на дупки, слагане на челото и регулация на фугите. Взимането на 4 ръбчета е отделно, при вратите.
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
                  <strong>Общо време за 1 чекмедже:</strong> {' '}
                  {(
                    (parseFloat(drawerBox) || 0) +
                    (parseFloat(drawerBack) || 0) +
                    (parseFloat(drawerRunners) || 0) +
                    (parseFloat(drawerFront) || 0) +
                    (parseFloat(frontEdgeSmall) || 0)
                  ).toFixed(1)} минути
                  <span className="block mt-1">Включва 4 ръбчета на челото ({parseFloat(frontEdgeSmall) || 0} мин).</span>
                </p>
              </div>

              <div className="rounded-md border border-[var(--color-border)] p-4">
                <h3 className="mb-3 font-medium">Врати и чела</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="front-edge-small">4 ръбчета — малка врата/чело (минути)</Label>
                    <Input
                      id="front-edge-small"
                      type="number"
                      step="0.1"
                      min="0"
                      value={frontEdgeSmall}
                      onChange={(e) => setFrontEdgeSmall(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Взимане на 4 ръбчета. Чело и врата до {parsePositiveMm(tallDoorMinHeight, DEFAULT_ASSEMBLY_TIME_SETTINGS.tallDoorMinHeightMm)} мм.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="front-edge-tall">4 ръбчета — висока врата (минути)</Label>
                    <Input
                      id="front-edge-tall"
                      type="number"
                      step="0.1"
                      min="0"
                      value={frontEdgeTall}
                      onChange={(e) => setFrontEdgeTall(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Над {parsePositiveMm(tallDoorMinHeight, DEFAULT_ASSEMBLY_TIME_SETTINGS.tallDoorMinHeightMm)} мм. Стандартно 1 мин 30 сек.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="install-door-small">Панти и слагане — малка врата (минути)</Label>
                    <Input
                      id="install-door-small"
                      type="number"
                      step="0.5"
                      min="0"
                      value={installDoorSmall}
                      onChange={(e) => setInstallDoorSmall(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Пробиване за панти и слагане на вратата.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="install-door-tall">Панти и слагане — висока врата (минути)</Label>
                    <Input
                      id="install-door-tall"
                      type="number"
                      step="0.5"
                      min="0"
                      value={installDoorTall}
                      onChange={(e) => setInstallDoorTall(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Същото за врата над {parsePositiveMm(tallDoorMinHeight, DEFAULT_ASSEMBLY_TIME_SETTINGS.tallDoorMinHeightMm)} мм.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="tall-door-router">Висока врата — фреза на канта (минути)</Label>
                    <Input
                      id="tall-door-router"
                      type="number"
                      step="0.5"
                      min="0"
                      value={tallDoorRouter}
                      onChange={(e) => setTallDoorRouter(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Допълнително на врата, когато готовата е над {parsePositiveMm(tallDoorMinHeight, DEFAULT_ASSEMBLY_TIME_SETTINGS.tallDoorMinHeightMm)} мм.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="tall-door-min-height">Висока врата — над (мм)</Label>
                    <Input
                      id="tall-door-min-height"
                      type="number"
                      step="1"
                      min="1"
                      value={tallDoorMinHeight}
                      onChange={(e) => setTallDoorMinHeight(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Готовата врата с кант. Оправяне на канта с фреза и по-дългите стъпки.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-[var(--color-border)] p-4">
                <h3 className="mb-3 font-medium">Плъзгащи врати</h3>
                <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
                  Горна и долна релса по веднъж на гардероб. Кант дръжки + плавно прибиране — на врата.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="install-upper-track">Горна релса (минути)</Label>
                    <Input
                      id="install-upper-track"
                      type="number"
                      step="0.5"
                      min="0"
                      value={installUpperTrack}
                      onChange={(e) => setInstallUpperTrack(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="install-lower-track">Долна релса (минути)</Label>
                    <Input
                      id="install-lower-track"
                      type="number"
                      step="0.5"
                      min="0"
                      value={installLowerTrack}
                      onChange={(e) => setInstallLowerTrack(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="install-sliding-door-hw">Кант дръжки и плавно прибиране (минути / врата)</Label>
                    <Input
                      id="install-sliding-door-hw"
                      type="number"
                      step="0.5"
                      min="0"
                      value={installSlidingDoorHardware}
                      onChange={(e) => setInstallSlidingDoorHardware(e.target.value)}
                    />
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
