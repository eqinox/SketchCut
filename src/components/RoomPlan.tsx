import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DraftNumber } from '@/components/DraftNumber'
import { groupOuterSize, groupSolidBlocks } from '@/lib/cabinets/compose'
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
}: {
  room: RoomPlan
  cabinets: CabinetInstance[]
  finishes: BoardFinish[]
  userId: string | null
  onChange: (room: RoomPlan) => void
}) {
  const [pen, setPen] = useState<RoomOpeningKind | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null)
  const [pick, setPick] = useState('')
  const [note, setNote] = useState('')
  const [showPhoto, setShowPhoto] = useState(false)
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
    const hit = placed.some(
      (row) =>
        row.piece.id !== id &&
        boxesOverlap({ x: seated.x, y: seated.y, w: box.w, d: box.d }, { x: row.piece.x, y: row.piece.y, w: row.w, d: row.d }),
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
  }, [])

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

  const onPlanPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
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

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <h2 className="text-lg font-semibold">Стая</h2>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        Светлият размер. Натисни Прозорец, Врата или Ниша и дръпни по стената от къде до къде да е. Готовия отвор се хваща и се носи на друга стена. Изтрий го с бутона до името. Хвани мебела и го плъзни с мишката или с пръст. Ако частта, която опира в стената, се събира в нишата, бутни го. По-плитък шкаф отпред не пречи на по-дълбокия зад него. Оранжевата стрелка сочи челото — там са вратите. Избери мебела и натисни «Завърти», за да я обърнеш. 3D стаята долу гледа както този план: дясното е вдясно. Отдолу е чертежът: изглед отгоре и отпред, с вериги, които събират размера.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
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
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1">
          <Label htmlFor="room-cabinet">Мебел от проекта</Label>
          <select
            id="room-cabinet"
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
        </div>
        <Button type="button" onClick={addPiece} disabled={!pick}>
          Сложи в стаята
        </Button>
        {(
          [
            ['window', 'Прозорец'],
            ['door', 'Врата'],
            ['niche', 'Ниша'],
          ] as const
        ).map(([kind, label]) => (
          <Button
            key={kind}
            type="button"
            variant={pen === kind ? 'default' : 'outline'}
            onClick={() => setPen((current) => (current === kind ? null : kind))}
          >
            {label}
          </Button>
        ))}
      </div>
      {note && <p className="mt-2 text-sm text-[var(--color-destructive)]">{note}</p>}

      <div
        ref={planRef}
        className="mt-4 overflow-hidden rounded-md border border-neutral-300 bg-white"
        style={{ touchAction: 'none' }}
        onPointerDown={onPlanPointerDown}
      >
        <svg
          ref={svgRef}
          viewBox={planView}
          className="h-auto w-full select-none"
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
        </svg>
      </div>

      {selected && (
        <PieceEditor
          row={placed.find((row) => row.piece.id === selected) ?? null}
          roomWidth={room.width}
          onPatch={(patch) => patchPiece(selected, patch)}
          onRemove={() => {
            onChange({ ...room, pieces: room.pieces.filter((piece) => piece.id !== selected) })
            setSelected(null)
          }}
        />
      )}
      {openings.some((opening) => opening.id !== '__draft__') && (
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
      )}
      {selectedOpening && (
        <OpeningEditor
          opening={openings.find((opening) => opening.id === selectedOpening) ?? null}
          room={room}
          onPatch={(part) => patchOpening(selectedOpening, part)}
          onRemove={() => removeOpening(selectedOpening)}
        />
      )}

      <div className="mt-6">
        {showPhoto ? (
          <div className="mb-2">
            <Button type="button" variant="outline" onClick={() => setShowPhoto(false)}>
              Скрий 3D стаята
            </Button>
          </div>
        ) : (
          <div className="mb-3">
            <Button type="button" onClick={() => setShowPhoto(true)}>
              Покажи 3D стаята
            </Button>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Картината се пуска само оттук, за да не бави останалата работа.
            </p>
          </div>
        )}
        {showPhoto && <RoomPhoto room={room} cabinets={cabinets} finishes={finishes} onChange={onChange} />}
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
  onPatch,
  onRemove,
}: {
  row: Placed | null
  roomWidth: number
  onPatch: (patch: Partial<RoomPiece>) => void
  onRemove: () => void
}) {
  if (!row) return null
  const field = (label: string, value: number, key: 'x' | 'y' | 'lift') => (
    <div className="w-28">
      <Label>{label}</Label>
      <DraftNumber className="mt-1" inputMode="numeric" value={value} onCommit={(n) => onPatch({ [key]: n })} />
    </div>
  )
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <p className="w-full text-sm font-medium">
        {row.name}. Челото сочи {FACING[row.piece.turn]}
      </p>
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
