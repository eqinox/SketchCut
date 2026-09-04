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

export interface AssemblyTimeSettings {
  /** Edge banding processing time settings */
  edgeBanding: EdgeBandingTimeSettings
  
  /** Time to install 4 legs on bottom panel (minutes) */
  installLegsMinutes: number
  
  /** Time to assemble 2 side panels (minutes) */
  assembleSidesMinutes: number
  
  /** Time to assemble top 2 plinths/rails (minutes) */
  assembleTopRailsMinutes: number
  
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
  assembleSidesMinutes: 7,
  assembleTopRailsMinutes: 10,
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
    assembleSidesMinutes: numPositive(src, 'assembleSidesMinutes', d.assembleSidesMinutes),
    assembleTopRailsMinutes: numPositive(src, 'assembleTopRailsMinutes', d.assembleTopRailsMinutes),
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
