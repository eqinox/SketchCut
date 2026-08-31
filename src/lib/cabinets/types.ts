import type { BoardKind, EdgeBandingSides } from '@/types'
import type { CabinetPartColors } from './colors'

/** Actual working hours counted per day (breaks are not billed). */
export const WORK_HOURS_PER_DAY = 7

export const DEFAULT_PANEL_THICKNESS = 18
export const DEFAULT_RAIL_WIDTH = 100
export const DEFAULT_LEG_HEIGHT = 100
/** Lower kitchen shelves start this far back from the front edge. */
export const DEFAULT_SHELF_FRONT_INSET = 50

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
  /** Defaults to chipboard (ПДЧ). */
  material?: BoardKind
  /** Group ID for visually related panels (e.g., combined cutting) */
  groupId?: string
  /** If true, this panel is for reference only and should not be included in cutting layout */
  excludeFromCutting?: boolean
  /** Visual highlight color for grouping (e.g., 'red', 'blue') */
  highlightColor?: string
}

export interface HardwareItem {
  /** Catalog id when the item is priced (e.g. screw-5x60). */
  id?: string
  name: string
  quantity: number
  /** EUR per piece; omit until the workshop price is known. */
  unitPriceEur?: number
  note?: string
}

/**
 * Minutes per cabinet. Cutting and edging are derived from sheet usage
 * (40 min and 30 min per full plate). Assembly stays null until set.
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
  generate: (params: Record<string, unknown>, settings?: unknown) => CabinetGeneratorResult
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
  /** 0–3 evenly spaced shelves */
  shelfCount: number
  /** 3 mm hardboard back. */
  hasBack: boolean
  /** 0 = no doors, otherwise 1 or 2. */
  doorCount: 0 | 1 | 2
  /** Drawer front height in mm (if > 0, adds a drawer above the door) */
  drawerFrontHeight: number
  /** Cut drawer front and door from one board for continuous grain */
  cutFromOneBoard: boolean
  colors: CabinetPartColors
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
