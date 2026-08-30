import type { HardwareItem } from './types'

export interface FastenerPack {
  id: string
  name: string
  packQty: number
  packPriceEur: number
}

/** Confirmat / chipboard screw used to assemble carcasses. */
export const SCREW_5X60: FastenerPack = {
  id: 'screw-5x60',
  name: 'Винт 5×60',
  packQty: 500,
  packPriceEur: 13,
}

export const FASTENERS = {
  [SCREW_5X60.id]: SCREW_5X60,
} as const

export type FastenerId = keyof typeof FASTENERS

/** Shelf support pin. Four per shelf. */
export const SHELF_PIN = {
  id: 'shelf-pin',
  name: 'Рафтоносач',
  unitPriceEur: 0.05,
} as const

export const SHELF_PINS_PER_SHELF = 4

/** Lower kitchen cabinet: 6 through the bottom, 8 for the two top rails. */
export const KITCHEN_BASE_SCREWS_BOTTOM = 6
export const KITCHEN_BASE_SCREWS_RAILS = 8
export const KITCHEN_BASE_SCREWS_TOTAL = KITCHEN_BASE_SCREWS_BOTTOM + KITCHEN_BASE_SCREWS_RAILS

export function fastenerUnitPriceEur(pack: FastenerPack): number {
  return pack.packPriceEur / pack.packQty
}

export function fastenerLine(pack: FastenerPack, quantity: number, note?: string): HardwareItem {
  return pricedLine(
    { id: pack.id, name: pack.name, unitPriceEur: fastenerUnitPriceEur(pack) },
    quantity,
    note,
  )
}

export function pricedLine(
  item: { id: string; name: string; unitPriceEur: number },
  quantity: number,
  note?: string,
): HardwareItem {
  return {
    id: item.id,
    name: item.name,
    quantity,
    unitPriceEur: item.unitPriceEur,
    note,
  }
}

export function hardwareCostEur(hardware: HardwareItem[]): number {
  return hardware.reduce((sum, item) => sum + (item.unitPriceEur ?? 0) * item.quantity, 0)
}

export function hardwareQtyById(hardware: HardwareItem[], id: string): number {
  return hardware.reduce((sum, item) => (item.id === id ? sum + item.quantity : sum), 0)
}

export function hardwareCostById(hardware: HardwareItem[], id: string): number {
  return hardware.reduce(
    (sum, item) => (item.id === id ? sum + (item.unitPriceEur ?? 0) * item.quantity : sum),
    0,
  )
}
