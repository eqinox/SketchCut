export { WORK_HOURS_PER_DAY, DEFAULT_PANEL_THICKNESS, DEFAULT_RAIL_WIDTH, DEFAULT_LEG_HEIGHT, DEFAULT_SHELF_FRONT_INSET } from './types'
export type {
  CabinetCategory,
  CabinetDimensions,
  CabinetGeneratorResult,
  CabinetTypeDefinition,
  GeneratedPanel,
  HardwareItem,
  JoineryConfig,
  KitchenBaseParams,
  LaborEstimate,
  PanelEdgePlan,
  PanelRole,
} from './types'
export type { CabinetInstance } from '@/types'

export { CABINET_TYPES, getCabinetType, generateCabinet, scaleCabinetResult, cabinetDisplayName } from './catalog'
export { measureCarcass, evenShelfBottoms, KITCHEN_BASE_JOINERY } from './joinery'
export {
  KITCHEN_BASE_TYPE_ID,
  DEFAULT_KITCHEN_BASE_PARAMS,
  parseKitchenBaseParams,
  generateKitchenBase,
} from './kitchen-base'
export {
  estimateFromPanels,
  estimateFromParts,
  hourlyRateEur,
  laborMinutes,
  laborCostEur,
  cabinetPrice,
  formatEur,
  formatArea,
  formatMinutes,
  laborFromPanels,
} from './estimate'
export type { CabinetPrice } from './estimate'
export {
  SCREW_5X60,
  SHELF_PIN,
  SHELF_PINS_PER_SHELF,
  FASTENERS,
  KITCHEN_BASE_SCREWS_BOTTOM,
  KITCHEN_BASE_SCREWS_RAILS,
  KITCHEN_BASE_SCREWS_TOTAL,
  fastenerUnitPriceEur,
  fastenerLine,
  pricedLine,
  hardwareCostEur,
  hardwareQtyById,
  hardwareCostById,
} from './hardware'
export {
  DEFAULT_CHIPBOARD_PRICE_EUR,
  DEFAULT_CHIPBOARD_WIDTH,
  DEFAULT_CHIPBOARD_HEIGHT,
  DEFAULT_HARDBOARD_WIDTH,
  DEFAULT_HARDBOARD_HEIGHT,
  DEFAULT_HARDBOARD_PRICE_EUR,
  DEFAULT_HARDBOARD_THICKNESS,
  EDGE_PRICE_MM2_EUR,
  EDGE_PRICE_MM05_EUR,
  CUTTING_MINUTES_PER_SHEET,
  EDGING_MINUTES_PER_SHEET,
  DOOR_CLEARANCE_Y,
  DOOR_GAP_X,
  DOOR_EDGE_BOTH,
  sheetKind,
  partKind,
  normalizeSheet,
  usedBoardCostEur,
  edgeBandingCostEur,
  referenceSheet,
  firstSheetOfKind,
  doorCutSize,
  parseDoorCount,
  boardKindLabel,
  createHardboardSheet,
} from './materials'
export type { BoardKind, DoorCount } from './materials'
export {
  addCabinetAndLabel,
  updateCabinetAndLabel,
  removeCabinetAndLabel,
  type CabinetState,
} from './apply'
export type { CabinetPartColors, CabinetPartColorKey } from './colors'
export {
  DEFAULT_PART_COLORS,
  DEFAULT_WOOD_COLOR,
  DEFAULT_LEG_COLOR,
  DEFAULT_HARDBOARD_COLOR,
  PART_COLOR_FIELDS,
  parsePartColors,
  partFaces,
} from './colors'
