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

/** Width above this (mm) is medium / „голям“. */
export const SIZE_MEDIUM_SPAN_MM = 800
/** Width above this (mm) is large / „много голям“ / над метър и половина. */
export const SIZE_LARGE_SPAN_MM = 1500
/** Back is „голям“ when height and width both exceed these. */
export const BACK_LARGE_MIN_HEIGHT_MM = 1000
export const BACK_LARGE_MIN_WIDTH_MM = 500

export type CarcassSizeTier = 'small' | 'medium' | 'large'

export function carcassSizeTier(widthMm: number): CarcassSizeTier {
  if (widthMm > SIZE_LARGE_SPAN_MM) return 'large'
  if (widthMm > SIZE_MEDIUM_SPAN_MM) return 'medium'
  return 'small'
}

export function isLargeBack(widthMm: number, heightMm: number): boolean {
  return heightMm > BACK_LARGE_MIN_HEIGHT_MM && widthMm > BACK_LARGE_MIN_WIDTH_MM
}

function pickTier<T>(tier: CarcassSizeTier, small: T, medium: T, large: T): T {
  if (tier === 'large') return large
  if (tier === 'medium') return medium
  return small
}

function sizeHint(tier: CarcassSizeTier): string {
  if (tier === 'large') return `голям · широчина над ${SIZE_LARGE_SPAN_MM} мм`
  if (tier === 'medium') return `среден · широчина над ${SIZE_MEDIUM_SPAN_MM} мм`
  return `малък · широчина до ${SIZE_MEDIUM_SPAN_MM} мм`
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
}

const ASSEMBLY_TIME_SETTINGS_KEY = 'sketchcut-assembly-time-settings'

function numPositive(src: Record<string, unknown>, key: string, fallback: number): number {
  const v = src[key]
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback
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
  hasLegs: boolean
  hasTopRails: boolean
  hasTop: boolean
  plinthCount: number
  hasBack: boolean
  shelfCount: number
  doorCount: number
  drawerCount: number
  hasClothesRail: boolean
  clothesRailLengthMm?: number
}): { steps: AssemblyStep[]; minutes: number } {
  const s = input.settings
  const steps: AssemblyStep[] = []
  const tier = carcassSizeTier(input.width)
  const size = sizeHint(tier)

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
      hint: 'изчукване и шлайфане след лепене според дължината на ръба',
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

  if (input.hasBack) {
    const large = isLargeBack(input.width, input.height)
    const minutes = large ? s.backLargeMinutes : s.backSmallMinutes
    pushStep(steps, {
      id: 'back',
      label: 'Слагане на гръб',
      minutes,
      hint: large
        ? `голям · над ${BACK_LARGE_MIN_HEIGHT_MM} мм висок и над ${BACK_LARGE_MIN_WIDTH_MM} мм широк`
        : 'малък шкаф',
    })
  }

  if (input.hasClothesRail) {
    const len = Math.max(0, Math.round(input.clothesRailLengthMm ?? 0))
    pushStep(steps, {
      id: 'clothes-rail-console',
      label: 'Слагане на конзоли за лост',
      minutes: s.clothesRailConsoleMinutes,
      hint: 'една двойка конзоли',
    })
    pushStep(steps, {
      id: 'clothes-rail-cut',
      label: 'Срязване на лоста за дрехи',
      minutes: s.clothesRailCutMinutes,
      hint: len > 0 ? `лост ${len} мм` : 'срязване на лоста',
    })
    pushStep(steps, {
      id: 'clothes-rail-install',
      label: 'Слагане на лоста при сглобяване',
      minutes: s.clothesRailInstallMinutes,
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
