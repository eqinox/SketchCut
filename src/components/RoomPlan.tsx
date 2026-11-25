import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Palette, Redo2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectColors } from '@/components/ProjectColors'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DraftNumber } from '@/components/DraftNumber'
import { groupOuterSize, groupSolidBlocks } from '@/lib/cabinets/compose'
import { CABINET_TYPES, getCabinetType } from '@/lib/cabinets'
import {
  ROOM_WALL_MM,
  boxesOverlap,
  chainStations,
  clampPiece,
  defaultLift,
  pieceSpan,
  type RoomPiece,
  type RoomPlan,
} from '@/lib/room'
import { formatMm, generateId } from '@/lib/utils'
import type { BoardFinish } from '@/lib/board-finishes'
import { RoomPhoto } from '@/components/RoomPhoto'
import { RoomLink } from '@/components/RoomLink'
import {
  OPENING_NAME,
  OPENING_SWATCHES,
  WALL_NAME,
  clampOpening,
  openingColor,
  openingsIn,
  alongForFar,
  openingFar,
  wallAlongLabel,
  wallFarLabel,
  type RoomOpening,
  type RoomOpeningKind,
  type RoomWall,
} from '@/lib/room-openings'
import type { CabinetInstance } from '@/types'

const FLOORS = [
  { name: 'Дъб', color: '#c4a574' },
  { name: 'Бук', color: '#e6c39a' },
  { name: 'Сив', color: '#b9b3a8' },
  { name: 'Бял', color: '#f5f5f4' },
]
const WALLS = [
  { name: 'Бяло', color: '#f7f5f2' },
  { name: 'Крем', color: '#f3efe6' },
  { name: 'Сиво', color: '#d9d6d0' },
  { name: 'Топло', color: '#e7d7c4' },
]

const PAD_L = 520
const PAD_R = 160
const PAD_T = 120
const PAD_B = 420
const FONT = 78
const INNER_X = PAD_L + ROOM_WALL_MM
const INNER_Y = PAD_T + ROOM_WALL_MM

function openingRect(room: { width: number; depth: number }, opening: RoomOpening) {
  const along = opening.along
  const span = opening.span
  const pocket = opening.kind === 'niche' ? Math.max(ROOM_WALL_MM, opening.depth) : ROOM_WALL_MM
  if (opening.wall === 'front') return { x: INNER_X + along, y: INNER_Y + room.depth, w: span, h: pocket }
  if (opening.wall === 'back') return { x: INNER_X + along, y: INNER_Y - pocket, w: span, h: pocket }
  if (opening.wall === 'left') return { x: INNER_X - pocket, y: INNER_Y + room.depth - along - span, w: pocket, h: span }
  return { x: INNER_X + room.width, y: INNER_Y + room.depth - along - span, w: pocket, h: span }
}

function wallAt(localX: number, localY: number, width: number, depth: number): { wall: RoomWall; dist: number } {
  const bands: { wall: RoomWall; x: number; y: number; w: number; h: number; dist: number }[] = [
    { wall: 'front', x: INNER_X, y: INNER_Y + depth, w: width, h: ROOM_WALL_MM, dist: Math.abs(localY - (INNER_Y + depth)) },
    { wall: 'back', x: INNER_X, y: PAD_T, w: width, h: ROOM_WALL_MM, dist: Math.abs(localY - INNER_Y) },
    { wall: 'left', x: PAD_L, y: INNER_Y, w: ROOM_WALL_MM, h: depth, dist: Math.abs(localX - INNER_X) },
    { wall: 'right', x: INNER_X + width, y: INNER_Y, w: ROOM_WALL_MM, h: depth, dist: Math.abs(localX - (INNER_X + width)) },
  ]
  const inside = bands.find(
    (band) => localX >= band.x && localX <= band.x + band.w && localY >= band.y && localY <= band.y + band.h,
  )
  if (inside) return { wall: inside.wall, dist: 0 }
  const nearest = bands.reduce((best, band) => (band.dist < best.dist ? band : best))
  return { wall: nearest.wall, dist: nearest.dist }
}

function nearestWall(localX: number, localY: number, width: number, depth: number): RoomWall {
  return wallAt(localX, localY, width, depth).wall
}

function strokeOf(kind: RoomOpeningKind, roomHeight: number) {
  if (kind === 'door') return { height: Math.min(2100, Math.max(120, roomHeight - 40)), sill: 0, depth: 0 }
  if (kind === 'niche') return { height: 600, sill: 1100, depth: 220 }
  return { height: 1400, sill: 900, depth: 0 }
}

function pointerAlong(wall: RoomWall, localX: number, localY: number, depth: number) {
  if (wall === 'front' || wall === 'back') return localX - INNER_X
  return INNER_Y + depth - localY
}

interface Placed {
  piece: RoomPiece
  name: string
  w: number
  d: number
  h: number
}

function fitted(label: string, span: number): number {
  let size = FONT
  while (size > 28 && label.length * size * 0.58 > span) size -= 10
  return size
}

/** The word sits on the opening. A tall narrow mark turns the word so it can be read. */
function OpeningLabel({ x, y, w, h, label }: { x: number; y: number; w: number; h: number; label: string }) {
  const along = Math.max(w, h)
  const across = Math.min(w, h)
  if (along < 70) return null
  const size = Math.min(fitted(label, along - 16), Math.max(28, across * 0.7))
  const cx = x + w / 2
  const cy = y + h / 2
  const turn = h > w
  return (
    <text
      pointerEvents="none"
      x={cx}
      y={cy}
      fill="#1e293b"
      fontSize={size}
      fontWeight={600}
      textAnchor="middle"
      dominantBaseline="middle"
      transform={turn ? `rotate(-90 ${cx} ${cy})` : undefined}
    >
      {label}
    </text>
  )
}

function DimRun({
  x,
  y,
  along,
  from,
  stations,
  horizontal,
}: {
  x: number
  y: number
  along: (station: number) => { x: number; y: number }
  from: (station: number) => { x: number; y: number }
  stations: number[]
  horizontal: boolean
}) {
  if (stations.length < 2) return null
  const ends = stations.map(along)
  const line = horizontal
    ? { x1: ends[0]!.x, y1: y, x2: ends[ends.length - 1]!.x, y2: y }
    : { x1: x, y1: ends[0]!.y, x2: x, y2: ends[ends.length - 1]!.y }
  return (
    <g fill="#1e293b" stroke="#1e293b" strokeWidth={1.6}>
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} fill="none" />
      {stations.map((station, i) => {
        const p = along(station)
        const origin = from(station)
        const tick = horizontal
          ? { x1: p.x, y1: y - 14, x2: p.x, y2: y + 14 }
          : { x1: x - 14, y1: p.y, x2: x + 14, y2: p.y }
        const prev = i > 0 ? stations[i - 1]! : null
        const label = prev != null ? formatMm(station - prev) : null
        const span = prev != null ? station - prev : 0
        const size = label ? fitted(label, span) : FONT
        const mid = prev != null ? along((prev + station) / 2) : null
        return (
          <g key={station}>
            <line x1={origin.x} y1={origin.y} x2={horizontal ? p.x : x} y2={horizontal ? y : p.y} fill="none" />
            <line x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} fill="none" />
            {label && mid && (
              <text
                x={horizontal ? mid.x : x - 22}
                y={horizontal ? y - 22 : mid.y}
                fontSize={size}
                textAnchor={horizontal ? 'middle' : 'end'}
                dominantBaseline="middle"
                stroke="#ffffff"
                strokeWidth={Math.max(8, size * 0.28)}
                paintOrder="stroke"
              >
                {label}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

export function RoomPlanView({
  room,
  cabinets,
  finishes,
  userId,
  onChange,
  onEditCabinet,
  onCreateCabinet,
  onRemoveCabinet,
  onSwapColor,
  projectPriceEur,
  onUndo,
  onRedo,
  undoCount = 0,
}: {
  room: RoomPlan
  cabinets: CabinetInstance[]
  finishes: BoardFinish[]
  userId: string | null
  onChange: (room: RoomPlan) => void
  /** Opens the full cabinet form for this cabinet id. */
  onEditCabinet?: (cabinetId: string) => void
  /** Adds a cabinet drawn on the plan and stands it at the drawn spot. */
  onCreateCabinet?: (input: { typeId: string; params: Record<string, unknown> }, piece: Omit<RoomPiece, 'cabinetId'>) => void
  /** Removes a cabinet from the project list (and so from cutting and price). */
  onRemoveCabinet?: (cabinetId: string) => void
  /** Puts one board colour in place of another across the whole project. */
  onSwapColor?: (from: string, to: string) => void
  /** The whole project's price, so a colour change shows what it costs. */
  projectPriceEur?: number | null
  /** Steps back one change. Missing when there is nothing to undo. */
  onUndo?: () => void
  /** Puts back a change that was undone. Missing when there is nothing to redo. */
  onRedo?: () => void
  /** How many steps can be undone, shown on the button. */
  undoCount?: number
}) {
  const [pen, setPen] = useState<RoomOpeningKind | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null)
  const [pick, setPick] = useState('')
  const [note, setNote] = useState('')
  // Plan and 3D side by side, like PRO100. The 3D starts hidden: it keeps the computer busy while it is on.
  const [showPhoto, setShowPhoto] = useState(false)
  // Full-screen design mode: the same room and cabinets, laid out like a drawing program.
  const [studio, setStudio] = useState(false)
  // Arrow keys, Page Up/Down and Delete act on the selected cabinet. Filled in after each render.
  const studioKey = useRef<(event: KeyboardEvent) => void>(() => {})
  /** Room piece waiting for the «only the room, or the list too» answer. */
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [view, setView] = useState<'2d' | 'both' | '3d'>('both')
  // The side panel shows the project's colours instead of the selected cabinet.
  const [showColors, setShowColors] = useState(false)
  // «Начертай шкаф»: a rectangle dragged on the plan, in room mm. `live` while the button is held.
  const [drawCabinet, setDrawCabinet] = useState(false)
  const [sketch, setSketch] = useState<(Sketch & { live: boolean }) | null>(null)
  useEffect(() => {
    if (!studio) return
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      // A cabinet form opened from here closes itself first.
      if (document.querySelector('[role="dialog"]')) return
      if (event.key === 'Escape') {
        setStudio(false)
        return
      }
      studioKey.current(event)
    }
    // Capture phase: this runs before the form's own Escape handler removes the form.
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.body.style.overflow = before
      window.removeEventListener('keydown', onKey, true)
    }
  }, [studio])
  const svgRef = useRef<SVGSVGElement | null>(null)
  const planRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null)
  const openingDrag = useRef<
    | { mode: 'move'; id: string; grab: number; span: number; height: number }
    | { mode: 'draw'; kind: RoomOpeningKind; wall: RoomWall; start: number; from: number; height: number; sill: number; depth: number; span: number }
    | null
  >(null)
  const penRef = useRef<RoomOpeningKind | null>(null)
  const stopDrag = useRef<(() => void) | null>(null)

  const byId = useMemo(() => new Map(cabinets.map((cabinet) => [cabinet.id, cabinet])), [cabinets])

  const placed = useMemo(() => {
    const rows: Placed[] = []
    for (const piece of room.pieces) {
      const cabinet = byId.get(piece.cabinetId)
      const outer = cabinet ? groupOuterSize(cabinet, cabinets) : null
      if (!cabinet || !outer) continue
      const box = pieceSpan(piece.turn, outer.w, outer.d)
      rows.push({
        piece,
        name: cabinet.name || 'Шкаф',
        w: box.w,
        d: box.d,
        h: outer.h + outer.feet,
      })
    }
    return rows
  }, [room.pieces, byId, cabinets])

  useEffect(() => {
    const live = new Set(cabinets.filter((cabinet) => groupOuterSize(cabinet, cabinets)).map((cabinet) => cabinet.id))
    const pieces = room.pieces.flatMap((piece) => {
      if (!live.has(piece.cabinetId)) return []
      const cabinet = byId.get(piece.cabinetId)
      const outer = cabinet ? groupOuterSize(cabinet, cabinets) : null
      if (!cabinet || !outer) return []
      return [clampPiece(room, piece, { w: outer.w, d: outer.d, h: outer.h + outer.feet }, groupSolidBlocks(cabinet, cabinets) ?? undefined)]
    })
    const same =
      pieces.length === room.pieces.length &&
      pieces.every((piece, index) => {
        const prev = room.pieces[index]
        return (
          !!prev &&
          prev.id === piece.id &&
          prev.x === piece.x &&
          prev.y === piece.y &&
          prev.lift === piece.lift &&
          prev.turn === piece.turn
        )
      })
    if (same) return
    onChange({ ...room, pieces })
  }, [byId, cabinets, room, onChange])

  const choices = cabinets.filter((cabinet) => groupOuterSize(cabinet, cabinets))

  const setRoom = (next: RoomPlan) => {
    const clamped: RoomPlan = {
      ...next,
      pieces: next.pieces.flatMap((piece) => {
        const cabinet = byId.get(piece.cabinetId)
        const outer = cabinet ? groupOuterSize(cabinet, cabinets) : null
        if (!cabinet || !outer) return []
        return [clampPiece(next, piece, { w: outer.w, d: outer.d, h: outer.h + outer.feet }, groupSolidBlocks(cabinet, cabinets) ?? undefined)]
      }),
    }
    onChange(clamped)
  }

  const patchPiece = (id: string, patch: Partial<RoomPiece>) => {
    const current = placed.find((row) => row.piece.id === id)
    if (!current) return
    const next = { ...current.piece, ...patch }
    const cabinet = byId.get(next.cabinetId)
    const outer = cabinet ? groupOuterSize(cabinet, cabinets) : null
    if (!cabinet || !outer) return
    const seated = clampPiece(room, next, { w: outer.w, d: outer.d, h: outer.h + outer.feet }, groupSolidBlocks(cabinet, cabinets) ?? undefined)
    const box = pieceSpan(seated.turn, outer.w, outer.d)
    const wantedOut =
      next.x < -1 ||
      next.y < -1 ||
      next.x + box.w > room.width + 1 ||
      next.y + box.d > room.depth + 1
    const entered =
      seated.x < -1 ||
      seated.y < -1 ||
      seated.x + box.w > room.width + 1 ||
      seated.y + box.d > room.depth + 1
    // Two pieces clash only when they share floor area and height too: a wall cabinet can hang above a base one.
    const tall = outer.h + outer.feet
    const hit = placed.some(
      (row) =>
        row.piece.id !== id &&
        boxesOverlap({ x: seated.x, y: seated.y, w: box.w, d: box.d }, { x: row.piece.x, y: row.piece.y, w: row.w, d: row.d }) &&
        seated.lift < row.piece.lift + row.h &&
        row.piece.lift < seated.lift + tall,
    )
    if (hit) {
      setNote('Там вече има мебел.')
      return
    }
    setNote(
      wantedOut && !entered
        ? 'Шкафът не влиза в нишата. Частта, която опира в стената, трябва да се събере в отвора.'
        : '',
    )
    onChange({ ...room, pieces: room.pieces.map((piece) => (piece.id === id ? seated : piece)) })
  }

  const addPiece = () => {
    const cabinet = byId.get(pick)
    const outer = cabinet ? groupOuterSize(cabinet, cabinets) : null
    if (!cabinet || !outer) return
    const lift = defaultLift(cabinet.typeId, outer.h + outer.feet, room.height)
    const draft: RoomPiece = { id: generateId(), cabinetId: cabinet.id, x: 0, y: 0, lift, turn: 0 }
    const nicheRoom = openingsIn(room).some((opening) => {
      if (opening.kind !== 'niche') return false
      const along = opening.wall === 'left' || opening.wall === 'right' ? outer.d : outer.w
      const cross = opening.wall === 'left' || opening.wall === 'right' ? outer.w : outer.d
      const roomCross = opening.wall === 'left' || opening.wall === 'right' ? room.width : room.depth
      return along <= opening.span + 1 && outer.h + outer.feet <= opening.height + 1 && cross <= roomCross + opening.depth + 1
    })
    if ((outer.w > room.width || outer.d > room.depth || outer.h + outer.feet > room.height) && !nicheRoom) {
      setNote('Мебелът е по-голям от стаята.')
      return
    }
    const blocks = groupSolidBlocks(cabinet, cabinets) ?? undefined
    let seat = clampPiece(room, draft, { w: outer.w, d: outer.d, h: outer.h + outer.feet }, blocks)
    const step = 100
    let found = false
    for (let y = 0; y <= room.depth - outer.d && !found; y += step) {
      for (let x = 0; x <= room.width - outer.w && !found; x += step) {
        const trial = { ...seat, x, y }
        const blocked = placed.some((row) =>
          boxesOverlap({ x, y, w: outer.w, d: outer.d }, { x: row.piece.x, y: row.piece.y, w: row.w, d: row.d }),
        )
        if (!blocked) {
          seat = trial
          found = true
        }
      }
    }
    if (!found) {
      const height = outer.h + outer.feet
      for (const opening of openingsIn(room)) {
        if (opening.kind !== 'niche' || found) continue
        const side = opening.wall === 'left' || opening.wall === 'right'
        const alongSize = side ? outer.d : outer.w
        const along = opening.along + Math.max(0, Math.round((opening.span - Math.min(alongSize, opening.span)) / 2))
        const into = opening.depth
        const at =
          opening.wall === 'front'
            ? { x: along, y: -into }
            : opening.wall === 'back'
              ? { x: along, y: room.depth - outer.d + into }
              : opening.wall === 'left'
                ? { x: -into, y: along }
                : { x: room.width - outer.w + into, y: along }
        const trial = clampPiece(room, { ...draft, ...at }, { w: outer.w, d: outer.d, h: height }, blocks)
        const pushed =
          trial.x < -1 || trial.y < -1 || trial.x + outer.w > room.width + 1 || trial.y + outer.d > room.depth + 1
        if (!pushed) continue
        const blocked = placed.some((row) =>
          boxesOverlap({ x: trial.x, y: trial.y, w: outer.w, d: outer.d }, { x: row.piece.x, y: row.piece.y, w: row.w, d: row.d }),
        )
        if (!blocked) {
          seat = trial
          found = true
        }
      }
    }
    if (!found && placed.length > 0) {
      setNote('Няма свободно място на стъпка 100 мм. Премести нещо и опитай пак.')
      return
    }
    setNote('')
    setSelected(seat.id)
    setSelectedOpening(null)
    onChange({ ...room, pieces: [...room.pieces, seat] })
  }

  const planW = PAD_L + ROOM_WALL_MM * 2 + room.width + PAD_R
  const planH = PAD_T + ROOM_WALL_MM * 2 + room.depth + PAD_B
  const elevW = PAD_L + ROOM_WALL_MM * 2 + room.width + PAD_R
  const elevH = PAD_T + room.height + PAD_B

  const placedRef = useRef(placed)
  const roomRef = useRef(room)
  const patchRef = useRef(patchPiece)
  const openings = openingsIn(room)
  const nichePast = { left: 0, right: 0, front: 0, back: 0 }
  for (const opening of openings) {
    if (opening.kind !== 'niche') continue
    nichePast[opening.wall] = Math.max(nichePast[opening.wall], opening.depth)
  }
  const planBleed = {
    l: Math.max(0, nichePast.left - PAD_L - ROOM_WALL_MM),
    r: Math.max(0, nichePast.right - PAD_R - ROOM_WALL_MM),
    t: Math.max(0, nichePast.back - PAD_T - ROOM_WALL_MM),
    b: Math.max(0, nichePast.front - PAD_B - ROOM_WALL_MM),
  }
  const planView = `-${planBleed.l} -${planBleed.t} ${planW + planBleed.l + planBleed.r} ${planH + planBleed.t + planBleed.b}`
  const openingsRef = useRef(openings)
  placedRef.current = placed
  roomRef.current = room
  patchRef.current = patchPiece
  openingsRef.current = openings
  penRef.current = pen

  const patchOpening = (id: string, part: Partial<RoomOpening>) => {
    const current = roomRef.current
    onChange({
      ...current,
      openings: openingsIn(current).map((item) =>
        item.id === id ? clampOpening(current, { ...item, ...part }) : item,
      ),
    })
  }
  const patchOpeningRef = useRef(patchOpening)
  patchOpeningRef.current = patchOpening

  const commitOpenings = (list: RoomOpening[]) => {
    onChange({ ...roomRef.current, openings: list })
  }
  const commitRef = useRef(commitOpenings)
  commitRef.current = commitOpenings

  const removeOpening = (id: string) => {
    const current = roomRef.current
    onChange({ ...current, openings: openingsIn(current).filter((item) => item.id !== id) })
    setSelectedOpening((currentId) => (currentId === id ? null : currentId))
  }

  useEffect(() => {
    const plan = planRef.current
    if (!plan) return
    const keepFinger = (event: TouchEvent) => {
      if (drag.current || openingDrag.current) event.preventDefault()
    }
    plan.addEventListener('touchmove', keepFinger, { passive: false })
    return () => {
      plan.removeEventListener('touchmove', keepFinger)
      stopDrag.current?.()
    }
    // The plan box is a new element when the design mode opens or the view changes.
  }, [studio, view])

  const svgPoint = (event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = event.clientX
    pt.y = event.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const local = pt.matrixTransform(ctm.inverse())
    return { x: local.x, y: local.y }
  }

  /** Drag a rectangle on the plan. Sizes snap to 10 mm and stay inside the room. */
  const startSketch = (event: PointerEvent) => {
    event.preventDefault()
    const current = roomRef.current
    const snap = (value: number, max: number) => Math.max(0, Math.min(max, Math.round(value / 10) * 10))
    const toRoom = (at: { clientX: number; clientY: number }) => {
      const local = svgPoint(at)
      return { x: snap(local.x - INNER_X, current.width), y: snap(current.depth - (local.y - INNER_Y), current.depth) }
    }
    const boxOf = (a: { x: number; y: number }, b: { x: number; y: number }): Sketch => ({
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(a.x - b.x),
      d: Math.abs(a.y - b.y),
    })
    const start = toRoom(event)
    setSketch({ ...boxOf(start, start), live: true })
    setSelected(null)
    setSelectedOpening(null)
    const move = (next: globalThis.PointerEvent) => setSketch({ ...boxOf(start, toRoom(next)), live: true })
    const up = (next: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      const box = boxOf(start, toRoom(next))
      if (box.w < 100 || box.d < 100) {
        setSketch(null)
        setNote('Дръпни по-голям правоъгълник — поне 10 × 10 см.')
        return
      }
      setNote('')
      setSketch({ ...box, live: false })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const createSketched = (typeId: string, size: { w: number; d: number; h: number }, turn: 0 | 1 | 2 | 3) => {
    if (!sketch || !onCreateCabinet) return
    const type = getCabinetType(typeId)
    if (!type) return
    const id = generateId()
    onCreateCabinet(
      { typeId, params: { ...structuredClone(type.defaultParams), width: size.w, depth: size.d, height: size.h } },
      { id, x: sketch.x, y: sketch.y, lift: defaultLift(typeId, size.h, room.height), turn },
    )
    setSketch(null)
    setDrawCabinet(false)
    setSelected(id)
  }

  const onPlanPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (drawCabinet) {
      startSketch(event)
      return
    }
    const local = svgPoint(event)
    const depth = roomRef.current.depth
    const row = [...placedRef.current].reverse().find((item) => {
      const sx = INNER_X + item.piece.x
      const sy = INNER_Y + (depth - item.piece.y - item.d)
      return local.x >= sx && local.x <= sx + item.w && local.y >= sy && local.y <= sy + item.d
    })
    const opening = row
      ? undefined
      : [...openingsRef.current].reverse().find((item) => {
          if (item.id === '__draft__') return false
          const box = openingRect(roomRef.current, item)
          const pad = 40
          return (
            local.x >= box.x - pad &&
            local.x <= box.x + box.w + pad &&
            local.y >= box.y - pad &&
            local.y <= box.y + box.h + pad
          )
        })
    const kind = !opening && !row ? penRef.current : null
    const spot = kind ? wallAt(local.x, local.y, roomRef.current.width, depth) : null
    const drawing = Boolean(kind && spot && spot.dist <= ROOM_WALL_MM + 160)
    if (!opening && !row && !drawing) return
    event.preventDefault()
    stopDrag.current?.()
    const pointerId = event.pointerId
    const plan = event.currentTarget as Element
    try {
      plan.setPointerCapture(pointerId)
    } catch {
      // iPhone follows the finger through the window listeners below.
    }
    if (opening) {
      const along = pointerAlong(opening.wall, local.x, local.y, depth)
      openingDrag.current = {
        mode: 'move',
        id: opening.id,
        grab: along - opening.along,
        span: opening.span,
        height: opening.height,
      }
      drag.current = null
      setSelected(null)
      setSelectedOpening(opening.id)
    } else if (row) {
      const sx = INNER_X + row.piece.x
      const sy = INNER_Y + (depth - row.piece.y - row.d)
      drag.current = { id: row.piece.id, ox: local.x - sx, oy: local.y - sy }
      openingDrag.current = null
      setSelected(row.piece.id)
      setSelectedOpening(null)
    } else if (kind && spot) {
      const along = pointerAlong(spot.wall, local.x, local.y, depth)
      const size = strokeOf(kind, roomRef.current.height)
      openingDrag.current = { mode: 'draw', kind, wall: spot.wall, start: along, from: along, span: 0, ...size }
      drag.current = null
      setSelected(null)
      setSelectedOpening(null)
    }
    const move = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      const heldOpening = openingDrag.current
      if (heldOpening?.mode === 'draw') {
        const point = svgPoint(ev)
        const live = roomRef.current
        const along = pointerAlong(heldOpening.wall, point.x, point.y, live.depth)
        const span = Math.abs(along - heldOpening.start)
        heldOpening.span = span
        heldOpening.from = Math.min(along, heldOpening.start)
        const draft = clampOpening(live, {
          id: '__draft__',
          kind: heldOpening.kind,
          wall: heldOpening.wall,
          along: Math.min(along, heldOpening.start),
          span,
          height: heldOpening.height,
          sill: heldOpening.kind === 'door' ? 0 : heldOpening.sill,
          depth: heldOpening.depth,
        })
        const others = openingsIn(live).filter((item) => item.id !== '__draft__')
        commitRef.current([...others, draft])
        return
      }
      if (heldOpening?.mode === 'move') {
        const point = svgPoint(ev)
        const live = roomRef.current
        const wall = nearestWall(point.x, point.y, live.width, live.depth)
        const along = pointerAlong(wall, point.x, point.y, live.depth) - heldOpening.grab
        patchOpeningRef.current(heldOpening.id, {
          wall,
          along,
          span: heldOpening.span,
          height: heldOpening.height,
        })
        return
      }
      const held = drag.current
      if (!held) return
      const current = placedRef.current.find((item) => item.piece.id === held.id)
      if (!current) return
      const point = svgPoint(ev)
      const x = point.x - held.ox - INNER_X
      const y = roomRef.current.depth - (point.y - held.oy - INNER_Y) - current.d
      patchRef.current(held.id, { x, y })
    }
    const up = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      const finished = openingDrag.current
      drag.current = null
      openingDrag.current = null
      stopDrag.current = null
      if (finished?.mode === 'draw' && finished.span > 0) {
        const live = roomRef.current
        const others = openingsIn(live).filter((item) => item.id !== '__draft__')
        if (finished.span < 180) {
          commitRef.current(others)
        } else {
          const id = generateId()
          const made = clampOpening(live, {
            id,
            kind: finished.kind,
            wall: finished.wall,
            along: finished.from,
            span: finished.span,
            height: finished.height,
            sill: finished.kind === 'door' ? 0 : finished.sill,
            depth: finished.depth,
          })
          commitRef.current([...others, made])
          setSelected(null)
          setSelectedOpening(id)
        }
      }
      const host = planRef.current
      if (host?.hasPointerCapture(pointerId)) {
        try {
          host.releasePointerCapture(pointerId)
        } catch {
          // The phone already dropped the pointer.
        }
      }
    }
    stopDrag.current = () => up(new PointerEvent('pointerup', { pointerId }))
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const xStations = chainStations(
    placed.map((row) => ({ a: row.piece.x, b: row.piece.x + row.w })),
    room.width,
  )
  const yStations = chainStations(
    placed.map((row) => ({ a: row.piece.y, b: row.piece.y + row.d })),
    room.depth,
  )

  const roomFields = (
    <>
      <SizeField label="Широчина" value={room.width} onChange={(width) => setRoom({ ...room, width })} />
      <SizeField label="Дълбочина" value={room.depth} onChange={(depth) => setRoom({ ...room, depth })} />
      <SizeField label="Височина" value={room.height} onChange={(height) => setRoom({ ...room, height })} />
      <ColorField
        label="Ламинат"
        value={room.floorColor}
        swatches={FLOORS}
        onChange={(floorColor) => onChange({ ...room, floorColor })}
      />
      <ColorField
        label="Стени"
        value={room.wallColor}
        swatches={WALLS}
        onChange={(wallColor) => onChange({ ...room, wallColor })}
      />
    </>
  )

  const cabinetPicker = (
    <select
      id="room-cabinet"
      aria-label="Мебел от проекта"
      className="mt-1 flex h-9 w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 text-sm"
      value={pick}
      onChange={(event) => setPick(event.target.value)}
    >
      <option value="">Избери шкаф</option>
      {choices.map((cabinet, index) => (
        <option key={cabinet.id} value={cabinet.id}>
          Ш{index + 1} · {cabinet.name}
        </option>
      ))}
    </select>
  )

  const penButtons = (size?: 'sm') =>
    (
      [
        ['window', 'Прозорец'],
        ['door', 'Врата'],
        ['niche', 'Ниша'],
      ] as const
    ).map(([kind, label]) => (
      <Button
        key={kind}
        type="button"
        size={size}
        variant={pen === kind ? 'default' : 'outline'}
        onClick={() => setPen((current) => (current === kind ? null : kind))}
      >
        {label}
      </Button>
    ))

  const planBox = (fill: boolean) => (
    <div
      ref={planRef}
      className={`overflow-hidden rounded-md border border-neutral-300 bg-white ${fill ? 'h-full min-h-0' : ''} ${
        drawCabinet ? 'cursor-crosshair [&_g]:!cursor-crosshair' : ''
      }`}
      style={{ touchAction: 'none' }}
      onPointerDown={onPlanPointerDown}
    >
      <svg
        ref={svgRef}
        viewBox={planView}
        className={`${fill ? 'h-full' : 'h-auto'} w-full select-none`}
        role="img"
        aria-label="Нареждане в стаята, изглед отгоре"
        style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      >
        <rect x={PAD_L} y={PAD_T} width={room.width + ROOM_WALL_MM * 2} height={room.depth + ROOM_WALL_MM * 2} fill={room.wallColor} stroke="#1e293b" strokeWidth={2} />
        <rect x={INNER_X} y={INNER_Y} width={room.width} height={room.depth} fill={room.floorColor} stroke="#1e293b" strokeWidth={2} />
        <OpeningMarks room={room} openings={openings} selectedId={selectedOpening} />
        <text x={INNER_X + room.width / 2} y={INNER_Y + room.depth + ROOM_WALL_MM + 70} fill="#1e293b" fontSize={64} textAnchor="middle">
          Отпред
        </text>
        {placed.map((row) => {
          const sx = INNER_X + row.piece.x
          const sy = INNER_Y + (room.depth - row.piece.y - row.d)
          const on = row.piece.id === selected
          return (
            <g key={row.piece.id} style={{ cursor: 'grab' }}>
              <rect
                x={sx}
                y={sy}
                width={row.w}
                height={row.d}
                fill={on ? '#fff7ed' : '#ffffff'}
                fillOpacity={0.92}
                stroke={on ? '#c2410c' : '#1e293b'}
                strokeWidth={on ? 8 : 3}
              />
              <text pointerEvents="none" x={sx + row.w / 2} y={sy + row.d / 2 - 16} fill="#1e293b" fontSize={fitted(row.name, row.w - 20)} textAnchor="middle">
                {row.name}
              </text>
              <text pointerEvents="none" x={sx + row.w / 2} y={sy + row.d / 2 + 56} fill="#1e293b" fontSize={fitted(`${formatMm(row.w)} × ${formatMm(row.d)}`, row.w - 20)} textAnchor="middle">
                {formatMm(row.w)} × {formatMm(row.d)}
              </text>
              <FrontMark turn={row.piece.turn} x={sx} y={sy} w={row.w} h={row.d} />
            </g>
          )
        })}
        {sketch && (
          <g pointerEvents="none">
            <rect
              x={INNER_X + sketch.x}
              y={INNER_Y + room.depth - sketch.y - sketch.d}
              width={Math.max(sketch.w, 1)}
              height={Math.max(sketch.d, 1)}
              fill="#fb923c"
              fillOpacity={0.25}
              stroke="#ea580c"
              strokeWidth={8}
              strokeDasharray="40 24"
            />
            {sketch.w >= 100 && sketch.d >= 100 && (
              <text
                x={INNER_X + sketch.x + sketch.w / 2}
                y={INNER_Y + room.depth - sketch.y - sketch.d / 2}
                fill="#9a3412"
                fontSize={fitted(`${formatMm(sketch.w)} × ${formatMm(sketch.d)}`, sketch.w - 20)}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {formatMm(sketch.w)} × {formatMm(sketch.d)}
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  )

  const photo = (heightClass: string, bare: boolean) => (
    <RoomPhoto
      room={room}
      cabinets={cabinets}
      finishes={finishes}
      onChange={onChange}
      pickedId={selected}
      onPick={(id) => {
        setSelected(id)
        if (id) setSelectedOpening(null)
      }}
      heightClass={heightClass}
      bare={bare}
      drawing={studio && drawCabinet}
      sketch={sketch}
      onSketch={(rect) => {
        if (rect.w < 100 || rect.d < 100) {
          setSketch(null)
          setNote('Дръпни по-голям правоъгълник по пода — поне 10 × 10 см.')
          return
        }
        setNote('')
        setSelected(null)
        setSelectedOpening(null)
        setSketch({ ...rect, live: false })
      }}
      onMovePiece={studio ? (id, x, y) => patchPiece(id, { x, y }) : undefined}
    />
  )

  const selectedRow = selected ? (placed.find((row) => row.piece.id === selected) ?? null) : null
  // Delete asks first: off the room only, or out of the project too (list, cutting, price).
  const removeSelected = () => {
    if (!selected) return
    setConfirmRemove(selected)
  }
  const removeFromRoom = (pieceId: string) => {
    onChange({ ...room, pieces: room.pieces.filter((piece) => piece.id !== pieceId) })
    setSelected((current) => (current === pieceId ? null : current))
    setConfirmRemove(null)
  }
  const removeEverywhere = (pieceId: string) => {
    const piece = room.pieces.find((item) => item.id === pieceId)
    if (!piece || !onRemoveCabinet) return
    // Every place this cabinet stands goes with it.
    onChange({ ...room, pieces: room.pieces.filter((item) => item.cabinetId !== piece.cabinetId) })
    onRemoveCabinet(piece.cabinetId)
    setSelected(null)
    setConfirmRemove(null)
  }
  const confirmPiece = confirmRemove ? (room.pieces.find((piece) => piece.id === confirmRemove) ?? null) : null
  const confirmCabinet = confirmPiece ? byId.get(confirmPiece.cabinetId) : undefined
  const otherSpots = confirmPiece
    ? room.pieces.filter((piece) => piece.cabinetId === confirmPiece.cabinetId && piece.id !== confirmPiece.id).length
    : 0
  const removeDialog = (
    <Dialog open={!!confirmPiece} onOpenChange={(open) => !open && setConfirmRemove(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Изтриване на «{confirmCabinet?.name || 'шкаф'}»</DialogTitle>
          <DialogDescription>
            Да го махна само от стаята, или и от списъка с шкафове? Ако го махнеш и от списъка, излиза и от разкроя и от цената.
            {otherSpots > 0 &&
              ` Същият шкаф стои още на ${otherSpots} ${otherSpots === 1 ? 'място' : 'места'} в стаята — при триене от списъка и те изчезват.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setConfirmRemove(null)}>
            Отказ
          </Button>
          <Button type="button" variant="outline" onClick={() => confirmPiece && removeFromRoom(confirmPiece.id)}>
            Само от стаята
          </Button>
          {onRemoveCabinet && (
            <Button type="button" variant="destructive" onClick={() => confirmPiece && removeEverywhere(confirmPiece.id)}>
              И от списъка
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )

  useEffect(() => {
    studioKey.current = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))) return
      // Ctrl+Z steps back, Ctrl+Y or Ctrl+Shift+Z steps forward again.
      if (event.ctrlKey || event.metaKey) {
        // By the key's place, not its letter, so it also works with the Bulgarian keyboard on.
        const isZ = event.code === 'KeyZ'
        const isY = event.code === 'KeyY'
        if (isZ || isY) {
          event.preventDefault()
          if (isY || event.shiftKey) onRedo?.()
          else onUndo?.()
          return
        }
      }
      if (!selectedRow) return
      const step = event.shiftKey ? 100 : 10
      const { x, y, lift } = selectedRow.piece
      const moves: Record<string, Partial<RoomPiece>> = {
        ArrowLeft: { x: x - step },
        ArrowRight: { x: x + step },
        ArrowUp: { y: y + step },
        ArrowDown: { y: y - step },
        PageUp: { lift: lift + step },
        PageDown: { lift: Math.max(0, lift - step) },
      }
      const move = moves[event.key]
      if (move) {
        event.preventDefault()
        patchPiece(selectedRow.piece.id, move)
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeSelected()
      }
    }
  })

  const pieceEditor = selected && (
    <PieceEditor
      row={selectedRow}
      roomWidth={room.width}
      roomDepth={room.depth}
      onPatch={(patch) => patchPiece(selected, patch)}
      onEdit={onEditCabinet}
      onRemove={removeSelected}
    />
  )

  const openingList = openings.some((opening) => opening.id !== '__draft__') && (
    <ul className="mt-3 space-y-2">
      {openings.filter((opening) => opening.id !== '__draft__').map((opening) => (
        <li key={opening.id} className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`inline-flex items-center gap-2 text-sm ${opening.id === selectedOpening ? 'font-semibold' : ''}`}
            onClick={() => {
              setSelected(null)
              setSelectedOpening(opening.id)
            }}
          >
            <span className="inline-block h-4 w-4 rounded border border-neutral-400" style={{ background: openingColor(opening) }} />
            {OPENING_NAME[opening.kind]} · {WALL_NAME[opening.wall]}
          </button>
          <Button type="button" size="sm" variant="ghost" onClick={() => removeOpening(opening.id)}>
            Изтрий
          </Button>
        </li>
      ))}
    </ul>
  )

  const openingEditor = selectedOpening && (
    <OpeningEditor
      opening={openings.find((opening) => opening.id === selectedOpening) ?? null}
      room={room}
      onPatch={(part) => patchOpening(selectedOpening, part)}
      onRemove={() => removeOpening(selectedOpening)}
    />
  )

  if (studio) {
    const showPlan = view !== '3d'
    const show3d = view !== '2d'
    return (
      <div
        className="fixed inset-0 z-40 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] bg-[var(--color-background)] text-[var(--color-foreground)]"
        role="region"
        aria-label="Проектиране"
      >
        <header className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
          <span className="mr-2 text-base font-semibold">Проектиране</span>
          {onCreateCabinet && (
            <Button
              type="button"
              size="sm"
              variant={drawCabinet ? 'default' : 'outline'}
              aria-pressed={drawCabinet}
              onClick={() => {
                const on = !drawCabinet
                setDrawCabinet(on)
                setPen(null)
                if (!on) setSketch(null)
              }}
            >
              Начертай шкаф
            </Button>
          )}
          <span className="mx-1 h-6 w-px bg-[var(--color-border)]" aria-hidden />
          <div className="w-56">{cabinetPicker}</div>
          <Button type="button" size="sm" className="mt-1" onClick={addPiece} disabled={!pick}>
            Сложи в стаята
          </Button>
          <span className="mx-1 h-6 w-px bg-[var(--color-border)]" aria-hidden />
          {penButtons('sm')}
          <span className="mx-1 h-6 w-px bg-[var(--color-border)]" aria-hidden />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!selectedRow}
            onClick={() => selectedRow && patchPiece(selectedRow.piece.id, turnedPlacement(selectedRow))}
          >
            Завърти
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!selectedRow} onClick={removeSelected}>
            Изтрий
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!selectedRow || !onEditCabinet}
            onClick={() => selectedRow && onEditCabinet?.(selectedRow.piece.cabinetId)}
          >
            Редактирай шкафа
          </Button>
          <span className="mx-1 h-6 w-px bg-[var(--color-border)]" aria-hidden />
          <div className="flex overflow-hidden rounded-md border border-[var(--color-border)]" role="group" aria-label="История">
            <button
              type="button"
              className="flex items-center gap-1 px-2.5 py-1.5 text-sm hover:bg-[var(--color-muted)] disabled:opacity-40 disabled:hover:bg-transparent"
              disabled={!onUndo}
              onClick={() => onUndo?.()}
              title="Върни последната промяна (Ctrl+Z)"
              aria-label={`Отмени${undoCount > 0 ? `, ${undoCount} стъпки` : ''}`}
            >
              <Undo2 className="h-4 w-4" />
              Отмени{undoCount > 0 ? <span className="text-xs opacity-70">({undoCount})</span> : null}
            </button>
            <button
              type="button"
              className="flex items-center gap-1 border-l border-[var(--color-border)] px-2.5 py-1.5 text-sm hover:bg-[var(--color-muted)] disabled:opacity-40 disabled:hover:bg-transparent"
              disabled={!onRedo}
              onClick={() => onRedo?.()}
              title="Пусни пак върнатата промяна (Ctrl+Y)"
              aria-label="Повтори"
            >
              <Redo2 className="h-4 w-4" />
              Повтори
            </button>
          </div>
          {onSwapColor && (
            <Button
              type="button"
              size="sm"
              variant={showColors ? 'default' : 'outline'}
              aria-pressed={showColors}
              onClick={() => setShowColors((on) => !on)}
            >
              <Palette className="h-4 w-4" />
              Цветове
            </Button>
          )}
          <div className="flex overflow-hidden rounded-md border border-[var(--color-border)]" role="group" aria-label="Изглед">
            {(
              [
                ['2d', '2D'],
                ['both', '2D + 3D'],
                ['3d', '3D'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                className={`px-3 py-1.5 text-sm ${
                  view === id ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'hover:bg-[var(--color-muted)]'
                }`}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <Button type="button" size="sm" className="ml-auto" onClick={() => setStudio(false)}>
            Затвори
          </Button>
        </header>
        {note && (
          <p className="border-b border-[var(--color-border)] px-3 py-1 text-sm text-[var(--color-destructive)]">{note}</p>
        )}
        <div className="flex min-h-0 flex-1">
          <main className={`grid min-h-0 min-w-0 flex-1 gap-2 p-2 ${showPlan && show3d ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {showPlan && planBox(true)}
            {show3d && <div className="min-h-0">{photo('h-full', true)}</div>}
          </main>
          <aside
            className="w-80 shrink-0 overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-card)] p-3"
            aria-label="Свойства"
          >
            {showColors && onSwapColor ? (
              <>
                <h3 className="mb-2 text-sm font-semibold">Цветове на проекта</h3>
                <ProjectColors cabinets={cabinets} finishes={finishes} priceEur={projectPriceEur ?? null} onSwap={onSwapColor} />
              </>
            ) : sketch && !sketch.live ? (
              <>
                <h3 className="text-sm font-semibold">Нов шкаф</h3>
                <NewCabinetPanel
                  key={`${sketch.x}:${sketch.y}:${sketch.w}:${sketch.d}`}
                  sketch={sketch}
                  room={room}
                  onCreate={createSketched}
                  onCancel={() => setSketch(null)}
                />
              </>
            ) : drawCabinet ? (
              <>
                <h3 className="text-sm font-semibold">Начертай шкаф</h3>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                  Хвани с мишката и дръпни правоъгълник — на плана или по пода в 3D. Това е мястото на шкафа, гледано отгоре. После тук избираш какъв да е. Докато чертаеш, 3D не се върти; натисни пак «Начертай шкаф», за да спреш.
                </p>
              </>
            ) : selectedRow ? (
              <>
                <h3 className="text-sm font-semibold">Шкаф</h3>
                {pieceEditor}
              </>
            ) : selectedOpening ? (
              <>
                <h3 className="text-sm font-semibold">Отвор</h3>
                {openingEditor}
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold">Стая</h3>
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Кликни шкаф на плана или в 3D, за да го настроиш. Прозорец, Врата и Ниша се чертаят на плана: дръпни по стената от къде до къде.
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-3">{roomFields}</div>
                {openingList}
              </>
            )}
          </aside>
        </div>
        {removeDialog}
      </div>
    )
  }

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Стая</h2>
        <Button type="button" onClick={() => setStudio(true)}>
          Проектиране на цял екран
        </Button>
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        Светлият размер. Натисни Прозорец, Врата или Ниша и дръпни по стената от къде до къде да е. Готовия отвор се хваща и се носи на друга стена. Изтрий го с бутона до името. Хвани мебела и го плъзни с мишката или с пръст. Ако частта, която опира в стената, се събира в нишата, бутни го. По-плитък шкаф отпред не пречи на по-дълбокия зад него. Оранжевата стрелка сочи челото — там са вратите. Избери мебела и натисни «Завърти», за да я обърнеш. 3D стаята гледа както този план: дясното е вдясно. Отдолу е чертежът: изглед отгоре и отпред, с вериги, които събират размера.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">{roomFields}</div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1">
          <Label htmlFor="room-cabinet">Мебел от проекта</Label>
          {cabinetPicker}
        </div>
        <Button type="button" onClick={addPiece} disabled={!pick}>
          Сложи в стаята
        </Button>
        {penButtons()}
      </div>
      {note && <p className="mt-2 text-sm text-[var(--color-destructive)]">{note}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowPhoto((on) => !on)}>
          {showPhoto ? 'Скрий 3D' : 'Покажи 3D'}
        </Button>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Планът и 3D са едно и също: избереш ли шкаф на едното, светва и на другото.
        </p>
      </div>
      <div className={`mt-2 grid items-start gap-3 ${showPhoto ? 'xl:grid-cols-2' : ''}`}>
        {planBox(false)}
        {showPhoto && photo('h-[min(70vh,640px)]', false)}
      </div>

      {pieceEditor}
      {openingList}
      {openingEditor}
      {removeDialog}
      <div className="mt-6">
        <RoomLink room={room} cabinets={cabinets} finishes={finishes} userId={userId} />
      </div>

      <h3 className="mt-6 text-base font-semibold">Чертеж</h3>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        Размери в мм. Веригата по всяка страна събира светлия размер. Отпред е долната страна на изгледа отгоре.
      </p>

      <div className="mt-3 grid gap-4 xl:grid-cols-2">
        <Drawing title="Изглед отгоре">
          <svg viewBox={planView} className="h-auto w-full bg-white">
            <rect x={PAD_L} y={PAD_T} width={room.width + ROOM_WALL_MM * 2} height={room.depth + ROOM_WALL_MM * 2} fill={room.wallColor} stroke="#1e293b" strokeWidth={2} />
            <rect x={INNER_X} y={INNER_Y} width={room.width} height={room.depth} fill={room.floorColor} stroke="#1e293b" strokeWidth={2} />
            <OpeningMarks room={room} openings={openings} />
            <text x={INNER_X + room.width / 2} y={INNER_Y + room.depth + ROOM_WALL_MM + 64} fill="#1e293b" fontSize={56} textAnchor="middle">
              Отпред
            </text>
            {placed.map((row) => {
              const sx = INNER_X + row.piece.x
              const sy = INNER_Y + (room.depth - row.piece.y - row.d)
              return (
                <g key={row.piece.id}>
                  <rect x={sx} y={sy} width={row.w} height={row.d} fill="#ffffff" fillOpacity={0.88} stroke="#1e293b" strokeWidth={3} />
                  <text x={sx + row.w / 2} y={sy + row.d / 2} fill="#1e293b" fontSize={fitted(row.name, row.w - 16)} textAnchor="middle" dominantBaseline="middle">
                    {row.name}
                  </text>
                  <FrontMark turn={row.piece.turn} x={sx} y={sy} w={row.w} h={row.d} />
                </g>
              )
            })}
            <DimRun
              x={0}
              y={INNER_Y + room.depth + ROOM_WALL_MM + 150}
              horizontal
              stations={xStations}
              along={(station) => ({ x: INNER_X + station, y: 0 })}
              from={(station) => ({ x: INNER_X + station, y: INNER_Y + room.depth })}
            />
            <DimRun
              x={0}
              y={INNER_Y + room.depth + ROOM_WALL_MM + 280}
              horizontal
              stations={[0, room.width]}
              along={(station) => ({ x: INNER_X + station, y: 0 })}
              from={(station) => ({ x: INNER_X + station, y: INNER_Y + room.depth })}
            />
            <DimRun
              x={PAD_L - 160}
              y={0}
              horizontal={false}
              stations={yStations}
              along={(station) => ({ x: 0, y: INNER_Y + room.depth - station })}
              from={(station) => ({ x: INNER_X, y: INNER_Y + room.depth - station })}
            />
            <DimRun
              x={PAD_L - 340}
              y={0}
              horizontal={false}
              stations={[0, room.depth]}
              along={(station) => ({ x: 0, y: INNER_Y + room.depth - station })}
              from={(station) => ({ x: INNER_X, y: INNER_Y + room.depth - station })}
            />
          </svg>
        </Drawing>

        <Drawing title="Изглед отпред">
          <svg viewBox={`-${planBleed.l} 0 ${elevW + planBleed.l + planBleed.r} ${elevH}`} className="h-auto w-full bg-white">
            <rect x={PAD_L} y={PAD_T} width={ROOM_WALL_MM} height={room.height} fill={room.wallColor} stroke="#1e293b" strokeWidth={2} />
            <rect x={INNER_X + room.width} y={PAD_T} width={ROOM_WALL_MM} height={room.height} fill={room.wallColor} stroke="#1e293b" strokeWidth={2} />
            <rect x={INNER_X} y={PAD_T} width={room.width} height={room.height} fill="#f8fafc" stroke="#1e293b" strokeWidth={2} />
            <rect x={INNER_X} y={PAD_T + room.height - 28} width={room.width} height={28} fill={room.floorColor} stroke="none" />
            {openings
              .filter((opening) => opening.wall === 'front' && opening.id !== '__draft__')
              .map((opening) => (
                <g key={opening.id}>
                  <rect
                    x={INNER_X + opening.along}
                    y={PAD_T + room.height - opening.sill - opening.height}
                    width={opening.span}
                    height={opening.height}
                    fill={openingColor(opening)}
                    stroke="#1e293b"
                    strokeWidth={2}
                  />
                  <OpeningLabel
                    x={INNER_X + opening.along}
                    y={PAD_T + room.height - opening.sill - opening.height}
                    w={opening.span}
                    h={opening.height}
                    label={OPENING_NAME[opening.kind]}
                  />
                </g>
              ))}
            {[...placed]
              .sort((a, b) => b.piece.y - a.piece.y)
              .map((row) => {
                const sx = INNER_X + row.piece.x
                const sy = PAD_T + room.height - row.piece.lift - row.h
                return (
                  <g key={row.piece.id}>
                    <rect x={sx} y={sy} width={row.w} height={row.h} fill="#ffffff" stroke="#1e293b" strokeWidth={3} />
                    <text x={sx + row.w / 2} y={sy + row.h / 2 - 10} fill="#1e293b" fontSize={fitted(row.name, row.w - 16)} textAnchor="middle">
                      {row.name}
                    </text>
                    <text
                      x={sx + row.w / 2}
                      y={sy + row.h / 2 + 58}
                      fill="#1e293b"
                      fontSize={fitted(`${formatMm(row.w)} × ${formatMm(row.h)}`, row.w - 16)}
                      textAnchor="middle"
                    >
                      {formatMm(row.w)} × {formatMm(row.h)}
                    </text>
                    {row.piece.lift > 0 && (
                      <text x={sx + row.w / 2} y={sy + row.h + 52} fill="#1e293b" fontSize={48} textAnchor="middle">
                        от пода {formatMm(row.piece.lift)}
                      </text>
                    )}
                  </g>
                )
              })}
            <DimRun
              x={0}
              y={PAD_T + room.height + 120}
              horizontal
              stations={xStations}
              along={(station) => ({ x: INNER_X + station, y: 0 })}
              from={(station) => ({ x: INNER_X + station, y: PAD_T + room.height })}
            />
            <DimRun
              x={0}
              y={PAD_T + room.height + 260}
              horizontal
              stations={[0, room.width]}
              along={(station) => ({ x: INNER_X + station, y: 0 })}
              from={(station) => ({ x: INNER_X + station, y: PAD_T + room.height })}
            />
            <DimRun
              x={PAD_L - 180}
              y={0}
              horizontal={false}
              stations={[0, room.height]}
              along={(station) => ({ x: 0, y: PAD_T + room.height - station })}
              from={(station) => ({ x: INNER_X, y: PAD_T + room.height - station })}
            />
          </svg>
        </Drawing>
      </div>
    </section>
  )
}

function Drawing({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="rounded-md border border-neutral-300 bg-white p-2">
      <figcaption className="mb-1 text-sm font-medium text-neutral-800">{title}</figcaption>
      {children}
    </figure>
  )
}

function SizeField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="w-28">
      <Label>{label}</Label>
      <DraftNumber className="mt-1" inputMode="numeric" value={value} onCommit={onChange} />
    </div>
  )
}

function ColorField({
  label,
  value,
  swatches,
  onChange,
}: {
  label: string
  value: string
  swatches: { name: string; color: string }[]
  onChange: (color: string) => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex items-center gap-1">
        {swatches.map((swatch) => (
          <button
            key={swatch.color}
            type="button"
            title={swatch.name}
            aria-label={swatch.name}
            className="h-8 w-8 rounded border border-neutral-400"
            style={{ background: swatch.color, outline: value.toLowerCase() === swatch.color ? '2px solid #c2410c' : undefined }}
            onClick={() => onChange(swatch.color)}
          />
        ))}
        <input
          type="color"
          aria-label={`${label} — друг цвят`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 cursor-pointer bg-transparent"
        />
      </div>
    </div>
  )
}

const FACING = ['към предната стена', 'към лявата стена', 'към задната стена', 'към дясната стена'] as const

/** A rectangle drawn on the plan, in room mm: x from the left wall, y from the front wall. */
type Sketch = { x: number; y: number; w: number; d: number }

/** The back goes to the nearest wall, so the doors face into the room. */
function facingFor(sketch: Sketch, room: { width: number; depth: number }): 0 | 1 | 2 | 3 {
  const gaps: [number, 0 | 1 | 2 | 3][] = [
    [room.depth - (sketch.y + sketch.d), 0],
    [room.width - (sketch.x + sketch.w), 1],
    [sketch.y, 2],
    [sketch.x, 3],
  ]
  gaps.sort((a, b) => a[0] - b[0])
  return gaps[0]![1]
}

function NewCabinetPanel({
  sketch,
  room,
  onCreate,
  onCancel,
}: {
  sketch: Sketch
  room: { width: number; depth: number }
  onCreate: (typeId: string, size: { w: number; d: number; h: number }, turn: 0 | 1 | 2 | 3) => void
  onCancel: () => void
}) {
  const [typeId, setTypeId] = useState(CABINET_TYPES[0]?.id ?? 'kitchen-base')
  const [turn, setTurn] = useState<0 | 1 | 2 | 3>(() => facingFor(sketch, room))
  // Along the doors is the width. A cabinet turned to a side wall has its width across the plan.
  const across = turn % 2 === 1
  const [w, setW] = useState(across ? sketch.d : sketch.w)
  const [d, setD] = useState(across ? sketch.w : sketch.d)
  const heightOf = (id: string) => {
    const value = Number(getCabinetType(id)?.defaultParams.height)
    return Number.isFinite(value) && value > 0 ? value : 720
  }
  const [h, setH] = useState(() => heightOf(typeId))
  const changeTurn = (next: 0 | 1 | 2 | 3) => {
    if (next % 2 !== turn % 2) {
      setW(d)
      setD(w)
    }
    setTurn(next)
  }
  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-[var(--color-muted-foreground)]">
        Начерта {formatMm(sketch.w)} × {formatMm(sketch.d)} мм. Избери какъв да е шкафът. Размерите може да ги поправиш.
      </p>
      <div>
        <Label htmlFor="sketch-type">Вид</Label>
        <select
          id="sketch-type"
          className="mt-1 flex h-9 w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 text-sm"
          value={typeId}
          onChange={(event) => {
            setTypeId(event.target.value)
            setH(heightOf(event.target.value))
          }}
        >
          {CABINET_TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="w-24">
          <Label>Ширина</Label>
          <DraftNumber className="mt-1" inputMode="numeric" value={w} onCommit={(n) => setW(Math.max(100, n))} />
        </div>
        <div className="w-24">
          <Label>Дълбочина</Label>
          <DraftNumber className="mt-1" inputMode="numeric" value={d} onCommit={(n) => setD(Math.max(100, n))} />
        </div>
        <div className="w-24">
          <Label>Височина</Label>
          <DraftNumber className="mt-1" inputMode="numeric" value={h} onCommit={(n) => setH(Math.max(100, n))} />
        </div>
      </div>
      <div>
        <Label htmlFor="sketch-facing">Челото сочи</Label>
        <select
          id="sketch-facing"
          className="mt-1 flex h-9 w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 text-sm"
          value={turn}
          onChange={(event) => changeTurn(Number(event.target.value) as 0 | 1 | 2 | 3)}
        >
          {FACING.map((label, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={() => onCreate(typeId, { w, d, h }, turn)}>
          Създай шкафа
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Отказ
        </Button>
      </div>
    </div>
  )
}

/** Next quarter turn, kept on the same spot on the floor. */
function turnedPlacement(row: Placed): Partial<RoomPiece> {
  const nextTurn = ((row.piece.turn + 1) % 4) as 0 | 1 | 2 | 3
  const nativeW = row.piece.turn % 2 === 1 ? row.d : row.w
  const nativeD = row.piece.turn % 2 === 1 ? row.w : row.d
  const after = pieceSpan(nextTurn, nativeW, nativeD)
  return {
    turn: nextTurn,
    x: row.piece.x + row.w / 2 - after.w / 2,
    y: row.piece.y + row.d / 2 - after.d / 2,
  }
}

function FrontMark({ turn, x, y, w, h }: { turn: 0 | 1 | 2 | 3; x: number; y: number; w: number; h: number }) {
  const edge =
    turn === 0
      ? { x1: x, y1: y + h, x2: x + w, y2: y + h, nx: 0, ny: 1 }
      : turn === 1
        ? { x1: x, y1: y, x2: x, y2: y + h, nx: -1, ny: 0 }
        : turn === 2
          ? { x1: x, y1: y, x2: x + w, y2: y, nx: 0, ny: -1 }
          : { x1: x + w, y1: y, x2: x + w, y2: y + h, nx: 1, ny: 0 }
  const len = Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1)
  const midX = (edge.x1 + edge.x2) / 2
  const midY = (edge.y1 + edge.y2) / 2
  const reach = Math.min(240, Math.max(110, Math.min(w, h) * 0.45))
  const head = Math.min(len * 0.7, 380)
  const px = -edge.ny
  const py = edge.nx
  const tipX = midX + edge.nx * reach
  const tipY = midY + edge.ny * reach
  const baseX = midX - edge.nx * reach * 0.2
  const baseY = midY - edge.ny * reach * 0.2
  const half = head / 2
  return (
    <g aria-hidden pointerEvents="none">
      <line
        x1={edge.x1}
        y1={edge.y1}
        x2={edge.x2}
        y2={edge.y2}
        stroke="#c2410c"
        strokeWidth={Math.max(42, Math.min(w, h) * 0.1)}
        strokeLinecap="butt"
      />
      <polygon
        points={`${tipX},${tipY} ${baseX + px * half},${baseY + py * half} ${baseX - px * half},${baseY - py * half}`}
        fill="#c2410c"
      />
      {len > 560 && (
        <text
          x={midX + edge.nx * (reach + 90)}
          y={midY + edge.ny * (reach + 90)}
          fill="#c2410c"
          fontSize={84}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          пред
        </text>
      )}
    </g>
  )
}

function PieceEditor({
  row,
  roomWidth,
  roomDepth,
  onPatch,
  onEdit,
  onRemove,
}: {
  row: Placed | null
  roomWidth: number
  roomDepth: number
  onPatch: (patch: Partial<RoomPiece>) => void
  onEdit?: (cabinetId: string) => void
  onRemove: () => void
}) {
  const [step, setStep] = useState(50)
  if (!row) return null
  const nudge = (patch: Partial<RoomPiece>) => onPatch(patch)
  const { x, y, lift } = row.piece
  // The back of the cabinet: turn 0 has it toward the back wall, then right, front, left.
  const gap = [roomDepth - (y + row.d), roomWidth - (x + row.w), y, x][row.piece.turn] ?? 0
  const backGap = Math.round(gap)
  const field = (label: string, value: number, key: 'x' | 'y' | 'lift') => (
    <div className="w-28">
      <Label>{label}</Label>
      <DraftNumber className="mt-1" inputMode="numeric" value={value} onCommit={(n) => onPatch({ [key]: n })} />
    </div>
  )
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-orange-500/60 bg-orange-500/5 p-3">
      <div className="flex w-full flex-wrap items-center gap-2">
        <p className="text-sm font-medium">
          {row.name} · {formatMm(row.w)} × {formatMm(row.d)} × {formatMm(row.h)} мм. Челото сочи {FACING[row.piece.turn]}
        </p>
        <p
          className={`w-full rounded px-2 py-1 text-sm font-medium ${
            backGap === 0 ? 'bg-emerald-600/15 text-emerald-700' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
          }`}
        >
          {backGap === 0
            ? '✓ Гърбът е до стената'
            : backGap > 0
              ? `Гърбът е на ${formatMm(backGap)} мм от стената`
              : `Гърбът е влязъл ${formatMm(-backGap)} мм в нишата`}
        </p>
        {onEdit && (
          <Button type="button" size="sm" onClick={() => onEdit(row.piece.cabinetId)}>
            Редактирай шкафа
          </Button>
        )}
      </div>
      {field('От лявата стена', row.piece.x, 'x')}
      <div className="w-28">
        <Label>От дясната стена</Label>
        <DraftNumber
          className="mt-1"
          inputMode="numeric"
          value={roomWidth - row.piece.x - row.w}
          onCommit={(n) => onPatch({ x: roomWidth - row.w - n })}
        />
      </div>
      {field('От предната стена', row.piece.y, 'y')}
      {field('От пода', row.piece.lift, 'lift')}
      <div className="w-full">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={`nudge-${row.piece.id}`}>Мести с</Label>
          <select
            id={`nudge-${row.piece.id}`}
            className="h-8 rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-2 text-sm"
            value={step}
            onChange={(event) => setStep(Number(event.target.value))}
          >
            {[10, 50, 100, 500].map((value) => (
              <option key={value} value={value}>
                {value} мм
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1" role="group" aria-label="Мести шкафа">
          <Button type="button" size="sm" variant="outline" onClick={() => nudge({ lift: lift + step })}>
            Нагоре
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => nudge({ y: y + step })}>
            Назад
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => nudge({ lift: Math.max(0, lift - step) })}>
            Надолу
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => nudge({ x: x - step })}>
            Наляво
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => nudge({ y: y - step })}>
            Напред
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => nudge({ x: x + step })}>
            Надясно
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
          В «Проектиране»: стрелките местят с 10 мм (със Shift — 100), Page Up/Down вдигат и свалят, Delete трие. В 3D хвани избрания шкаф и го влачи по пода.
        </p>
      </div>
      <Button type="button" variant="outline" onClick={() => onPatch(turnedPlacement(row))}>
        Завърти
      </Button>
      <Button type="button" variant="ghost" onClick={onRemove}>
        Изтрий
      </Button>
    </div>
  )
}

function OpeningMarks({
  room,
  openings,
  selectedId,
}: {
  room: { width: number; depth: number }
  openings: RoomOpening[]
  selectedId?: string | null
}) {
  return (
    <>
      {openings.map((opening) => {
        const box = openingRect(room, opening)
        const on = opening.id === selectedId
        const label = OPENING_NAME[opening.kind]
        return (
          <g key={opening.id}>
            <title>{`${label}, ${WALL_NAME[opening.wall]}`}</title>
            <rect
              x={box.x}
              y={box.y}
              width={Math.max(box.w, 1)}
              height={Math.max(box.h, 1)}
              fill={openingColor(opening)}
              stroke={on ? '#c2410c' : '#1e293b'}
              strokeWidth={on ? 8 : 3}
            />
            <OpeningLabel x={box.x} y={box.y} w={box.w} h={box.h} label={label} />
          </g>
        )
      })}
    </>
  )
}

function OpeningEditor({
  opening,
  room,
  onPatch,
  onRemove,
}: {
  opening: RoomOpening | null
  room: { width: number; depth: number }
  onPatch: (part: Partial<RoomOpening>) => void
  onRemove: () => void
}) {
  if (!opening) return null
  const field = (label: string, value: number, key: 'span' | 'height' | 'sill' | 'along' | 'depth') => (
    <div className="w-28">
      <Label>{label}</Label>
      <DraftNumber className="mt-1" inputMode="numeric" value={value} onCommit={(n) => onPatch({ [key]: n })} />
    </div>
  )
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <p className="w-full text-sm font-medium">
        {OPENING_NAME[opening.kind]} · {WALL_NAME[opening.wall]}
      </p>
      <div className="flex w-full flex-wrap gap-2">
        {(['front', 'back', 'left', 'right'] as RoomWall[]).map((wall) => (
          <Button
            key={wall}
            type="button"
            size="sm"
            variant={opening.wall === wall ? 'default' : 'outline'}
            onClick={() => onPatch({ wall })}
          >
            {WALL_NAME[wall]}
          </Button>
        ))}
      </div>
      <ColorField
        label="Цвят"
        value={openingColor(opening)}
        swatches={OPENING_SWATCHES}
        onChange={(color) => onPatch({ color })}
      />
      {field('Широчина', opening.span, 'span')}
      {field('Височина', opening.height, 'height')}
      {opening.kind !== 'door' && field('От пода', opening.sill, 'sill')}
      {field(wallAlongLabel(opening.wall), opening.along, 'along')}
      <div className="w-28">
        <Label>{wallFarLabel(opening.wall)}</Label>
        <DraftNumber
          className="mt-1"
          inputMode="numeric"
          value={openingFar(room, opening)}
          onCommit={(n) => onPatch({ along: alongForFar(room, opening, n) })}
        />
      </div>
      {opening.kind === 'niche' && field('Дълбочина', opening.depth, 'depth')}
      <Button type="button" variant="ghost" onClick={onRemove}>
        Изтрий
      </Button>
    </div>
  )
}
