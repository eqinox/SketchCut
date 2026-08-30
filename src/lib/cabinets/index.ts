export { WORK_HOURS_PER_DAY, DEFAULT_PANEL_THICKNESS, DEFAULT_RAIL_WIDTH, DEFAULT_LEG_HEIGHT } from './types'
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
export { measureCarcass, KITCHEN_BASE_JOINERY } from './joinery'
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
  formatEur,
  formatArea,
} from './estimate'
export {
  addCabinetAndLabel,
  updateCabinetAndLabel,
  removeCabinetAndLabel,
  type CabinetState,
} from './apply'
