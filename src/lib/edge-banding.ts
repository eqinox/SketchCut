import type { EdgeBandingSides, EdgeBandingTotals, Part, PartEdgeBanding } from '@/types'

export function createDefaultEdgeBanding(partId: string): PartEdgeBanding {
  return {
    partId,
    mm2: { top: false, bottom: false, left: false, right: false },
    mm05: { top: false, bottom: false, left: false, right: false },
  }
}

export function syncEdgeBanding(parts: Part[], existing: PartEdgeBanding[]): PartEdgeBanding[] {
  const map = new Map(existing.map((e) => [e.partId, e]))
  return parts.map((p) => map.get(p.id) ?? createDefaultEdgeBanding(p.id))
}

function sideLength(part: Part, side: keyof EdgeBandingSides): number {
  switch (side) {
    case 'top':
    case 'bottom':
      return part.width
    case 'left':
    case 'right':
      return part.height
  }
}

export function calculateEdgeBandingTotals(
  parts: Part[],
  edgeBanding: PartEdgeBanding[],
): EdgeBandingTotals {
  let mm2 = 0
  let mm05 = 0

  for (const band of edgeBanding) {
    const part = parts.find((p) => p.id === band.partId)
    if (!part) continue

    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      const lengthMm = sideLength(part, side) * part.quantity
      if (band.mm2[side]) mm2 += lengthMm
      if (band.mm05[side]) mm05 += lengthMm
    }
  }

  return { mm2: mm2 / 1000, mm05: mm05 / 1000 }
}

export function toggleEdgeSide(
  band: PartEdgeBanding,
  thickness: 'mm2' | 'mm05',
  side: keyof EdgeBandingSides,
  value: boolean,
): PartEdgeBanding {
  return {
    ...band,
    [thickness]: {
      ...band[thickness],
      [side]: value,
    },
  }
}
