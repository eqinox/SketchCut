import type { EdgeBandingSides } from '@/types'

/** Actual working hours counted per day (breaks are not billed). */
export const WORK_HOURS_PER_DAY = 7

export const DEFAULT_PANEL_THICKNESS = 18
export const DEFAULT_RAIL_WIDTH = 100
export const DEFAULT_LEG_HEIGHT = 100

export type CabinetCategory = 'kitchen-base' | 'kitchen-wall' | 'wardrobe' | 'other'

export type PanelRole =
  | 'bottom'
  | 'side'
  | 'rail'
  | 'top'
  | 'back'
  | 'shelf'
  | 'plinth'
  | 'door'
  | 'drawer-front'
  | 'drawer-side'
  | 'drawer-back'
  | 'drawer-bottom'

/**
 * Which piece is the outer / covering one. This is swapped across cabinet types:
 * e.g. base kitchen has sides sitting ON the bottom; many wall units have the
 * bottom BETWEEN the sides.
 */
export interface JoineryConfig {
  /**
   * Bottom ↔ left/right sides.
   * `bottom-covers-sides`: bottom is full width, sides sit on it, screws from below.
   * `sides-cover-bottom`: sides are full height, bottom fits between them, screws from the sides.
   */
  bottomSides: 'bottom-covers-sides' | 'sides-cover-bottom'
  /**
   * Top rails / top panel ↔ sides.
   * `rails-between-sides`: rails/top fit between the sides.
   * `rails-cover-sides`: rails/top sit on the sides (full width).
   */
  topSides: 'rails-between-sides' | 'rails-cover-sides'
  /**
   * Depth alignment of sides vs bottom.
   * `flush`: both full depth (front edge of the bottom stays visible).
   */
  depth: 'flush' | 'sides-cover-bottom' | 'bottom-covers-sides'
}

export interface CabinetDimensions {
  /** Outer carcass width, mm */
  width: number
  /** Outer carcass height without legs, mm */
  height: number
  /** Outer carcass depth, mm */
  depth: number
  thickness: number
}

/** Edge flags relative to the generated part: top/bottom = width edges, left/right = height edges. */
export interface PanelEdgePlan {
  top: boolean
  bottom: boolean
  left: boolean
  right: boolean
  thickness: 'mm2' | 'mm05'
}

export interface GeneratedPanel {
  role: PanelRole
  /** Short name shown on the cutting list, e.g. "Дъно" */
  name: string
  width: number
  height: number
  quantity: number
  canRotate: boolean
  edges: PanelEdgePlan
  note?: string
}

export interface HardwareItem {
  name: string
  quantity: number
}

/**
 * Minutes per cabinet. Null until the workshop times are filled in.
 * Cutting, edging and assembly are tracked separately so later types can differ.
 */
export interface LaborEstimate {
  cuttingMinutes: number | null
  edgingMinutes: number | null
  assemblyMinutes: number | null
}

export interface CabinetGeneratorResult {
  panels: GeneratedPanel[]
  joinery: JoineryConfig
  hardware: HardwareItem[]
  labor: LaborEstimate
  notes: string[]
}

export interface CabinetTypeDefinition {
  id: string
  name: string
  category: CabinetCategory
  description: string
  defaultParams: Record<string, unknown>
  generate: (params: Record<string, unknown>) => CabinetGeneratorResult
}

export interface KitchenBaseParams {
  width: number
  height: number
  depth: number
  thickness: number
  /** 100 or 150 typically */
  legHeight: number
  /** Front/back top rail depth, mm (the 10 cm царги) */
  railWidth: number
  /** Reserved for later */
  shelfCount: number
  [key: string]: unknown
}

export const EMPTY_EDGES: EdgeBandingSides = {
  top: false,
  bottom: false,
  left: false,
  right: false,
}

export function emptyLabor(): LaborEstimate {
  return {
    cuttingMinutes: null,
    edgingMinutes: null,
    assemblyMinutes: null,
  }
}

export function edges(
  sides: Partial<Pick<PanelEdgePlan, 'top' | 'bottom' | 'left' | 'right'>>,
  thickness: PanelEdgePlan['thickness'] = 'mm2',
): PanelEdgePlan {
  return {
    top: !!sides.top,
    bottom: !!sides.bottom,
    left: !!sides.left,
    right: !!sides.right,
    thickness,
  }
}
