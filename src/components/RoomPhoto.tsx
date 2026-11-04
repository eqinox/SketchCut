import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { CabinetPreview } from '@/components/CabinetPreview'
import { SceneCaptureContext, createCaptureStore, type CaptureStore, type SceneSolid } from '@/lib/cabinets/scene-solids'
import { cabinetOuterSize, isCombinationType } from '@/lib/cabinets/compose'
import { decorSheetFor, type DecorSheet } from '@/lib/finish-photo'
import type { BoardFinish } from '@/lib/board-finishes'
import { mountRoomStudio, type RoomFront, type RoomStudio } from '@/lib/view3d/room-photo'
import { pieceSpan, type RoomPlan } from '@/lib/room'
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
        />
      </div>
    </SceneCaptureContext.Provider>
  )
}

export function RoomPhoto({
  room,
  cabinets,
  finishes,
  tall = false,
}: {
  room: RoomPlan
  cabinets: CabinetInstance[]
  finishes: BoardFinish[]
  /** Taller picture for the shared link. */
  tall?: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const studioRef = useRef<RoomStudio | null>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [fronts, setFronts] = useState<RoomFront[]>([])
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

  return (
    <figure className="rounded-md border border-neutral-300 bg-white p-2">
      <figcaption className="mb-1 text-sm font-medium text-neutral-800">Снимка</figcaption>
      {failed ? (
        <p className="py-8 text-center text-sm text-neutral-600">Браузърът не пуска 3D картината.</p>
      ) : (
        <div ref={hostRef} className={`${tall ? 'h-[min(78vh,820px)]' : 'h-[640px]'} w-full overflow-hidden rounded-sm bg-[#c9d3dc]`} />
      )}
      <FrontButtons fronts={fronts} placed={placed} onToggle={(id) => studioRef.current?.toggle(id)} />
      <p className="mt-1 text-center text-[11px] text-neutral-500">
        Кликни вратата, чекмеджето или бутона под снимката. Завърти с мишката · колелцето приближава
      </p>
      {placed.map(({ piece, cabinet }) => (
        <CabinetCapture key={piece.id} cabinet={cabinet} finishes={finishes} onSolids={onSolids} />
      ))}
    </figure>
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
