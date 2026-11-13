import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { CabinetPreview } from '@/components/CabinetPreview'
import { SceneCaptureContext, createCaptureStore, type CaptureStore, type SceneSolid } from '@/lib/cabinets/scene-solids'
import { cabinetOuterSize, isCombinationType } from '@/lib/cabinets/compose'
import { decorSheetFor, type DecorSheet } from '@/lib/finish-photo'
import type { BoardFinish } from '@/lib/board-finishes'
import { mountRoomStudio, type RoomFront, type RoomStudio } from '@/lib/view3d/room-photo'
import { pieceSpan, type RoomPlan } from '@/lib/room'
import {
  OPENING_NAME,
  WALL_NAME,
  clampOpening,
  openingsIn,
  wallAlongLabel,
  type RoomOpening,
  type RoomOpeningKind,
} from '@/lib/room-openings'
import { generateId } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CabinetInstance } from '@/types'

function finishOf(finishes: BoardFinish[], id: unknown): BoardFinish | undefined {
  return typeof id === 'string' ? finishes.find((finish) => finish.id === id) : undefined
}

function CabinetCapture({
  cabinet,
  finishes,
  onSolids,
}: {
  cabinet: CabinetInstance
  finishes: BoardFinish[]
  onSolids: (id: string, solids: SceneSolid[]) => void
}) {
  const storeRef = useRef<CaptureStore | null>(null)
  if (!storeRef.current) storeRef.current = createCaptureStore()
  const store = storeRef.current
  const solids = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useEffect(() => {
    onSolids(cabinet.id, solids)
  }, [cabinet.id, solids, onSolids])

  const carcass = finishOf(finishes, cabinet.params.carcassFinishId)
  const front = finishOf(finishes, cabinet.params.frontFinishId) ?? carcass
  const back = finishOf(finishes, cabinet.params.backFinishId)
  return (
    <SceneCaptureContext.Provider value={store}>
      <div className="hidden" aria-hidden>
        <CabinetPreview
          typeId={cabinet.typeId}
          params={cabinet.params}
          part="main"
          captureSolids
          showFronts
          doorView="closed"
          carcassColor={carcass?.color}
          carcassImage={carcass?.image}
          frontColor={front?.color}
          frontImage={front?.image}
          backColor={back?.color}
          backImage={back?.image}
          finishes={finishes}
        />
      </div>
    </SceneCaptureContext.Provider>
  )
}

type WallTool = 'look' | RoomOpeningKind

export function RoomPhoto({
  room,
  cabinets,
  finishes,
  tall = false,
  onChange,
}: {
  room: RoomPlan
  cabinets: CabinetInstance[]
  finishes: BoardFinish[]
  /** Taller picture for the shared link. */
  tall?: boolean
  /** When set, windows, doors and niches can be drawn on the walls. */
  onChange?: (room: RoomPlan) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const studioRef = useRef<RoomStudio | null>(null)
  const roomRef = useRef(room)
  const toolRef = useRef<WallTool>('look')
  const onChangeRef = useRef(onChange)
  roomRef.current = room
  onChangeRef.current = onChange
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [tool, setTool] = useState<WallTool>('look')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fronts, setFronts] = useState<RoomFront[]>([])
  toolRef.current = tool
  const [packs, setPacks] = useState<ReadonlyMap<string, SceneSolid[]>>(new Map())
  const [sheets, setSheets] = useState<ReadonlyMap<string, DecorSheet>>(new Map())

  const byId = useMemo(() => new Map(cabinets.map((cabinet) => [cabinet.id, cabinet])), [cabinets])
  const placed = useMemo(
    () =>
      room.pieces.flatMap((piece) => {
        const cabinet = byId.get(piece.cabinetId)
        if (!cabinet || isCombinationType(cabinet.typeId)) return []
        return [{ piece, cabinet }]
      }),
    [room.pieces, byId],
  )

  const onSolids = useCallback((id: string, solids: SceneSolid[]) => {
    setPacks((prev) => {
      if (prev.get(id) === solids) return prev
      const next = new Map(prev)
      next.set(id, solids)
      return next
    })
  }, [])

  const sheetKey = finishes.map((finish) => `${finish.color}\n${finish.image ?? ''}`).join('|')
  useEffect(() => {
    let cancel = false
    const unique = new Map<string, string>()
    for (const finish of finishes) {
      if (!finish.color || !finish.image) continue
      unique.set(finish.color.toLowerCase(), finish.image)
    }
    if (unique.size === 0) {
      setSheets(new Map())
      return
    }
    void Promise.all([...unique.entries()].map(async ([color, image]) => [color, await decorSheetFor(image)] as const))
      .then((pairs) => {
        if (!cancel) setSheets(new Map(pairs))
      })
      .catch(() => {
        if (!cancel) setSheets(new Map())
      })
    return () => {
      cancel = true
    }
  }, [sheetKey, finishes])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let studio: RoomStudio
    try {
      studio = mountRoomStudio(host)
    } catch {
      setFailed(true)
      return
    }
    studioRef.current = studio
    setReady(true)
    return () => {
      studio.dispose()
      studioRef.current = null
    }
  }, [])

  useEffect(() => {
    const studio = studioRef.current
    if (!studio) return
    const pull = () => setFronts(studio.fronts())
    pull()
    return studio.subscribe(pull)
  }, [ready])

  useEffect(() => {
    studioRef.current?.setRoom(
      room,
      placed.map(({ piece, cabinet }) => {
        const outer = cabinetOuterSize(cabinet.typeId, cabinet.params)
        const box = pieceSpan(piece.turn, outer.w, outer.d)
        return {
          id: piece.id,
          x: piece.x,
          y: piece.y,
          lift: piece.lift,
          turn: piece.turn,
          w: box.w,
          d: box.d,
          solids: packs.get(piece.cabinetId) ?? [],
        }
      }),
      sheets,
    )
  }, [room, placed, packs, sheets])

  useEffect(() => {
    const studio = studioRef.current
    if (!studio) return
    studio.setNavigate(tool === 'look')
    studio.setSelected(selectedId)
  }, [tool, selectedId, ready, room])

  useEffect(() => {
    const canvas = hostRef.current?.querySelector('canvas')
    if (!canvas || !ready) return
    let drag: {
      mode: 'move' | 'draw'
      opening: RoomOpening
      grabAlong: number
      grabUp: number
      rawSpan: number
      rawHeight: number
    } | null = null

    const down = (event: PointerEvent) => {
      if (event.button !== 0 || toolRef.current === 'look' || !onChangeRef.current) return
      const hit = studioRef.current?.hit(event.clientX, event.clientY)
      if (!hit || hit.kind === 'busy') return
      if (hit.kind === 'opening') {
        const opening = openingsIn(roomRef.current).find((item) => item.id === hit.id)
        if (!opening) return
        drag = {
          mode: 'move',
          opening,
          grabAlong: hit.along - opening.along,
          grabUp: hit.up - opening.sill,
          rawSpan: opening.span,
          rawHeight: opening.height,
        }
        setSelectedId(opening.id)
        return
      }
      const kind = toolRef.current
      drag = {
        mode: 'draw',
        opening: {
          id: '__draft__',
          kind,
          wall: hit.wall,
          along: hit.along,
          span: 0,
          sill: kind === 'door' ? 0 : hit.up,
          height: 0,
          depth: kind === 'niche' ? 220 : 0,
        },
        grabAlong: hit.along,
        grabUp: hit.up,
        rawSpan: 0,
        rawHeight: 0,
      }
    }

    const move = (event: PointerEvent) => {
      if (!drag) return
      const hit = studioRef.current?.hit(event.clientX, event.clientY)
      if (!hit || hit.kind === 'busy') return
      const roomNow = roomRef.current
      const kind = drag.opening.kind
      let next: RoomOpening
      if (drag.mode === 'move') {
        next = clampOpening(roomNow, {
          ...drag.opening,
          wall: hit.wall,
          along: hit.along - drag.grabAlong,
          sill: kind === 'door' ? 0 : hit.up - drag.grabUp,
        })
        drag.rawSpan = next.span
        drag.rawHeight = next.height
      } else {
        const along = Math.min(drag.grabAlong, hit.along)
        const span = Math.abs(hit.along - drag.grabAlong)
        const height = kind === 'door' ? Math.max(drag.grabUp, hit.up) : Math.abs(hit.up - drag.grabUp)
        const sill = kind === 'door' ? 0 : Math.min(drag.grabUp, hit.up)
        drag.rawSpan = span
        drag.rawHeight = height
        next = clampOpening(roomNow, {
          ...drag.opening,
          wall: hit.wall,
          along,
          span,
          sill,
          height,
        })
      }
      drag.opening = next
      const others = openingsIn(roomNow).filter((item) => item.id !== next.id)
      studioRef.current?.preview([...others, next])
    }

    const up = () => {
      if (!drag) {
        return
      }
      const made = drag.opening
      const mode = drag.mode
      const rawSpan = drag.rawSpan
      const rawHeight = drag.rawHeight
      drag = null
      const roomNow = roomRef.current
      const change = onChangeRef.current
      if (!change) return
      if (mode === 'draw' && (rawSpan < 180 || rawHeight < 180)) {
        studioRef.current?.preview(openingsIn(roomNow))
        return
      }
      const saved = mode === 'draw' ? { ...made, id: generateId() } : made
      const others = openingsIn(roomNow).filter((item) => item.id !== made.id && item.id !== saved.id)
      change({ ...roomNow, openings: [...others, clampOpening(roomNow, saved)] })
      setSelectedId(saved.id)
    }

    const lookClick = (event: PointerEvent) => {
      if (event.button !== 0 || drag) return
      const hit = studioRef.current?.hit(event.clientX, event.clientY)
      if (hit?.kind === 'opening') setSelectedId(hit.id)
    }

    canvas.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    canvas.addEventListener('pointerup', lookClick)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointerup', lookClick)
    }
  }, [ready])

  const selected = openingsIn(room).find((opening) => opening.id === selectedId) ?? null
  const patchOpening = (part: Partial<RoomOpening>) => {
    if (!selected || !onChange) return
    const next = openingsIn(room).map((opening) =>
      opening.id === selected.id ? clampOpening(room, { ...opening, ...part }) : opening,
    )
    onChange({ ...room, openings: next })
  }

  return (
    <figure className="rounded-md border border-neutral-300 bg-white p-2">
      <figcaption className="mb-1 text-sm font-medium text-neutral-800">Снимка</figcaption>
      {onChange && (
        <div className="mb-2 flex flex-wrap gap-1">
          {(
            [
              ['look', 'Оглед'],
              ['window', 'Прозорец'],
              ['door', 'Врата'],
              ['niche', 'Ниша'],
            ] as [WallTool, string][]
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant="outline"
              className={
                tool === id
                  ? 'border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800'
                  : 'border-neutral-400 bg-white text-neutral-900 hover:bg-neutral-100'
              }
              onClick={() => setTool(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
      {failed ? (
        <p className="py-8 text-center text-sm text-neutral-600">Браузърът не пуска 3D картината.</p>
      ) : (
        <div ref={hostRef} className={`${tall ? 'h-[min(78vh,820px)]' : 'h-[640px]'} w-full overflow-hidden rounded-sm bg-[#c9d3dc]`} />
      )}
      <FrontButtons fronts={fronts} placed={placed} onToggle={(id) => studioRef.current?.toggle(id)} />
      <p className="mt-1 text-center text-[11px] text-neutral-500">
        {tool === 'look'
          ? 'Лявото копче върти, дясното мести настрани, колелцето приближава. Кликни прозорец, врата или ниша, за да напишеш размера.'
          : 'Дръпни по стената от тук до тук. После напиши точния размер или дръпни готовия отвор, за да го преместиш.'}
      </p>
      {onChange && selected && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <p className="w-full text-xs font-medium text-neutral-700">
            {OPENING_NAME[selected.kind]} · {WALL_NAME[selected.wall]}
          </p>
          <MmField label="Широчина" value={selected.span} onChange={(span) => patchOpening({ span })} />
          <MmField label="Височина" value={selected.height} onChange={(height) => patchOpening({ height })} />
          {selected.kind !== 'door' && (
            <MmField label="От пода" value={selected.sill} onChange={(sill) => patchOpening({ sill })} />
          )}
          <MmField label={wallAlongLabel(selected.wall)} value={selected.along} onChange={(along) => patchOpening({ along })} />
          {selected.kind === 'niche' && (
            <MmField label="Дълбочина" value={selected.depth} onChange={(depth) => patchOpening({ depth })} />
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-neutral-400 bg-white text-neutral-900 hover:bg-neutral-100"
            onClick={() => {
              onChange({ ...room, openings: openingsIn(room).filter((opening) => opening.id !== selected.id) })
              setSelectedId(null)
            }}
          >
            Махни
          </Button>
        </div>
      )}
      {placed.map(({ piece, cabinet }) => (
        <CabinetCapture key={piece.id} cabinet={cabinet} finishes={finishes} onSolids={onSolids} />
      ))}
    </figure>
  )
}

function MmField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-xs text-neutral-600">
      {label}
      <Input
        className="mt-1 h-8 w-28"
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
      />
    </label>
  )
}

function FrontButtons({
  fronts,
  placed,
  onToggle,
}: {
  fronts: RoomFront[]
  placed: { piece: { id: string }; cabinet: CabinetInstance }[]
  onToggle: (id: string) => void
}) {
  if (fronts.length === 0) return null
  const counts = new Map<string, number>()
  const rows = fronts.map((front) => {
    const pieceId = front.id.split(':')[0] ?? ''
    const bucket = `${pieceId}:${front.kind}`
    const n = (counts.get(bucket) ?? 0) + 1
    counts.set(bucket, n)
    const name = placed.find((row) => row.piece.id === pieceId)?.cabinet.name || 'Мебел'
    const what = front.kind === 'door' ? 'Врата' : 'Чекмедже'
    return { ...front, label: `${name} · ${what} ${n}`, action: front.open ? 'Затвори' : 'Отвори' }
  })
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900"
          onClick={() => onToggle(row.id)}
        >
          {row.label} · {row.action}
        </button>
      ))}
    </div>
  )
}
