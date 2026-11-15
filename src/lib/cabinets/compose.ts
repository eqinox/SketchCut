import type { HardwareSettings } from '@/lib/settings'
import {
  confirmatCount,
  fastenerLine,
  hingesForDoorHeight,
  SCREW_4X16,
  SCREW_4X20,
  SCREW_4X30,
  SCREWS_4X16_PER_HINGE,
  SCREWS_4X20_PER_HINGE,
} from './hardware'
import { doorCutSize } from './materials'
import type { CabinetGeneratorResult, GeneratedPanel } from './types'
import { formatMm } from '@/lib/utils'

export type CabinetPlace = 'left' | 'right' | 'above' | 'below'

/** A cabinet already in the project, set against the one being drawn. */
export interface AttachedCabinet {
  cabinetId: string
  place: CabinetPlace
  /** Fasten the two boxes with 4×30 screws. */
  joinScrews: boolean
  /** One door across both, when one sits above the other. */
  spanDoor: boolean
  /** How many full-height doors cover both cabinets. Zero means each cabinet keeps its own. */
  spanDoorCount: number
}

export interface CabinetSize {
  w: number
  /** Carcass height, without the legs. The plinth, when there is one, is inside this height. */
  h: number
  d: number
  feet: number
  /** Door starts this far below the top, so a covering top stays visible. */
  doorTop: number
  /** Door stops this far above the floor. That is the plinth. */
  doorPlinth: number
}

export interface DrawFrame {
  ox: number
  top: number
  w: number
  /** Carcass height. Legs hang below this. */
  h: number
  feet: number
  vbW: number
  vbH: number
}

const PLACES: CabinetPlace[] = ['left', 'right', 'above', 'below']

/** A drawing of several cabinets. It has no parts and no price of its own. */
export const COMBINATION_TYPE = 'combination'

export interface CombinationMember {
  cabinetId: string
  place: CabinetPlace | 'host'
  joinScrews: boolean
  spanDoor: boolean
  spanDoorCount: number
}

export function isCombinationType(typeId: string): boolean {
  return typeId === COMBINATION_TYPE
}

export function parseCombination(raw: unknown): { hostId: string; members: CombinationMember[] } | null {
  if (!raw || typeof raw !== 'object') return null
  const params = raw as Record<string, unknown>
  const hostId = typeof params.hostId === 'string' ? params.hostId : ''
  if (!hostId || !Array.isArray(params.members)) return null
  const members: CombinationMember[] = []
  for (const item of params.members) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.cabinetId !== 'string' || row.cabinetId === '') continue
    const place =
      row.place === 'host' || PLACES.includes(row.place as CabinetPlace)
        ? (row.place as CombinationMember['place'])
        : 'right'
    members.push({
      cabinetId: row.cabinetId,
      place,
      joinScrews: row.joinScrews === true,
      spanDoor: row.spanDoor === true || spanDoorCountOf(row) > 0,
      spanDoorCount: spanDoorCountOf(row),
    })
  }
  if (members.length === 0) return null
  return { hostId, members }
}

export function combinationReferences(params: Record<string, unknown>, cabinetId: string): boolean {
  const parsed = parseCombination(params)
  if (!parsed) return false
  return parsed.hostId === cabinetId || parsed.members.some((member) => member.cabinetId === cabinetId)
}

/**
 * The outline is drawn centered on the edge, and the cabinet on top is painted last.
 * This keeps the facing edges apart by the stroke, so they meet and neither covers the other.
 */
export const EDGE_MEET_MM = 1

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function parseAttached(raw: unknown): AttachedCabinet | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (typeof row.cabinetId !== 'string' || row.cabinetId === '') return null
  const place = PLACES.includes(row.place as CabinetPlace) ? (row.place as CabinetPlace) : 'right'
  return {
    cabinetId: row.cabinetId,
    place,
    joinScrews: row.joinScrews === true,
    spanDoor: row.spanDoor === true || spanDoorCountOf(row) > 0,
    spanDoorCount: spanDoorCountOf(row),
  }
}

/** Full-height doors across both cabinets. Older saves stored only the on/off flag. */
export function spanDoorCountOf(row: { spanDoor?: unknown; spanDoorCount?: unknown }): number {
  const raw = typeof row.spanDoorCount === 'number' ? row.spanDoorCount : Number(row.spanDoorCount)
  if (Number.isFinite(raw) && raw > 0) return Math.max(1, Math.min(12, Math.round(raw)))
  return row.spanDoor === true ? 1 : 0
}

/** Where an overlay door sits on one cabinet: under a covering top, and on top of the plinth. */
function doorClearanceMm(typeId: string, params: Record<string, unknown>): { top: number; plinth: number } {
  if (typeId === 'kitchen-base' || typeId === 'kitchen-wall' || typeId === 'bed' || typeId === 'combination') {
    return { top: 0, plinth: 0 }
  }
  const thickness = num(params.thickness, 18)
  const rawPlinth = typeof params.plinthHeight === 'number' ? params.plinthHeight : Number(params.plinthHeight)
  const plinth = params.useLegs === true || !Number.isFinite(rawPlinth) || rawPlinth <= 0 ? 0 : rawPlinth
  const innerTop = typeId === 'section' || typeId === 'wardrobe'
  const coveringTop = !innerTop && params.topStyle !== 'none' && params.topStyle !== 'fascia'
  return { top: coveringTop ? thickness : 0, plinth }
}

/** One saved cabinet, or a list. Older projects stored a single object. */
export function parseAttachedList(raw: unknown): AttachedCabinet[] {
  if (Array.isArray(raw)) {
    const seen = new Set<string>()
    const rows: AttachedCabinet[] = []
    for (const item of raw) {
      const row = parseAttached(item)
      if (!row || seen.has(row.cabinetId)) continue
      seen.add(row.cabinetId)
      rows.push(row)
    }
    return rows
  }
  const one = parseAttached(raw)
  return one ? [one] : []
}

/** The first cabinet on a side sits against the one being drawn. The next ones continue outward. */
export function attachmentTouchesHost(rows: { place: CabinetPlace }[], index: number): boolean {
  const place = rows[index]?.place
  if (!place) return false
  return rows.findIndex((row) => row.place === place) === index
}

export function isStacked(place: CabinetPlace): boolean {
  return place === 'above' || place === 'below'
}

/** Outer box. A kitchen base reports the carcass and the legs separately, so two boxes can sit carcass to carcass. */
export function cabinetOuterSize(typeId: string, params: Record<string, unknown>): CabinetSize {
  const w = num(params.width, 600)
  const h = num(params.height, 720)
  const d = num(params.depth, 560)
  const door = doorClearanceMm(typeId, params)
  if (typeId === 'kitchen-base') {
    return { w, h, d, feet: num(params.legHeight, 100), doorTop: door.top, doorPlinth: door.plinth }
  }
  return { w, h, d, feet: 0, doorTop: door.top, doorPlinth: door.plinth }
}

interface LaidBox {
  x: number
  y: number
  w: number
  h: number
  d: number
}

/**
 * One solid piece of a cabinet or a combination, in the group's own frame.
 * Fronts share v = 0. A shallower box on the front leaves the back empty.
 * z grows up from the floor of the group.
 */
export interface SolidBlock {
  u0: number
  u1: number
  v0: number
  v1: number
  z0: number
  z1: number
}

function laidBoxes(
  cabinet: { typeId: string; params: Record<string, unknown> },
  catalog: { id: string; typeId: string; params: Record<string, unknown> }[],
): LaidBox[] | null {
  const one = (typeId: string, params: Record<string, unknown>, x: number, y: number): LaidBox => {
    const size = cabinetOuterSize(typeId, params)
    return { x, y, w: size.w, h: size.h + size.feet, d: size.d }
  }
  if (!isCombinationType(cabinet.typeId)) return [one(cabinet.typeId, cabinet.params, 0, 0)]
  const parsed = parseCombination(cabinet.params)
  if (!parsed) return null
  const host = catalog.find((item) => item.id === parsed.hostId)
  if (!host || isCombinationType(host.typeId)) return null
  const guests = parsed.members.flatMap((member) => {
    if (member.place === 'host') return []
    const item = catalog.find((row) => row.id === member.cabinetId)
    if (!item || isCombinationType(item.typeId)) return []
    return [{ place: member.place, size: cabinetOuterSize(item.typeId, item.params) }]
  })
  const hostSize = cabinetOuterSize(host.typeId, host.params)
  const laid = arrangeMany(hostSize, guests)
  return [
    { x: laid.host.x, y: laid.host.y, w: hostSize.w, h: hostSize.h + hostSize.feet, d: hostSize.d },
    ...guests.map((guest, index) => ({
      x: laid.guests[index]!.x,
      y: laid.guests[index]!.y,
      w: guest.size.w,
      h: guest.size.h + guest.size.feet,
      d: guest.size.d,
    })),
  ]
}

/** Outer box of one cabinet, or of a whole combination. Feet are included in the height of a combination. */
export function groupOuterSize(
  cabinet: { typeId: string; params: Record<string, unknown> },
  catalog: { id: string; typeId: string; params: Record<string, unknown> }[],
): CabinetSize | null {
  const boxes = laidBoxes(cabinet, catalog)
  if (!boxes || boxes.length === 0) return null
  if (!isCombinationType(cabinet.typeId)) return cabinetOuterSize(cabinet.typeId, cabinet.params)
  const minX = Math.min(...boxes.map((box) => box.x))
  const maxX = Math.max(...boxes.map((box) => box.x + box.w))
  const minY = Math.min(...boxes.map((box) => box.y))
  const maxY = Math.max(...boxes.map((box) => box.y + box.h))
  return {
    w: maxX - minX,
    h: maxY - minY,
    d: Math.max(...boxes.map((box) => box.d)),
    feet: 0,
    doorTop: 0,
    doorPlinth: 0,
  }
}

/** Each box that actually occupies space. Fronts line up, so a shallower upper cabinet stays forward. */
export function groupSolidBlocks(
  cabinet: { typeId: string; params: Record<string, unknown> },
  catalog: { id: string; typeId: string; params: Record<string, unknown> }[],
): SolidBlock[] | null {
  const boxes = laidBoxes(cabinet, catalog)
  if (!boxes || boxes.length === 0) return null
  const minX = Math.min(...boxes.map((box) => box.x))
  const floor = Math.max(...boxes.map((box) => box.y + box.h))
  return boxes.map((box) => ({
    u0: box.x - minX,
    u1: box.x - minX + box.w,
    v0: 0,
    v1: box.d,
    z0: floor - (box.y + box.h),
    z1: floor - box.y,
  }))
}

function doorFace(size: CabinetSize, spot: GroupSpot): { top: number; bot: number } {
  const top = spot.y + size.doorTop
  return { top, bot: Math.max(top + 1, spot.y + size.h - size.doorPlinth) }
}

/** The front the two cabinets share, as if they were one cabinet. The plinth stays below the door. */
export function spanFrontBox(
  host: CabinetSize,
  guest: CabinetSize,
  place: CabinetPlace,
  hostSpot: GroupSpot,
  guestSpot: GroupSpot,
): { x: number; y: number; w: number; h: number } {
  const hostFace = doorFace(host, hostSpot)
  const guestFace = doorFace(guest, guestSpot)
  if (place === 'above' || place === 'below') {
    const upper = place === 'above' ? guestFace : hostFace
    const lower = place === 'above' ? hostFace : guestFace
    return {
      x: hostSpot.x,
      y: upper.top,
      w: Math.min(host.w, guest.w),
      h: Math.max(1, lower.bot - upper.top),
    }
  }
  const top = Math.min(hostFace.top, guestFace.top)
  const bot = Math.max(hostFace.bot, guestFace.bot)
  return {
    x: Math.min(hostSpot.x, guestSpot.x),
    y: top,
    w: host.w + guest.w,
    h: Math.max(1, bot - top),
  }
}

export interface GroupSpot {
  x: number
  y: number
  hideFeet: boolean
}

/**
 * The edge that faces the other cabinet sits on that cabinet's edge.
 * Above: the new box's bottom, legs included, rests on the top of the one under it.
 * Below: the new box's top starts at the bottom of the one above it, legs included.
 * The shared line stays apart by the outline, so one edge does not cover the other.
 * Left and right: the facing sides touch, and the feet share one floor.
 */
export function arrangeMany(
  host: CabinetSize,
  guests: { size: CabinetSize; place: CabinetPlace }[],
): { host: GroupSpot; guests: GroupSpot[] } {
  const tagged = guests.map((guest, index) => ({ ...guest, index }))
  const lefts = tagged.filter((guest) => guest.place === 'left')
  const rights = tagged.filter((guest) => guest.place === 'right')
  const aboves = tagged.filter((guest) => guest.place === 'above')
  const belows = tagged.filter((guest) => guest.place === 'below')
  const floor = Math.max(
    host.h + host.feet,
    ...lefts.map((guest) => guest.size.h + guest.size.feet),
    ...rights.map((guest) => guest.size.h + guest.size.feet),
  )
  const spots: GroupSpot[] = guests.map(() => ({ x: 0, y: 0, hideFeet: false }))
  let x = 0
  for (const guest of [...lefts].reverse()) {
    spots[guest.index] = { x, y: floor - (guest.size.h + guest.size.feet), hideFeet: false }
    x += guest.size.w
  }
  const hostSpot: GroupSpot = { x, y: floor - (host.h + host.feet), hideFeet: false }
  x += host.w
  for (const guest of rights) {
    spots[guest.index] = { x, y: floor - (guest.size.h + guest.size.feet), hideFeet: false }
    x += guest.size.w
  }
  let seat = hostSpot.y
  for (const guest of aboves) {
    const y = seat - guest.size.h - guest.size.feet - EDGE_MEET_MM
    spots[guest.index] = { x: hostSpot.x, y, hideFeet: false }
    seat = y
  }
  let belowTop = hostSpot.y + host.h + host.feet + EDGE_MEET_MM
  for (const guest of belows) {
    spots[guest.index] = { x: hostSpot.x, y: belowTop, hideFeet: false }
    belowTop += guest.size.h + guest.size.feet + EDGE_MEET_MM
  }
  return { host: hostSpot, guests: spots }
}

/** Where each drawing sits in the shared picture, after the padding is pulled back. */
export function stageBoxes(spots: { x: number; y: number; frame: DrawFrame }[]) {
  const placed = spots.map((spot) => ({
    left: spot.x - spot.frame.ox,
    top: spot.y - spot.frame.top,
    frame: spot.frame,
  }))
  const minL = Math.min(...placed.map((box) => box.left))
  const minT = Math.min(...placed.map((box) => box.top))
  const maxR = Math.max(...placed.map((box) => box.left + box.frame.vbW))
  const maxB = Math.max(...placed.map((box) => box.top + box.frame.vbH))
  const ox = -minL
  const oy = -minT
  return {
    boxes: placed.map((box) => ({ left: box.left + ox, top: box.top + oy })),
    width: maxR - minL,
    height: maxB - minT,
    originX: ox,
    originY: oy,
  }
}

export function joinScrewCount(place: CabinetPlace, host: CabinetSize, guest: CabinetSize): number {
  const span = place === 'left' || place === 'right' ? Math.min(host.h + host.feet, guest.h + guest.feet) : Math.min(host.w, guest.w)
  return Math.max(2, confirmatCount(span))
}

/** Equal doors covering both boxes, the same way one cabinet gets its doors. */
export function spanDoorPanel(
  openingW: number,
  openingH: number,
  count: number,
  finishId = '',
): GeneratedPanel {
  const leaves = Math.max(1, Math.min(12, Math.round(count)))
  const cut = doorCutSize(openingW, openingH, leaves)
  return {
    role: 'door',
    name: 'Врата на двата шкафа',
    width: Math.round(cut.width * 10) / 10,
    height: Math.round(cut.height * 10) / 10,
    quantity: leaves,
    canRotate: false,
    edges: { top: true, bottom: true, left: true, right: true, thickness: 'mm2' },
    ...(finishId ? { finishId } : {}),
    note: `${leaves === 1 ? 'Една врата' : `${leaves} врати`} върху двата шкафа като върху един. Отвор ${formatMm(openingW)} × ${formatMm(openingH)} мм. Кант 2 мм от четирите страни.`,
  }
}

export function withAttachments(
  result: CabinetGeneratorResult,
  attached: AttachedCabinet[],
  host: CabinetSize,
  guests: CabinetSize[],
  hardwareSettings: HardwareSettings,
  frontFinishId = '',
): CabinetGeneratorResult {
  const hardware = [...result.hardware]
  const panels = [...result.panels]
  const notes = [...result.notes]
  const laid = arrangeMany(
    host,
    attached.map((row, index) => ({ size: guests[index] ?? host, place: row.place })),
  )
  let screws = 0
  attached.forEach((row, index) => {
    const guest = guests[index]
    if (!guest) return
    if (row.joinScrews) {
      const count = joinScrewCount(row.place, host, guest)
      screws += count
      notes.push(`Винтчета 4×30: ${count} бр. — хващат този шкаф с добавения до него.`)
    }
    const leaves = spanDoorCountOf(row)
    if (leaves > 0 && attachmentTouchesHost(attached, index)) {
      const opening = spanFrontBox(host, guest, row.place, laid.host, laid.guests[index]!)
      const door = spanDoorPanel(opening.w, opening.h, leaves, frontFinishId)
      panels.push(door)
      const hinges = hingesForDoorHeight(door.height) * leaves
      hardware.push(
        fastenerLine(
          { ...SCREW_4X16, packPriceEur: hardwareSettings.smallScrew1000PackEur },
          hinges * SCREWS_4X16_PER_HINGE,
          'Панти на общите врати',
        ),
      )
      hardware.push(
        fastenerLine(
          { ...SCREW_4X20, packPriceEur: hardwareSettings.smallScrew1000PackEur },
          hinges * SCREWS_4X20_PER_HINGE,
          'Панти на общите врати',
        ),
      )
      notes.push(
        `${leaves === 1 ? 'Една врата' : `${leaves} врати`} отгоре до долу на двата шкафа: рязане ${formatMm(door.height)} × ${formatMm(door.width)} мм. Панти: ${hinges} бр.`,
      )
    }
  })
  if (screws > 0) {
    hardware.push(
      fastenerLine(
        { ...SCREW_4X30, packPriceEur: hardwareSettings.smallScrew1000PackEur },
        screws,
        'Между шкафовете',
      ),
    )
  }
  return { ...result, hardware, panels, notes }
}
