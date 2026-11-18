import type { HardwareSettings } from '@/lib/settings'
import { formatMm } from '@/lib/utils'
import type { AssemblyStep } from '@/lib/assembly-time'
import type { CabinetGeneratorResult, GeneratedPanel, HardwareItem } from './types'
import { pricedLine } from './hardware'

/** 3 mm rectangular mirror, EUR per square metre. */
export const MIRROR_EUR_PER_M2 = 38.4
/** Polished edge, EUR per metre of the perimeter. */
export const MIRROR_EDGE_EUR_PER_M = 1.79
/** One bottle of silicone per mirror. */
export const MIRROR_SILICONE_EUR = 5
/** Fitting one mirror. */
export const MIRROR_FIT_MINUTES = 30

/**
 * How the glass sits on the board.
 * `full` covers the whole panel.
 * `rise` starts `bottom` mm up from the bottom of the board and is `riseMm` tall.
 * `inset` leaves the four gaps.
 * Zero is the edge of the board, not the edge band glued on afterwards.
 */
export type MirrorMode = 'full' | 'rise' | 'inset'

export interface MirrorSpec {
  enabled: boolean
  polished: boolean
  mode: MirrorMode
  riseMm: number
  left: number
  right: number
  top: number
  bottom: number
  /**
   * Which doors carry the glass. Missing means every door.
   * An empty list means none. Ids match the drawing: `door-full-0`, `door-slide-1`.
   */
  on?: string[]
}

export const EMPTY_MIRROR: MirrorSpec = {
  enabled: false,
  polished: true,
  mode: 'full',
  riseMm: 1900,
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
}

function mm(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.round(n)
}

export function parseMirrorSpec(raw: unknown): MirrorSpec {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const mode: MirrorMode = src.mode === 'rise' || src.mode === 'inset' ? src.mode : 'full'
  return {
    enabled: src.enabled === true,
    polished: src.polished !== false,
    mode,
    riseMm: mm(src.riseMm, EMPTY_MIRROR.riseMm),
    left: mm(src.left, 0),
    right: mm(src.right, 0),
    top: mm(src.top, 0),
    bottom: mm(src.bottom, 0),
    on: Array.isArray(src.on) ? src.on.filter((item): item is string => typeof item === 'string') : undefined,
  }
}

/** Pale glass, distinct from the door board in the 3D picture. */
export const MIRROR_GLASS_COLOR = '#f7fcff'

/** True when this door id carries the glass. */
export function mirrorCoversDoor(spec: MirrorSpec, id: string): boolean {
  if (!spec.enabled) return false
  if (!spec.on) return true
  return spec.on.includes(id)
}

export interface MirrorDoorTarget {
  id: string
  label: string
  width: number
  height: number
}

function doorLeafLabel(name: string, index: number, count: number): string {
  if (/лява|дясна|средна/i.test(name)) return name
  if (count <= 1) return name
  const side = count === 2 ? (index === 0 ? 'лява' : 'дясна') : index === 0 ? 'лява' : index === count - 1 ? 'дясна' : 'средна'
  return `${name} · ${side}`
}

/** One row per door the glass can sit on, in the same order as the drawing. */
export function mirrorDoorTargets(panels: GeneratedPanel[]): MirrorDoorTarget[] {
  const out: MirrorDoorTarget[] = []
  for (const panel of panels) {
    if (!doorPanel(panel)) continue
    if (panel.name.includes('комбинирано')) continue
    const keys = (panel.pieceKeys ?? []).filter((key) => key.startsWith('door'))
    const ids = keys.length > 0 ? keys : panel.quantity <= 1 ? ['door'] : Array.from({ length: panel.quantity }, (_, i) => `door-${i}`)
    ids.forEach((id, index) => {
      out.push({
        id,
        label: doorLeafLabel(panel.name, index, ids.length),
        width: panel.width,
        height: panel.height,
      })
    })
  }
  return out
}

export interface MirrorGlass {
  /** From the left edge of the board. */
  x: number
  /** From the top edge of the board. */
  y: number
  width: number
  height: number
}

/** Glass rectangle on a panel, or null when the gaps eat the board. */
export function mirrorGlass(panelWidth: number, panelHeight: number, spec: MirrorSpec): MirrorGlass | null {
  if (!spec.enabled) return null
  const left = spec.mode === 'full' ? 0 : spec.left
  const right = spec.mode === 'full' ? 0 : spec.right
  const bottom = spec.mode === 'full' ? 0 : spec.bottom
  const top =
    spec.mode === 'full'
      ? 0
      : spec.mode === 'rise'
        ? panelHeight - bottom - spec.riseMm
        : spec.top
  const width = panelWidth - left - right
  const height = panelHeight - top - bottom
  if (left < 0 || right < 0 || top < 0 || bottom < 0 || width < 20 || height < 20) return null
  return { x: left, y: top, width, height }
}

export interface MirrorQuote {
  areaM2: number
  perimeterM: number
  eur: number
}

/**
 * GlassMania 3 mm rectangle.
 * Area is width × height in metres. The polished edge is the perimeter × 1.79 €.
 * The two are added first and only then rounded to cents.
 * 398 × 1900 is 29.04 €, and 37.26 € with the polished edge.
 */
export function mirrorQuote(
  widthMm: number,
  heightMm: number,
  polished: boolean,
  perM2 = MIRROR_EUR_PER_M2,
  edgePerM = MIRROR_EDGE_EUR_PER_M,
): MirrorQuote {
  const w = widthMm / 1000
  const h = heightMm / 1000
  const areaM2 = Number.parseFloat((w * h).toPrecision(12))
  const perimeterM = (w + h) * 2
  let eur = areaM2 * perM2
  if (polished) eur += perimeterM * edgePerM
  return {
    areaM2,
    perimeterM,
    eur: Math.round((eur + Number.EPSILON) * 100) / 100,
  }
}

function doorPanel(panel: GeneratedPanel): boolean {
  if (panel.role !== 'door' && panel.role !== 'sliding-door') return false
  if (panel.name.includes('след разрязване')) return false
  return true
}

/** The vanity board the glass is glued on. Piece keys are removed after the finish is stamped. */
export function isMirrorBoard(panel: GeneratedPanel): boolean {
  return panel.pieceKeys?.includes('mirror-board') === true || panel.name === 'Плоскост за огледало'
}

function ratesOf(settings?: unknown): { perM2: number; edgePerM: number; silicone: number } {
  const hardware = (settings as { hardware?: HardwareSettings } | undefined)?.hardware
  return {
    perM2: hardware?.mirrorEurPerM2 ?? MIRROR_EUR_PER_M2,
    edgePerM: hardware?.mirrorEdgeEurPerM ?? MIRROR_EDGE_EUR_PER_M,
    silicone: hardware?.mirrorSiliconeEur ?? MIRROR_SILICONE_EUR,
  }
}

/** Bought glass on the doors and, for a vanity, on the mirror board. Not a cut part. */
export function applyCabinetMirrors(
  result: CabinetGeneratorResult,
  params: Record<string, unknown>,
  settings?: unknown,
): CabinetGeneratorResult {
  const doorSpec = parseMirrorSpec(params.doorMirror)
  const boardSpec = parseMirrorSpec(params.boardMirror)
  if (!doorSpec.enabled && !boardSpec.enabled) return result
  const rates = ratesOf(settings)
  const hardware: HardwareItem[] = [...result.hardware]
  const notes = [...result.notes]
  const groups = new Map<string, { name: string; quantity: number; unit: number; note: string }>()
  let mirrors = 0
  let rejected = 0

  const take = (panel: GeneratedPanel, spec: MirrorSpec, where: string) => {
    const glass = mirrorGlass(panel.width, panel.height, spec)
    if (!glass) {
      rejected += panel.quantity
      notes.push(
        `${where} ${formatMm(panel.width)} × ${formatMm(panel.height)} мм: огледалото не се събира в плоскостта.`,
      )
      return
    }
    const quote = mirrorQuote(glass.width, glass.height, spec.polished, rates.perM2, rates.edgePerM)
    const key = `${glass.width}x${glass.height}:${spec.polished ? 1 : 0}:${quote.eur}`
    const name = `Огледало 3 мм ${formatMm(glass.width)}×${formatMm(glass.height)}`
    const note = spec.polished
      ? `Полиран кант. Лице ${quote.areaM2.toFixed(4)} м² × ${rates.perM2.toFixed(2)} €, обиколка ${quote.perimeterM.toFixed(3)} м × ${rates.edgePerM.toFixed(2)} €.`
      : `Без полиран кант. Лице ${quote.areaM2.toFixed(4)} м² × ${rates.perM2.toFixed(2)} €.`
    const row = groups.get(key)
    if (row) row.quantity += panel.quantity
    else groups.set(key, { name, quantity: panel.quantity, unit: quote.eur, note })
    mirrors += panel.quantity
    notes.push(
      `${where}: огледало ${formatMm(glass.width)} × ${formatMm(glass.height)} мм${spec.polished ? ', с полиран кант' : ''}. Не се реже от плочата.`,
    )
  }

  for (const panel of result.panels) {
    if (doorSpec.enabled && doorPanel(panel) && !panel.name.includes('комбинирано')) {
      const keys = (panel.pieceKeys ?? []).filter((key) => key.startsWith('door'))
      if (keys.length > 0) {
        keys.forEach((id, index) => {
          if (!mirrorCoversDoor(doorSpec, id)) return
          const label = doorLeafLabel(panel.name, index, keys.length)
          take({ ...panel, quantity: 1, name: label }, doorSpec, label)
        })
      } else if (!doorSpec.on) {
        take(panel, doorSpec, panel.name)
      }
    }
    if (boardSpec.enabled && isMirrorBoard(panel)) take(panel, boardSpec, 'Плоскост за огледало')
  }

  for (const row of groups.values()) {
    hardware.push(pricedLine({ id: 'mirror-glass', name: row.name, unitPriceEur: row.unit }, row.quantity, row.note))
  }
  if (mirrors > 0 && rates.silicone > 0) {
    hardware.push(
      pricedLine(
        { id: 'mirror-silicone', name: 'Силикон', unitPriceEur: rates.silicone },
        mirrors,
        'по 1 бутилка на огледало',
      ),
    )
  }
  if (mirrors === 0 && rejected === 0) return result

  const steps: AssemblyStep[] = [...(result.labor.assemblySteps ?? [])]
  if (mirrors > 0) {
    steps.push({
      id: 'mirror-fit',
      label: 'Слагане на огледало',
      minutes: MIRROR_FIT_MINUTES * mirrors,
      quantity: mirrors,
      unitOne: 'огледало',
      unitMany: 'огледала',
    })
  }
  return {
    ...result,
    hardware,
    notes,
    labor: {
      ...result.labor,
      assemblyMinutes: (result.labor.assemblyMinutes ?? 0) + MIRROR_FIT_MINUTES * mirrors,
      assemblySteps: steps,
    },
  }
}
