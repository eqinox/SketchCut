/**
 * Assembly time calculation settings and functions.
 * All time values are in minutes unless otherwise specified.
 */

export interface EdgeBandingTimeSettings {
  /** Time per thin edge for parts up to 50cm long (seconds) */
  thinEdgeUpTo50cm: number
  /** Time per thin edge for parts up to 100cm long (seconds) */
  thinEdgeUpTo100cm: number
  /** Time per thin edge for parts up to 150cm long (seconds) */
  thinEdgeUpTo150cm: number
  /** Additional time per 50cm beyond 150cm (seconds) */
  thinEdgeAdditionalPer50cm: number
}

/** Back is „голям“ when height and width both exceed these. */
export const BACK_LARGE_MIN_HEIGHT_MM = 1000
export const BACK_LARGE_MIN_WIDTH_MM = 500

/** Inclusive upper bound for a small width (mm). */
export const SIZE_WIDTH_SMALL_MAX_MM = 500
/** Inclusive upper bound for a medium width (mm). Wider is large. */
export const SIZE_WIDTH_MEDIUM_MAX_MM = 700
export const SIZE_HEIGHT_SMALL_MAX_MM = 800
export const SIZE_HEIGHT_MEDIUM_MAX_MM = 1600
export const SIZE_DEPTH_SMALL_MAX_MM = 450
export const SIZE_DEPTH_MEDIUM_MAX_MM = 700

/** One large axis or two medium axes. */
export const SIZE_SCORE_MEDIUM_MIN = 2
/** Two large axes, or one large + two medium. */
export const SIZE_SCORE_LARGE_MIN = 4

export type CarcassSizeTier = 'small' | 'medium' | 'large'

export interface CabinetSizeLimits {
  widthSmallMaxMm: number
  widthMediumMaxMm: number
  heightSmallMaxMm: number
  heightMediumMaxMm: number
  depthSmallMaxMm: number
  depthMediumMaxMm: number
  backLargeMinHeightMm: number
  backLargeMinWidthMm: number
}

export const DEFAULT_CABINET_SIZE_LIMITS: CabinetSizeLimits = {
  widthSmallMaxMm: SIZE_WIDTH_SMALL_MAX_MM,
  widthMediumMaxMm: SIZE_WIDTH_MEDIUM_MAX_MM,
  heightSmallMaxMm: SIZE_HEIGHT_SMALL_MAX_MM,
  heightMediumMaxMm: SIZE_HEIGHT_MEDIUM_MAX_MM,
  depthSmallMaxMm: SIZE_DEPTH_SMALL_MAX_MM,
  depthMediumMaxMm: SIZE_DEPTH_MEDIUM_MAX_MM,
  backLargeMinHeightMm: BACK_LARGE_MIN_HEIGHT_MM,
  backLargeMinWidthMm: BACK_LARGE_MIN_WIDTH_MM,
}

export interface CabinetSizeAxes {
  width: CarcassSizeTier
  height: CarcassSizeTier
  depth: CarcassSizeTier
}

export interface ClassifiedCabinetSize {
  tier: CarcassSizeTier
  score: number
  axes: CabinetSizeAxes
}

/** Keep the medium ceiling strictly above the small ceiling. */
export function normalizeAxisLimits(smallMaxMm: number, mediumMaxMm: number): {
  smallMaxMm: number
  mediumMaxMm: number
} {
  const small = Math.max(1, Math.round(smallMaxMm))
  const medium = Math.max(small + 1, Math.round(mediumMaxMm))
  return { smallMaxMm: small, mediumMaxMm: medium }
}

export function axisSizeTier(valueMm: number, smallMaxMm: number, mediumMaxMm: number): CarcassSizeTier {
  const { smallMaxMm: small, mediumMaxMm: medium } = normalizeAxisLimits(
    smallMaxMm > 0 ? smallMaxMm : 1,
    mediumMaxMm > 0 ? mediumMaxMm : 2,
  )
  if (valueMm <= small) return 'small'
  if (valueMm <= medium) return 'medium'
  return 'large'
}

export function sizeTierScore(tier: CarcassSizeTier): number {
  if (tier === 'large') return 2
  if (tier === 'medium') return 1
  return 0
}

export function sizeTierFromScore(score: number): CarcassSizeTier {
  if (score >= SIZE_SCORE_LARGE_MIN) return 'large'
  if (score >= SIZE_SCORE_MEDIUM_MIN) return 'medium'
  return 'small'
}

function resolvedSizeLimits(limits?: CabinetSizeLimits | null): CabinetSizeLimits {
  const d = DEFAULT_CABINET_SIZE_LIMITS
  const width = normalizeAxisLimits(limits?.widthSmallMaxMm ?? d.widthSmallMaxMm, limits?.widthMediumMaxMm ?? d.widthMediumMaxMm)
  const height = normalizeAxisLimits(limits?.heightSmallMaxMm ?? d.heightSmallMaxMm, limits?.heightMediumMaxMm ?? d.heightMediumMaxMm)
  const depth = normalizeAxisLimits(limits?.depthSmallMaxMm ?? d.depthSmallMaxMm, limits?.depthMediumMaxMm ?? d.depthMediumMaxMm)
  return {
    widthSmallMaxMm: width.smallMaxMm,
    widthMediumMaxMm: width.mediumMaxMm,
    heightSmallMaxMm: height.smallMaxMm,
    heightMediumMaxMm: height.mediumMaxMm,
    depthSmallMaxMm: depth.smallMaxMm,
    depthMediumMaxMm: depth.mediumMaxMm,
    backLargeMinHeightMm: limits?.backLargeMinHeightMm ?? d.backLargeMinHeightMm,
    backLargeMinWidthMm: limits?.backLargeMinWidthMm ?? d.backLargeMinWidthMm,
  }
}

export function classifyCabinetSize(
  dims: { width: number; height: number; depth: number },
  limits?: CabinetSizeLimits | null,
): ClassifiedCabinetSize {
  const l = resolvedSizeLimits(limits)
  const axes: CabinetSizeAxes = {
    width: axisSizeTier(dims.width, l.widthSmallMaxMm, l.widthMediumMaxMm),
    height: axisSizeTier(dims.height, l.heightSmallMaxMm, l.heightMediumMaxMm),
    depth: axisSizeTier(dims.depth, l.depthSmallMaxMm, l.depthMediumMaxMm),
  }
  const score = sizeTierScore(axes.width) + sizeTierScore(axes.height) + sizeTierScore(axes.depth)
  return { tier: sizeTierFromScore(score), score, axes }
}

export function carcassSizeTier(
  dims: { width: number; height: number; depth: number },
  limits?: CabinetSizeLimits | null,
): CarcassSizeTier {
  return classifyCabinetSize(dims, limits).tier
}

export function isLargeBack(
  widthMm: number,
  heightMm: number,
  limits?: Pick<CabinetSizeLimits, 'backLargeMinHeightMm' | 'backLargeMinWidthMm'> | null,
): boolean {
  const minHeight = limits?.backLargeMinHeightMm ?? BACK_LARGE_MIN_HEIGHT_MM
  const minWidth = limits?.backLargeMinWidthMm ?? BACK_LARGE_MIN_WIDTH_MM
  return heightMm > minHeight && widthMm > minWidth
}

const AXIS_TIER_FEMININE: Record<CarcassSizeTier, string> = {
  small: 'малка',
  medium: 'средна',
  large: 'голяма',
}

const OVERALL_TIER_BG: Record<CarcassSizeTier, string> = {
  small: 'малък',
  medium: 'среден',
  large: 'голям',
}

export function cabinetSizeAxisDefinitionText(smallMaxMm: number, mediumMaxMm: number): string {
  const { smallMaxMm: small, mediumMaxMm: medium } = normalizeAxisLimits(smallMaxMm, mediumMaxMm)
  return `Малък: до ${small} мм. Среден: ${small + 1}–${medium} мм. Голям: над ${medium} мм.`
}

export function cabinetSizeScoringHelp(): string {
  return (
    `Всяка ос е малка (0 т.), средна (1 т.) или голяма (2 т.). ` +
    `Сбор: 0–1 малък шкаф, ${SIZE_SCORE_MEDIUM_MIN}–${SIZE_SCORE_LARGE_MIN - 1} среден, ${SIZE_SCORE_LARGE_MIN}–6 голям.`
  )
}

export function formatCabinetSizeBreakdown(classified: ClassifiedCabinetSize): string {
  const overall = OVERALL_TIER_BG[classified.tier]
  const w = AXIS_TIER_FEMININE[classified.axes.width]
  const h = AXIS_TIER_FEMININE[classified.axes.height]
  const d = AXIS_TIER_FEMININE[classified.axes.depth]
  return `${overall} · Ш ${w} · В ${h} · Д ${d}`
}

export function cabinetSizeTierLabel(tier: CarcassSizeTier): string {
  if (tier === 'small') return 'Малък'
  if (tier === 'medium') return 'Среден'
  return 'Голям'
}

export function cabinetSizeExplainLines(
  dims: { width: number; height: number; depth: number },
  classified: ClassifiedCabinetSize,
): string[] {
  return [
    `Широчина ${dims.width} мм — ${AXIS_TIER_FEMININE[classified.axes.width]}`,
    `Височина ${dims.height} мм — ${AXIS_TIER_FEMININE[classified.axes.height]}`,
    `Дълбочина ${dims.depth} мм — ${AXIS_TIER_FEMININE[classified.axes.depth]}`,
    `Сбор ${classified.score} т.`,
  ]
}

function pickTier<T>(tier: CarcassSizeTier, small: T, medium: T, large: T): T {
  if (tier === 'large') return large
  if (tier === 'medium') return medium
  return small
}

export interface AssemblyTimeSettings {
  /** Edge banding processing time settings */
  edgeBanding: EdgeBandingTimeSettings
  
  /** Time to install 4 legs on bottom panel (minutes) */
  installLegsMinutes: number
  
  /** Time to assemble top 2 plinths/rails (minutes) — kitchen бленди */
  assembleTopRailsMinutes: number

  /** Minutes to install the 4 shelf pins of one shelf. */
  shelfPinPairMinutes: number

  backSmallMinutes: number
  backLargeMinutes: number

  plinthSmallMinutes: number
  plinthMediumMinutes: number
  plinthLargeMinutes: number

  sidesToBottomSmallMinutes: number
  sidesToBottomMediumMinutes: number
  sidesToBottomLargeMinutes: number

  topSmallMinutes: number
  topMediumMinutes: number
  topLargeMinutes: number

  clothesRailConsoleMinutes: number
  clothesRailCutMinutes: number
  clothesRailInstallMinutes: number
  
  /** Time to install guides on one drawer (minutes per guide pair) */
  installDrawerGuidesMinutes: number
  
  /** Time to assemble the drawer box itself (minutes) */
  assembleDrawerBoxMinutes: number
  
  /** Time to attach back panel to drawer (minutes) */
  attachDrawerBackMinutes: number
  
  /** Time to attach drawer guides/runners (minutes) */
  attachDrawerRunnersMinutes: number
  
  /** Time to install drawer front - drilling, attaching, adjusting gaps (minutes) */
  installDrawerFrontMinutes: number
  
  /** Time to install one door - cleaning, measuring, drilling for hinges, installing (minutes) */
  installDoorMinutes: number

  widthSmallMaxMm: number
  widthMediumMaxMm: number
  heightSmallMaxMm: number
  heightMediumMaxMm: number
  depthSmallMaxMm: number
  depthMediumMaxMm: number
  /** Back is large when taller than this (mm). */
  backLargeMinHeightMm: number
  /** Back is large when wider than this (mm). */
  backLargeMinWidthMm: number
}

export const DEFAULT_ASSEMBLY_TIME_SETTINGS: AssemblyTimeSettings = {
  edgeBanding: {
    thinEdgeUpTo50cm: 30,
    thinEdgeUpTo100cm: 60,
    thinEdgeUpTo150cm: 90,
    thinEdgeAdditionalPer50cm: 30,
  },
  installLegsMinutes: 6,
  assembleTopRailsMinutes: 10,
  shelfPinPairMinutes: 3,
  backSmallMinutes: 6,
  backLargeMinutes: 10,
  plinthSmallMinutes: 7,
  plinthMediumMinutes: 10,
  plinthLargeMinutes: 13,
  sidesToBottomSmallMinutes: 6,
  sidesToBottomMediumMinutes: 10,
  sidesToBottomLargeMinutes: 14,
  topSmallMinutes: 4,
  topMediumMinutes: 7,
  topLargeMinutes: 9,
  clothesRailConsoleMinutes: 5,
  clothesRailCutMinutes: 10,
  clothesRailInstallMinutes: 2,
  installDrawerGuidesMinutes: 6,
  assembleDrawerBoxMinutes: 7,
  attachDrawerBackMinutes: 4,
  attachDrawerRunnersMinutes: 4,
  installDrawerFrontMinutes: 15,
  installDoorMinutes: 15,
  ...DEFAULT_CABINET_SIZE_LIMITS,
}

const ASSEMBLY_TIME_SETTINGS_KEY = 'sketchcut-assembly-time-settings'

function numPositive(src: Record<string, unknown>, key: string, fallback: number): number {
  const v = src[key]
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback
}

function numMm(src: Record<string, unknown>, key: string, fallback: number): number {
  const v = src[key]
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : fallback
}

function parseAxisLimits(
  src: Record<string, unknown>,
  smallKey: string,
  mediumKey: string,
  fallbackSmall: number,
  fallbackMedium: number,
  previousDefaultSmall: number,
  previousDefaultMedium: number,
) {
  const storedSmall = src[smallKey]
  const storedMedium = src[mediumKey]
  const hasStored =
    typeof storedSmall === 'number' &&
    Number.isFinite(storedSmall) &&
    storedSmall > 0 &&
    typeof storedMedium === 'number' &&
    Number.isFinite(storedMedium) &&
    storedMedium > 0
  if (
    hasStored &&
    Math.round(storedSmall as number) === previousDefaultSmall &&
    Math.round(storedMedium as number) === previousDefaultMedium
  ) {
    return normalizeAxisLimits(fallbackSmall, fallbackMedium)
  }
  return normalizeAxisLimits(
    numMm(src, smallKey, fallbackSmall),
    numMm(src, mediumKey, fallbackMedium),
  )
}

function parseEdgeBandingSettings(raw: unknown): EdgeBandingTimeSettings {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const d = DEFAULT_ASSEMBLY_TIME_SETTINGS.edgeBanding
  return {
    thinEdgeUpTo50cm: numPositive(src, 'thinEdgeUpTo50cm', d.thinEdgeUpTo50cm),
    thinEdgeUpTo100cm: numPositive(src, 'thinEdgeUpTo100cm', d.thinEdgeUpTo100cm),
    thinEdgeUpTo150cm: numPositive(src, 'thinEdgeUpTo150cm', d.thinEdgeUpTo150cm),
    thinEdgeAdditionalPer50cm: numPositive(src, 'thinEdgeAdditionalPer50cm', d.thinEdgeAdditionalPer50cm),
  }
}

export function parseAssemblyTimeSettings(raw: unknown): AssemblyTimeSettings {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const d = DEFAULT_ASSEMBLY_TIME_SETTINGS
  const width = parseAxisLimits(src, 'widthSmallMaxMm', 'widthMediumMaxMm', d.widthSmallMaxMm, d.widthMediumMaxMm, 400, 600)
  const height = normalizeAxisLimits(numMm(src, 'heightSmallMaxMm', d.heightSmallMaxMm), numMm(src, 'heightMediumMaxMm', d.heightMediumMaxMm))
  const depth = parseAxisLimits(src, 'depthSmallMaxMm', 'depthMediumMaxMm', d.depthSmallMaxMm, d.depthMediumMaxMm, 350, 500)
  return {
    edgeBanding: parseEdgeBandingSettings(src.edgeBanding),
    installLegsMinutes: numPositive(src, 'installLegsMinutes', d.installLegsMinutes),
    assembleTopRailsMinutes: numPositive(src, 'assembleTopRailsMinutes', d.assembleTopRailsMinutes),
    shelfPinPairMinutes: numPositive(src, 'shelfPinPairMinutes', d.shelfPinPairMinutes),
    backSmallMinutes: numPositive(src, 'backSmallMinutes', d.backSmallMinutes),
    backLargeMinutes: numPositive(src, 'backLargeMinutes', d.backLargeMinutes),
    plinthSmallMinutes: numPositive(src, 'plinthSmallMinutes', d.plinthSmallMinutes),
    plinthMediumMinutes: numPositive(src, 'plinthMediumMinutes', d.plinthMediumMinutes),
    plinthLargeMinutes: numPositive(src, 'plinthLargeMinutes', d.plinthLargeMinutes),
    sidesToBottomSmallMinutes: numPositive(src, 'sidesToBottomSmallMinutes', d.sidesToBottomSmallMinutes),
    sidesToBottomMediumMinutes: numPositive(src, 'sidesToBottomMediumMinutes', d.sidesToBottomMediumMinutes),
    sidesToBottomLargeMinutes: numPositive(src, 'sidesToBottomLargeMinutes', d.sidesToBottomLargeMinutes),
    topSmallMinutes: numPositive(src, 'topSmallMinutes', d.topSmallMinutes),
    topMediumMinutes: numPositive(src, 'topMediumMinutes', d.topMediumMinutes),
    topLargeMinutes: numPositive(src, 'topLargeMinutes', d.topLargeMinutes),
    clothesRailConsoleMinutes: numPositive(src, 'clothesRailConsoleMinutes', d.clothesRailConsoleMinutes),
    clothesRailCutMinutes: numPositive(src, 'clothesRailCutMinutes', d.clothesRailCutMinutes),
    clothesRailInstallMinutes: numPositive(src, 'clothesRailInstallMinutes', d.clothesRailInstallMinutes),
    installDrawerGuidesMinutes: numPositive(src, 'installDrawerGuidesMinutes', d.installDrawerGuidesMinutes),
    assembleDrawerBoxMinutes: numPositive(src, 'assembleDrawerBoxMinutes', d.assembleDrawerBoxMinutes),
    attachDrawerBackMinutes: numPositive(src, 'attachDrawerBackMinutes', d.attachDrawerBackMinutes),
    attachDrawerRunnersMinutes: numPositive(src, 'attachDrawerRunnersMinutes', d.attachDrawerRunnersMinutes),
    installDrawerFrontMinutes: numPositive(src, 'installDrawerFrontMinutes', d.installDrawerFrontMinutes),
    installDoorMinutes: numPositive(src, 'installDoorMinutes', d.installDoorMinutes),
    widthSmallMaxMm: width.smallMaxMm,
    widthMediumMaxMm: width.mediumMaxMm,
    heightSmallMaxMm: height.smallMaxMm,
    heightMediumMaxMm: height.mediumMaxMm,
    depthSmallMaxMm: depth.smallMaxMm,
    depthMediumMaxMm: depth.mediumMaxMm,
    backLargeMinHeightMm: numMm(src, 'backLargeMinHeightMm', d.backLargeMinHeightMm),
    backLargeMinWidthMm: numMm(src, 'backLargeMinWidthMm', d.backLargeMinWidthMm),
  }
}

export function loadAssemblyTimeSettings(): AssemblyTimeSettings {
  try {
    const stored = localStorage.getItem(ASSEMBLY_TIME_SETTINGS_KEY)
    if (stored) return parseAssemblyTimeSettings(JSON.parse(stored))
  } catch (e) {
    console.error('Failed to load assembly time settings:', e)
  }
  return parseAssemblyTimeSettings(null)
}

export function saveAssemblyTimeSettings(settings: AssemblyTimeSettings): void {
  try {
    localStorage.setItem(ASSEMBLY_TIME_SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save assembly time settings:', e)
  }
}

export function resetAssemblyTimeSettings(): AssemblyTimeSettings {
  const defaults = parseAssemblyTimeSettings(null)
  saveAssemblyTimeSettings(defaults)
  return defaults
}

/**
 * Calculate edge banding processing time for a single edge (in minutes).
 * This includes chiseling and sanding after edge banding is applied.
 * 
 * @param lengthMm Edge length in millimeters
 * @param settings Edge banding time settings
 * @returns Time in minutes
 */
export function calculateEdgeBandingTimePerEdge(
  lengthMm: number,
  settings: EdgeBandingTimeSettings,
): number {
  const lengthCm = lengthMm / 10
  
  let timeSeconds: number
  
  if (lengthCm <= 50) {
    timeSeconds = settings.thinEdgeUpTo50cm
  } else if (lengthCm <= 100) {
    timeSeconds = settings.thinEdgeUpTo100cm
  } else if (lengthCm <= 150) {
    timeSeconds = settings.thinEdgeUpTo150cm
  } else {
    // For every 50cm beyond 150cm, add additional time
    const additionalSegments = Math.ceil((lengthCm - 150) / 50)
    timeSeconds = settings.thinEdgeUpTo150cm + (additionalSegments * settings.thinEdgeAdditionalPer50cm)
  }
  
  // Convert seconds to minutes
  return timeSeconds / 60
}

/**
 * Calculate total edge banding processing time for a panel (in minutes).
 * 
 * @param widthMm Panel width in mm
 * @param heightMm Panel height in mm
 * @param edges Which edges need to be banded (top, bottom, left, right)
 * @param quantity Number of identical panels
 * @param settings Edge banding time settings
 * @returns Total time in minutes
 */
export function calculatePanelEdgeBandingTime(
  widthMm: number,
  heightMm: number,
  edges: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean },
  quantity: number,
  settings: EdgeBandingTimeSettings,
): number {
  let timePerPanel = 0
  
  if (edges.top) {
    timePerPanel += calculateEdgeBandingTimePerEdge(widthMm, settings)
  }
  if (edges.bottom) {
    timePerPanel += calculateEdgeBandingTimePerEdge(widthMm, settings)
  }
  if (edges.left) {
    timePerPanel += calculateEdgeBandingTimePerEdge(heightMm, settings)
  }
  if (edges.right) {
    timePerPanel += calculateEdgeBandingTimePerEdge(heightMm, settings)
  }
  
  return timePerPanel * quantity
}

export interface AssemblyStep {
  id: string
  label: string
  minutes: number
  hint?: string
  quantity?: number
  /** Singular unit name, e.g. чифт. */
  unitOne?: string
  /** Plural unit name, e.g. чифта. */
  unitMany?: string
}

function formatQty(n: number): string {
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
}

function minText(minutes: number): string {
  return `${formatQty(minutes)} мин`
}

function qtyPhrase(n: number, one?: string, many?: string): string {
  const q = formatQty(n)
  if (!one && !many) return q
  return `${q} ${n === 1 ? one ?? many : many ?? one}`
}

/**
 * How the step minutes are obtained, e.g. "7 рафта × 3 мин = 21 мин".
 */
export function describeAssemblyCalc(step: AssemblyStep): string {
  const qty = step.quantity
  if (qty != null && qty > 0) {
    const per = step.minutes / qty
    const mul = `${qtyPhrase(qty, step.unitOne, step.unitMany)} × ${minText(per)} = ${minText(step.minutes)}`
    return step.hint ? `${step.hint} · ${mul}` : mul
  }
  if (step.hint) return `${step.hint} → ${minText(step.minutes)}`
  return minText(step.minutes)
}

export interface AssemblyPanelInput {
  role: string
  name: string
  width: number
  height: number
  quantity: number
  edges: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean }
  excludeFromCutting?: boolean
}

function pushStep(steps: AssemblyStep[], step: AssemblyStep): void {
  if (!(step.minutes > 0)) return
  steps.push({ ...step, minutes: Math.round(step.minutes * 10) / 10 })
}

/**
 * Build the assembly time list from the workshop settings.
 * Add new operations here when new assembly steps are defined.
 */
export function collectCabinetAssembly(input: {
  settings: AssemblyTimeSettings
  panels: AssemblyPanelInput[]
  width: number
  height: number
  depth: number
  hasLegs: boolean
  hasTopRails: boolean
  hasTop: boolean
  plinthCount: number
  hasBack: boolean
  shelfCount: number
  doorCount: number
  drawerCount: number
  hasClothesRail: boolean
  clothesRailCount?: number
  clothesRailLengthMm?: number
  fixedShelfCount?: number
}): { steps: AssemblyStep[]; minutes: number } {
  const s = input.settings
  const steps: AssemblyStep[] = []
  const classified = classifyCabinetSize(
    { width: input.width, height: input.height, depth: input.depth },
    s,
  )
  const tier = classified.tier
  const size = formatCabinetSizeBreakdown(classified)

  if (input.hasLegs) {
    pushStep(steps, {
      id: 'legs',
      label: 'Слагане на 4 крачета на дъното',
      minutes: s.installLegsMinutes,
      hint: '4 крачета на дъното',
    })
  }

  if (input.plinthCount > 0) {
    const per = pickTier(tier, s.plinthSmallMinutes, s.plinthMediumMinutes, s.plinthLargeMinutes)
    const n = input.plinthCount
    pushStep(steps, {
      id: 'plinth',
      label: n === 1 ? 'Слагане на цокъл към дъното' : 'Слагане на цокли към дъното',
      minutes: per * n,
      quantity: n,
      unitOne: 'цокъл',
      unitMany: 'цокъла',
      hint: size,
    })
  }

  pushStep(steps, {
    id: 'sides-bottom',
    label: 'Сглобяване на страниците към дъното',
    minutes: pickTier(
      tier,
      s.sidesToBottomSmallMinutes,
      s.sidesToBottomMediumMinutes,
      s.sidesToBottomLargeMinutes,
    ),
    hint: size,
  })

  if (input.hasTopRails) {
    pushStep(steps, {
      id: 'top-rails',
      label: 'Сглобяване на 2 бленди горе',
      minutes: s.assembleTopRailsMinutes,
      hint: 'предна и задна бленда между страниците',
    })
  }

  if (input.hasTop) {
    pushStep(steps, {
      id: 'top',
      label: 'Слагане на плот',
      minutes: pickTier(tier, s.topSmallMinutes, s.topMediumMinutes, s.topLargeMinutes),
      hint: size,
    })
  }

  for (const panel of input.panels) {
    if (panel.excludeFromCutting) continue
    const minutes = calculatePanelEdgeBandingTime(
      panel.width,
      panel.height,
      panel.edges,
      panel.quantity,
      s.edgeBanding,
    )
    pushStep(steps, {
      id: `edge:${panel.role}:${panel.name}`,
      label: `Обработка на кант — ${panel.name}`,
      minutes,
      quantity: panel.quantity,
      unitOne: 'бр.',
      unitMany: 'бр.',
      hint: 'изчукване и шлайфане след лепене според дължината на страната',
    })
  }

  if (input.shelfCount > 0) {
    pushStep(steps, {
      id: 'shelf-pins',
      label: 'Слагане на рафтоносачи',
      minutes: s.shelfPinPairMinutes * input.shelfCount,
      quantity: input.shelfCount,
      unitOne: 'рафт',
      unitMany: 'рафта',
      hint: '4 рафтоносача на рафт',
    })
  }

  if ((input.fixedShelfCount ?? 0) > 0) {
    const n = input.fixedShelfCount ?? 0
    const per = pickTier(tier, s.topSmallMinutes, s.topMediumMinutes, s.topLargeMinutes)
    pushStep(steps, {
      id: 'fixed-shelf',
      label: n === 1 ? 'Сглобяване на фиксиран рафт към страниците' : 'Сглобяване на фиксирани рафтове към страниците',
      minutes: per * n,
      quantity: n,
      unitOne: 'рафт',
      unitMany: 'рафта',
      hint: 'винтове 5×60 през страниците',
    })
  }

  if (input.hasBack) {
    const large = isLargeBack(input.width, input.height, s)
    const minutes = large ? s.backLargeMinutes : s.backSmallMinutes
    pushStep(steps, {
      id: 'back',
      label: 'Слагане на гръб',
      minutes,
      hint: large
        ? `голям · над ${s.backLargeMinHeightMm ?? BACK_LARGE_MIN_HEIGHT_MM} мм висок и над ${s.backLargeMinWidthMm ?? BACK_LARGE_MIN_WIDTH_MM} мм широк`
        : 'малък шкаф',
    })
  }

  const railN = input.clothesRailCount ?? (input.hasClothesRail ? 1 : 0)
  if (railN > 0) {
    const len = Math.max(0, Math.round(input.clothesRailLengthMm ?? 0))
    pushStep(steps, {
      id: 'clothes-rail-console',
      label: 'Слагане на конзоли за лост',
      minutes: s.clothesRailConsoleMinutes * railN,
      quantity: railN,
      unitOne: 'лост',
      unitMany: 'лоста',
      hint: 'една двойка конзоли на лост',
    })
    pushStep(steps, {
      id: 'clothes-rail-cut',
      label: 'Срязване на лоста за дрехи',
      minutes: s.clothesRailCutMinutes * railN,
      quantity: railN,
      unitOne: 'лост',
      unitMany: 'лоста',
      hint: len > 0 ? `лост ${len} мм` : 'срязване на лоста',
    })
    pushStep(steps, {
      id: 'clothes-rail-install',
      label: 'Слагане на лоста при сглобяване',
      minutes: s.clothesRailInstallMinutes * railN,
      quantity: railN,
      unitOne: 'лост',
      unitMany: 'лоста',
      hint: 'лостът се слага в конзолите',
    })
  }

  if (input.drawerCount > 0) {
    const n = input.drawerCount
    pushStep(steps, {
      id: 'drawer-guides-sides',
      label: 'Слагане на водачи на страниците',
      minutes: s.installDrawerGuidesMinutes * n,
      quantity: n,
      unitOne: 'чекмедже',
      unitMany: 'чекмеджета',
      hint: 'водачите на страниците за всяко чекмедже',
    })
    pushStep(steps, {
      id: 'drawer-box',
      label: 'Сглобяване на кутията на чекмеджето',
      minutes: s.assembleDrawerBoxMinutes * n,
      quantity: n,
      unitOne: 'чекмедже',
      unitMany: 'чекмеджета',
    })
    pushStep(steps, {
      id: 'drawer-back',
      label: 'Слагане на гръб на чекмеджето',
      minutes: s.attachDrawerBackMinutes * n,
      quantity: n,
      unitOne: 'чекмедже',
      unitMany: 'чекмеджета',
    })
    pushStep(steps, {
      id: 'drawer-runners',
      label: 'Слагане на водачите върху чекмеджето',
      minutes: s.attachDrawerRunnersMinutes * n,
      quantity: n,
      unitOne: 'чекмедже',
      unitMany: 'чекмеджета',
    })
    pushStep(steps, {
      id: 'drawer-front',
      label: 'Слагане на чело и регулация',
      minutes: s.installDrawerFrontMinutes * n,
      quantity: n,
      unitOne: 'чекмедже',
      unitMany: 'чекмеджета',
      hint: 'пробиване, слагане на челото и регулация на фугите',
    })
  }

  if (input.doorCount > 0) {
    const n = input.doorCount
    pushStep(steps, {
      id: 'door',
      label: 'Слагане на врата',
      minutes: s.installDoorMinutes * n,
      quantity: n,
      unitOne: 'врата',
      unitMany: 'врати',
      hint: 'изчистване, ръбове, пробиване за панти и слагане',
    })
  }

  const minutes = Math.round(steps.reduce((sum, step) => sum + step.minutes, 0) * 10) / 10
  return { steps, minutes }
}

/**
 * Calculate total drawer assembly time (in minutes).
 * This includes:
 * - Assembling the drawer box
 * - Attaching the back panel
 * - Installing runners/guides
 * - Installing and adjusting the front
 * 
 * @param drawerCount Number of drawers
 * @param settings Assembly time settings
 * @returns Total time in minutes
 */
export function calculateDrawerAssemblyTime(
  drawerCount: number,
  settings: AssemblyTimeSettings,
): number {
  if (drawerCount === 0) return 0
  
  const timePerDrawer = 
    settings.assembleDrawerBoxMinutes +
    settings.attachDrawerBackMinutes +
    settings.attachDrawerRunnersMinutes +
    settings.installDrawerFrontMinutes
  
  return timePerDrawer * drawerCount
}

/**
 * Format time in minutes to a human-readable string.
 */
export function formatAssemblyTime(minutes: number): string {
  if (minutes < 60) {
    const rounded = Math.round(minutes * 10) / 10
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
    return `${text} мин`
  }
  
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (mins === 0) {
    return `${hours} ч`
  }
  return `${hours} ч ${mins} мин`
}
