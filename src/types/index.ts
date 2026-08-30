export interface Sheet {
  id: string
  width: number
  height: number
  quantity: number
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
}

export interface PackingResult {
  success: boolean
  sheets: PackedSheet[]
  totalWastePercent: number
  unplacedCount: number
  variantKey: string
}

export interface SavedProject {
  id: string
  name: string
  sheets: Sheet[]
  parts: Part[]
  edgeBanding: PartEdgeBanding[]
  cabinets?: CabinetInstance[]
  dailyRateEur?: number
  updatedAt: number
}

export interface EdgeBandingTotals {
  mm2: number
  mm05: number
}
