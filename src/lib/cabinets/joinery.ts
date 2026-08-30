import type { CabinetDimensions, JoineryConfig } from './types'

export interface CarcassMeasures {
  thickness: number
  outerW: number
  outerH: number
  outerD: number
  /** Clear width between inner faces of the sides */
  innerW: number
  bottomW: number
  bottomD: number
  sideH: number
  sideD: number
  /** Length of a top rail / top panel along the cabinet width */
  railLength: number
  /** Clear height inside: above the bottom, below the top rails */
  innerH: number
}

/**
 * Derive cut sizes from outer dimensions + who covers whom.
 * New cabinet types should pick a JoineryConfig and reuse this instead of
 * copying arithmetic.
 */
export function measureCarcass(dims: CabinetDimensions, joinery: JoineryConfig): CarcassMeasures {
  const { width: W, height: H, depth: D, thickness: T } = dims

  const bottomW = joinery.bottomSides === 'bottom-covers-sides' ? W : W - 2 * T
  const sideH = joinery.bottomSides === 'bottom-covers-sides' ? H - T : H

  const bottomD =
    joinery.depth === 'sides-cover-bottom' ? D - 2 * T : D
  const sideD =
    joinery.depth === 'bottom-covers-sides' ? D - 2 * T : D

  const railLength = joinery.topSides === 'rails-between-sides' ? W - 2 * T : W

  return {
    thickness: T,
    outerW: W,
    outerH: H,
    outerD: D,
    innerW: W - 2 * T,
    bottomW,
    bottomD,
    sideH,
    sideD,
    railLength,
    innerH: H - 2 * T,
  }
}

/**
 * Distances from the inner floor (top of the bottom) to the bottom face of each shelf.
 * Gaps above, between and below are equal.
 */
export function evenShelfBottoms(innerH: number, count: number, thickness: number): number[] {
  if (count < 1) return []
  const free = innerH - count * thickness
  const gap = free / (count + 1)
  return Array.from({ length: count }, (_, i) => gap * (i + 1) + thickness * i)
}

export const KITCHEN_BASE_JOINERY: JoineryConfig = {
  bottomSides: 'bottom-covers-sides',
  topSides: 'rails-between-sides',
  depth: 'flush',
}
