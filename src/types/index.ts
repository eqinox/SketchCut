import type { RoomPlan } from '@/lib/room'

export type BoardKind = 'chipboard' | 'hardboard'

export interface Sheet {
  id: string
  width: number
  height: number
  quantity: number
  /** Defaults to chipboard (ПДЧ). Hardboard (фазер) is nested separately. */
  kind?: BoardKind
  /** Price of one full sheet. Defaults to 86 € for chipboard. */
  priceEur?: number
  /** Decor from the workshop list. Sheets of different decors are cut separately. */
  finishId?: string
  /**
   * Grain runs along the length (the first size). Missing means the sheet has grain.
   * A smooth board (white, for example) has none, so parts on it may be turned.
   */
  hasGrain?: boolean
}

export interface Part {
  id: string
  width: number
  height: number
  quantity: number
  canRotate: boolean
  label: string
  /** Set when the part was generated from a cabinet */
  cabinetId?: string
  /** Defaults to chipboard. Hardboard parts nest on фазер sheets. */
  kind?: BoardKind
  /** Decor. Parts of different decors nest on different sheets. */
  finishId?: string
}

export interface CabinetInstance {
  id: string
  typeId: string
  name: string
  quantity: number
  params: Record<string, unknown>
  partIds: string[]
}

export type EdgeSide = 'top' | 'bottom' | 'left' | 'right'

export interface EdgeBandingSides {
  top: boolean
  bottom: boolean
  left: boolean
  right: boolean
}

export interface PartEdgeBanding {
  partId: string
  mm2: EdgeBandingSides
  mm05: EdgeBandingSides
}

export interface PlacedPart {
  partId: string
  label: string
  x: number
  y: number
  width: number
  height: number
  rotated: boolean
}

export interface PackedSheet {
  sheetId: string
  sheetWidth: number
  sheetHeight: number
  placed: PlacedPart[]
  wasteRects: { x: number; y: number; width: number; height: number }[]
  usedArea: number
  wasteArea: number
  wastePercent: number
  /** Decor this sheet was cut from, when the parts carry a board colour. */
  boardName?: string
  finishId?: string
  /** False when the board has no grain and parts were free to turn. */
  hasGrain?: boolean
}

export interface UnplacedPart {
  label: string
  width: number
  height: number
  boardName?: string
}

export interface PackingResult {
  success: boolean
  sheets: PackedSheet[]
  totalWastePercent: number
  unplacedCount: number
  variantKey: string
  /** Parts that are larger than every sheet of their colour. */
  unplaced?: UnplacedPart[]
}

export interface SavedProject {
  id: string
  name: string
  sheets: Sheet[]
  parts: Part[]
  edgeBanding: PartEdgeBanding[]
  cabinets?: CabinetInstance[]
  dailyRateEur?: number
  /** Furniture laid out in a room. Missing on older projects. */
  room?: RoomPlan
  updatedAt: number
}

export interface EdgeBandingTotals {
  mm2: number
  mm05: number
}
