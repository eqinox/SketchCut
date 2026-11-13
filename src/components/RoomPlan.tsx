import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cabinetOuterSize, isCombinationType } from '@/lib/cabinets/compose'
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
  const [selected, setSelected] = useState<string | null>(null)
  const [pick, setPick] = useState('')
  const [note, setNote] = useState('')
  const [showPhoto, setShowPhoto] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const planRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null)
  const stopDrag = useRef<(() => void) | null>(null)

  const byId = useMemo(() => new Map(cabinets.map((cabinet) => [cabinet.id, cabinet])), [cabinets])

  const placed = useMemo(() => {
    const rows: Placed[] = []
    for (const piece of room.pieces) {
      const cabinet = byId.get(piece.cabinetId)
      if (!cabinet || isCombinationType(cabinet.typeId)) continue
      const outer = cabinetOuterSize(cabinet.typeId, cabinet.params)
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
  }, [room.pieces, byId])

  useEffect(() => {
    const live = new Set(
      cabinets.filter((cabinet) => !isCombinationType(cabinet.typeId)).map((cabinet) => cabinet.id),
    )
    if (room.pieces.every((piece) => live.has(piece.cabinetId))) return
    onChange({ ...room, pieces: room.pieces.filter((piece) => live.has(piece.cabinetId)) })
  }, [cabinets, room, onChange])

  const choices = cabinets.filter((cabinet) => !isCombinationType(cabinet.typeId))

  const setRoom = (next: RoomPlan) => {
    const clamped: RoomPlan = {
      ...next,
      pieces: next.pieces.flatMap((piece) => {
        const cabinet = byId.get(piece.cabinetId)
        if (!cabinet) return []
        const outer = cabinetOuterSize(cabinet.typeId, cabinet.params)
        return [clampPiece(next, piece, { w: outer.w, d: outer.d, h: outer.h + outer.feet })]
      }),
    }
    onChange(clamped)
  }

  const patchPiece = (id: string, patch: Partial<RoomPiece>) => {
    const current = placed.find((row) => row.piece.id === id)
    if (!current) return
    const next = { ...current.piece, ...patch }
    const cabinet = byId.get(next.cabinetId)
    if (!cabinet) return
    const outer = cabinetOuterSize(cabinet.typeId, cabinet.params)
    const seated = clampPiece(room, next, { w: outer.w, d: outer.d, h: outer.h + outer.feet })
    const box = pieceSpan(seated.turn, outer.w, outer.d)
    const hit = placed.some(
      (row) =>
        row.piece.id !== id &&
        boxesOverlap({ x: seated.x, y: seated.y, w: box.w, d: box.d }, { x: row.piece.x, y: row.piece.y, w: row.w, d: row.d }),
    )
    if (hit) {
      setNote('Там вече има мебел.')
      return
    }
    setNote('')
    onChange({ ...room, pieces: room.pieces.map((piece) => (piece.id === id ? seated : piece)) })
  }

  const addPiece = () => {
    const cabinet = byId.get(pick)
    if (!cabinet) return
    const outer = cabinetOuterSize(cabinet.typeId, cabinet.params)
    const lift = defaultLift(cabinet.typeId, outer.h + outer.feet, room.height)
    const draft: RoomPiece = { id: generateId(), cabinetId: cabinet.id, x: 0, y: 0, lift, turn: 0 }
    if (outer.w > room.width || outer.d > room.depth || outer.h + outer.feet > room.height) {
      setNote('Мебелът е по-голям от стаята.')
      return
    }
    let seat = clampPiece(room, draft, { w: outer.w, d: outer.d, h: outer.h + outer.feet })
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
    if (!found && placed.length > 0) {
      setNote('Няма свободно място на стъпка 100 мм. Премести нещо и опитай пак.')
      return
    }
    setNote('')
    setSelected(seat.id)
    onChange({ ...room, pieces: [...room.pieces, seat] })
  }

  const innerX = PAD_L + ROOM_WALL_MM
  const innerY = PAD_T + ROOM_WALL_MM
  const planW = PAD_L + ROOM_WALL_MM * 2 + room.width + PAD_R
  const planH = PAD_T + ROOM_WALL_MM * 2 + room.depth + PAD_B
  const elevW = PAD_L + ROOM_WALL_MM * 2 + room.width + PAD_R
  const elevH = PAD_T + room.height + PAD_B

  const placedRef = useRef(placed)
  const roomRef = useRef(room)
  const patchRef = useRef(patchPiece)
  placedRef.current = placed
  roomRef.current = room
  patchRef.current = patchPiece

  useEffect(() => {
    const plan = planRef.current
    if (!plan) return
    const keepFinger = (event: TouchEvent) => {
      if (drag.current) event.preventDefault()
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
      const sx = innerX + item.piece.x
      const sy = innerY + (depth - item.piece.y - item.d)
      return local.x >= sx && local.x <= sx + item.w && local.y >= sy && local.y <= sy + item.d
    })
    if (!row) return
    event.preventDefault()
    stopDrag.current?.()
    const sx = innerX + row.piece.x
    const sy = innerY + (depth - row.piece.y - row.d)
    drag.current = { id: row.piece.id, ox: local.x - sx, oy: local.y - sy }
    setSelected(row.piece.id)
    const pointerId = event.pointerId
    const plan = event.currentTarget as Element
    try {
      plan.setPointerCapture(pointerId)
    } catch {
      // iPhone follows the finger through the window listeners below.
    }
    const move = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      const held = drag.current
      if (!held) return
      const current = placedRef.current.find((item) => item.piece.id === held.id)
      if (!current) return
      const point = svgPoint(ev)
      const x = point.x - held.ox - innerX
      const y = roomRef.current.depth - (point.y - held.oy - innerY) - current.d
      patchRef.current(held.id, { x, y })
    }
    const up = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      drag.current = null
      stopDrag.current = null
      const plan = planRef.current
      if (plan?.hasPointerCapture(pointerId)) {
        try {
          plan.releasePointerCapture(pointerId)
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
        Светлият размер. Хвани мебела на плана и го плъзни — с мишката или с пръст. Оранжевата черта е
        челото — избери мебела и натисни «Завърти», за да сочи към друга стена. Отдолу е чертежът: изглед
        отгоре и отпред, с вериги, които събират размера.
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
          viewBox={`0 0 ${planW} ${planH}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label="Нареждане в стаята, изглед отгоре"
          style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
        >
          <rect x={PAD_L} y={PAD_T} width={room.width + ROOM_WALL_MM * 2} height={room.depth + ROOM_WALL_MM * 2} fill={room.wallColor} stroke="#1e293b" strokeWidth={2} />
          <rect x={innerX} y={innerY} width={room.width} height={room.depth} fill={room.floorColor} stroke="#1e293b" strokeWidth={2} />
          <text x={innerX + room.width / 2} y={innerY + room.depth + ROOM_WALL_MM + 70} fill="#1e293b" fontSize={64} textAnchor="middle">
            Отпред
          </text>
          {placed.map((row) => {
            const sx = innerX + row.piece.x
            const sy = innerY + (room.depth - row.piece.y - row.d)
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
          onPatch={(patch) => patchPiece(selected, patch)}
          onRemove={() => {
            onChange({ ...room, pieces: room.pieces.filter((piece) => piece.id !== selected) })
            setSelected(null)
          }}
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
          <svg viewBox={`0 0 ${planW} ${planH}`} className="h-auto w-full bg-white">
            <rect x={PAD_L} y={PAD_T} width={room.width + ROOM_WALL_MM * 2} height={room.depth + ROOM_WALL_MM * 2} fill={room.wallColor} stroke="#1e293b" strokeWidth={2} />
            <rect x={innerX} y={innerY} width={room.width} height={room.depth} fill={room.floorColor} stroke="#1e293b" strokeWidth={2} />
            <text x={innerX + room.width / 2} y={innerY + room.depth + ROOM_WALL_MM + 64} fill="#1e293b" fontSize={56} textAnchor="middle">
              Отпред
            </text>
            {placed.map((row) => {
              const sx = innerX + row.piece.x
              const sy = innerY + (room.depth - row.piece.y - row.d)
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
              y={innerY + room.depth + ROOM_WALL_MM + 150}
              horizontal
              stations={xStations}
              along={(station) => ({ x: innerX + station, y: 0 })}
              from={(station) => ({ x: innerX + station, y: innerY + room.depth })}
            />
            <DimRun
              x={0}
              y={innerY + room.depth + ROOM_WALL_MM + 280}
              horizontal
              stations={[0, room.width]}
              along={(station) => ({ x: innerX + station, y: 0 })}
              from={(station) => ({ x: innerX + station, y: innerY + room.depth })}
            />
            <DimRun
              x={PAD_L - 160}
              y={0}
              horizontal={false}
              stations={yStations}
              along={(station) => ({ x: 0, y: innerY + room.depth - station })}
              from={(station) => ({ x: innerX, y: innerY + room.depth - station })}
            />
            <DimRun
              x={PAD_L - 340}
              y={0}
              horizontal={false}
              stations={[0, room.depth]}
              along={(station) => ({ x: 0, y: innerY + room.depth - station })}
              from={(station) => ({ x: innerX, y: innerY + room.depth - station })}
            />
          </svg>
        </Drawing>

        <Drawing title="Изглед отпред">
          <svg viewBox={`0 0 ${elevW} ${elevH}`} className="h-auto w-full bg-white">
            <rect x={PAD_L} y={PAD_T} width={ROOM_WALL_MM} height={room.height} fill={room.wallColor} stroke="#1e293b" strokeWidth={2} />
            <rect x={innerX + room.width} y={PAD_T} width={ROOM_WALL_MM} height={room.height} fill={room.wallColor} stroke="#1e293b" strokeWidth={2} />
            <rect x={innerX} y={PAD_T} width={room.width} height={room.height} fill="#f8fafc" stroke="#1e293b" strokeWidth={2} />
            <rect x={innerX} y={PAD_T + room.height - 28} width={room.width} height={28} fill={room.floorColor} stroke="none" />
            {[...placed]
              .sort((a, b) => b.piece.y - a.piece.y)
              .map((row) => {
                const sx = innerX + row.piece.x
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
              along={(station) => ({ x: innerX + station, y: 0 })}
              from={(station) => ({ x: innerX + station, y: PAD_T + room.height })}
            />
            <DimRun
              x={0}
              y={PAD_T + room.height + 260}
              horizontal
              stations={[0, room.width]}
              along={(station) => ({ x: innerX + station, y: 0 })}
              from={(station) => ({ x: innerX + station, y: PAD_T + room.height })}
            />
            <DimRun
              x={PAD_L - 180}
              y={0}
              horizontal={false}
              stations={[0, room.height]}
              along={(station) => ({ x: 0, y: PAD_T + room.height - station })}
              from={(station) => ({ x: innerX, y: PAD_T + room.height - station })}
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
      <Input
        className="mt-1"
        type="number"
        min={1000}
        inputMode="numeric"
        value={value}
        onChange={(event) => {
          const n = Number(event.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
      />
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
  const midX = (edge.x1 + edge.x2) / 2
  const midY = (edge.y1 + edge.y2) / 2
  return (
    <g aria-hidden pointerEvents="none">
      <line x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke="#c2410c" strokeWidth={18} strokeLinecap="butt" />
      <line
        x1={midX}
        y1={midY}
        x2={midX + edge.nx * 70}
        y2={midY + edge.ny * 70}
        stroke="#c2410c"
        strokeWidth={14}
        strokeLinecap="butt"
      />
    </g>
  )
}

function PieceEditor({
  row,
  onPatch,
  onRemove,
}: {
  row: Placed | null
  onPatch: (patch: Partial<RoomPiece>) => void
  onRemove: () => void
}) {
  if (!row) return null
  const field = (label: string, value: number, key: 'x' | 'y' | 'lift') => (
    <div className="w-28">
      <Label>{label}</Label>
      <Input
        className="mt-1"
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(event) => {
          const n = Number(event.target.value)
          if (Number.isFinite(n)) onPatch({ [key]: n })
        }}
      />
    </div>
  )
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <p className="w-full text-sm font-medium">
        {row.name}. Челото сочи {FACING[row.piece.turn]}
      </p>
      {field('От лявата стена', row.piece.x, 'x')}
      {field('От предната стена', row.piece.y, 'y')}
      {field('От пода', row.piece.lift, 'lift')}
      <Button type="button" variant="outline" onClick={() => onPatch(turnedPlacement(row))}>
        Завърти
      </Button>
      <Button type="button" variant="ghost" onClick={onRemove}>
        Махни
      </Button>
    </div>
  )
}
