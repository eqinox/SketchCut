import { useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { CabinetPreview } from '@/components/CabinetPreview'
import { Board, DecorSheetContext, createDrawCam } from '@/lib/cabinets/draw-3d'
import {
  arrangeMany,
  attachmentTouchesHost,
  cabinetOuterSize,
  groupOuterSize,
  isCombinationType,
  parseCombination,
  spanDoorCountOf,
  spanFrontBox,
} from '@/lib/cabinets/compose'
import { pullChoiceFrom, type PullSku } from '@/lib/cabinets/pulls'
import {
  DrawPlaceContext,
  SceneCaptureContext,
  createCaptureStore,
  type CaptureStore,
  type SceneSolid,
} from '@/lib/cabinets/scene-solids'
import type { BoardFinish } from '@/lib/board-finishes'
import { decorSheetFor, type DecorSheet } from '@/lib/finish-photo'
import type { ProjectRoom } from '@/lib/project-room'
import { defaultLift, pieceSpan, type RoomPiece } from '@/lib/room'
import { mountRoomStudio, type RoomPlacement, type RoomStudio } from '@/lib/view3d/room-photo'
import type { CabinetInstance } from '@/types'

function finishOf(finishes: BoardFinish[], id: unknown): BoardFinish | undefined {
  return typeof id === 'string' ? finishes.find((finish) => finish.id === id) : undefined
}

function MemberPreview({
  cabinet,
  finishes,
  hideDoors,
}: {
  cabinet: CabinetInstance
  finishes: BoardFinish[]
  hideDoors: boolean
}) {
  const carcass = finishOf(finishes, cabinet.params.carcassFinishId)
  const front = finishOf(finishes, cabinet.params.frontFinishId) ?? carcass
  const back = finishOf(finishes, cabinet.params.backFinishId)
  return (
    <CabinetPreview
      typeId={cabinet.typeId}
      params={cabinet.params}
      part="main"
      captureSolids
      showFronts
      hideDoors={hideDoors}
      doorView="closed"
      carcassColor={carcass?.color}
      carcassImage={carcass?.image}
      frontColor={front?.color}
      frontImage={front?.image}
      backColor={back?.color}
      backImage={back?.image}
      finishes={finishes}
    />
  )
}

function combinationCapture(cabinet: CabinetInstance, cabinets: CabinetInstance[], finishes: BoardFinish[]) {
  const parsed = parseCombination(cabinet.params)
  if (!parsed) return null
  const host = cabinets.find((item) => item.id === parsed.hostId)
  if (!host || isCombinationType(host.typeId)) return null
  const guests = parsed.members.flatMap((member, index) => {
    if (member.place === 'host') return []
    const item = cabinets.find((row) => row.id === member.cabinetId)
    if (!item || isCombinationType(item.typeId)) return []
    return [{ key: `${member.cabinetId}-${index}`, place: member.place, cabinet: item, span: member }]
  })
  const hostSize = cabinetOuterSize(host.typeId, host.params)
  const guestSizes = guests.map((guest) => cabinetOuterSize(guest.cabinet.typeId, guest.cabinet.params))
  const laid = arrangeMany(
    hostSize,
    guests.map((guest, index) => ({ size: guestSizes[index]!, place: guest.place })),
  )
  const rows = guests.map((guest) => ({ place: guest.place }))
  const handles = pullChoiceFrom(host.params)
  const doors: { x: number; y: number; w: number; h: number; at: 'left' | 'right' | 'center'; sku: PullSku }[] = []
  guests.forEach((guest, index) => {
    const leaves = spanDoorCountOf(guest.span)
    if (leaves < 1 || !attachmentTouchesHost(rows, index)) return
    const box = spanFrontBox(hostSize, guestSizes[index]!, guest.place, laid.host, laid.guests[index]!)
    const leafW = box.w / leaves
    for (let leaf = 0; leaf < leaves; leaf++) {
      const at = leaf === 0 ? 'right' : leaf === leaves - 1 ? 'left' : 'center'
      const x = box.x + leaf * leafW
      doors.push({ x, y: box.y, w: leafW, h: box.h, at, sku: handles.skuFor(`span:${Math.round(x)}:${Math.round(box.y)}`) })
    }
  })
  const front = finishOf(finishes, host.params.frontFinishId) ?? finishOf(finishes, host.params.carcassFinishId)
  return {
    host: { cabinet: host, at: laid.host, hideDoors: doors.length > 0 },
    guests: guests.map((guest, index) => ({
      key: guest.key,
      cabinet: guest.cabinet,
      at: laid.guests[index]!,
      hideDoors: spanDoorCountOf(guest.span) > 0 && attachmentTouchesHost(rows, index),
    })),
    doors,
    doorColor: front?.color || '#c4a06a',
  }
}

function NeighborCapture({
  cabinet,
  cabinets,
  finishes,
  onSolids,
}: {
  cabinet: CabinetInstance
  cabinets: CabinetInstance[]
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
  const group = isCombinationType(cabinet.typeId) ? combinationCapture(cabinet, cabinets, finishes) : null
  return (
    <SceneCaptureContext.Provider value={store}>
      <div className="hidden" aria-hidden>
        {group ? (
          <>
            {group.guests.map((guest) => (
              <DrawPlaceContext.Provider key={guest.key} value={{ x: guest.at.x, y: guest.at.y, localLeft: 0, localTop: 0 }}>
                <MemberPreview cabinet={guest.cabinet} finishes={finishes} hideDoors={guest.hideDoors} />
              </DrawPlaceContext.Provider>
            ))}
            <DrawPlaceContext.Provider value={{ x: group.host.at.x, y: group.host.at.y, localLeft: 0, localTop: 0 }}>
              <MemberPreview cabinet={group.host.cabinet} finishes={finishes} hideDoors={group.host.hideDoors} />
            </DrawPlaceContext.Provider>
            {group.doors.map((door) => (
              <Board
                key={`${door.x}-${door.y}-${door.w}`}
                x={door.x}
                y={door.y}
                z={0}
                w={door.w}
                h={door.h}
                d={18}
                color={group.doorColor}
                cam={createDrawCam({ ox: 0, oy: 0 })}
                faces={{ front: true, top: true, right: true }}
                pull={door.sku === 'none' ? undefined : { key: `span:${Math.round(door.x)}:${Math.round(door.y)}`, sku: door.sku, at: door.at }}
              />
            ))}
          </>
        ) : (
          <MemberPreview cabinet={cabinet} finishes={finishes} hideDoors={false} />
        )}
      </div>
    </SceneCaptureContext.Provider>
  )
}

function solidFoot(solids: SceneSolid[]): { w: number; d: number; h: number } {
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  const grow = (x: number, y: number, z: number, w: number, h: number, d: number) => {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x + w)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y + h)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z + d)
  }
  for (const solid of solids) {
    if (solid.kind === 'box') grow(solid.x, solid.y, solid.z, solid.w, solid.h, solid.d)
    else if (solid.kind === 'rail') grow(solid.x, solid.y, Math.min(solid.z0, solid.z1), solid.w, solid.h, Math.abs(solid.z1 - solid.z0))
    else if (solid.kind === 'door') {
      const x = solid.side === 'left' ? solid.hingeX : solid.hingeX - solid.width
      grow(x, solid.y, solid.z, solid.width, solid.height, solid.thickness)
    }
  }
  if (!Number.isFinite(minX)) return { w: 600, d: 560, h: 720 }
  return { w: Math.max(1, maxX - minX), d: Math.max(1, maxZ - minZ), h: Math.max(1, maxY - minY) }
}

function overlaps(
  a: { x: number; y: number; w: number; d: number },
  b: { x: number; y: number; w: number; d: number },
) {
  return a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.d - 1 && a.y + a.d > b.y + 1
}

function freeSeat(
  room: ProjectRoom['room'],
  taken: { x: number; y: number; w: number; d: number }[],
  foot: { w: number; d: number; h: number },
  typeId: string,
): Pick<RoomPiece, 'x' | 'y' | 'lift' | 'turn'> {
  const lift = defaultLift(typeId, foot.h, room.height)
  const againstBack = {
    x: Math.max(0, Math.round((room.width - foot.w) / 2)),
    y: Math.max(0, room.depth - foot.d),
    w: foot.w,
    d: foot.d,
  }
  if (
    againstBack.x + foot.w <= room.width + 1 &&
    againstBack.y + foot.d <= room.depth + 1 &&
    !taken.some((row) => overlaps(againstBack, row))
  ) {
    return { x: againstBack.x, y: againstBack.y, lift, turn: 0 }
  }
  const step = 100
  const limitX = Math.max(0, room.width - foot.w)
  const limitY = Math.max(0, room.depth - foot.d)
  for (let y = 0; y <= limitY; y += step) {
    for (let x = 0; x <= limitX; x += step) {
      const box = { x, y, w: foot.w, d: foot.d }
      if (!taken.some((row) => overlaps(box, row))) return { x, y, lift, turn: 0 }
    }
  }
  return { x: 0, y: 0, lift, turn: 0 }
}

export function CabinetRoom({ scene, solids }: { scene: ProjectRoom; solids: SceneSolid[] }) {
  const liveSheets = useContext(DecorSheetContext)
  const hostRef = useRef<HTMLDivElement>(null)
  const studioRef = useRef<RoomStudio | null>(null)
  const [failed, setFailed] = useState(false)
  const [packs, setPacks] = useState<ReadonlyMap<string, SceneSolid[]>>(new Map())
  const [finishSheets, setFinishSheets] = useState<ReadonlyMap<string, DecorSheet>>(new Map())

  const onSolids = useCallback((id: string, next: SceneSolid[]) => {
    setPacks((prev) => {
      if (prev.get(id) === next) return prev
      const map = new Map(prev)
      map.set(id, next)
      return map
    })
  }, [])

  const sheetKey = scene.finishes.map((finish) => `${finish.color}\n${finish.image ?? ''}`).join('|')
  useEffect(() => {
    let cancel = false
    const unique = new Map<string, string>()
    for (const finish of scene.finishes) {
      if (!finish.color || !finish.image) continue
      unique.set(finish.color.toLowerCase(), finish.image)
    }
    if (unique.size === 0) {
      setFinishSheets(new Map())
      return
    }
    void Promise.all([...unique.entries()].map(async ([color, image]) => [color, await decorSheetFor(image)] as const))
      .then((pairs) => {
        if (!cancel) setFinishSheets(new Map(pairs))
      })
      .catch(() => {
        if (!cancel) setFinishSheets(new Map())
      })
    return () => {
      cancel = true
    }
  }, [sheetKey, scene.finishes])

  const sheets = useMemo(() => {
    const merged = new Map(finishSheets)
    for (const [color, sheet] of liveSheets) merged.set(color, sheet)
    return merged
  }, [finishSheets, liveSheets])

  const neighbors = useMemo(
    () =>
      scene.room.pieces.flatMap((piece) => {
        if (scene.replaceIds.includes(piece.cabinetId)) return []
        const cabinet = scene.cabinets.find((item) => item.id === piece.cabinetId)
        if (!cabinet || !groupOuterSize(cabinet, scene.cabinets)) return []
        return [{ piece, cabinet }]
      }),
    [scene.room.pieces, scene.replaceIds, scene.cabinets],
  )

  const placed = useMemo(() => {
    const taken = neighbors.flatMap(({ piece, cabinet }) => {
      const outer = groupOuterSize(cabinet, scene.cabinets)
      if (!outer) return []
      const box = pieceSpan(piece.turn, outer.w, outer.d)
      return [{ x: piece.x, y: piece.y, w: box.w, d: box.d }]
    })
    const foot = solidFoot(solids)
    const saved = scene.anchorIds.flatMap((id) => scene.room.pieces.filter((piece) => piece.cabinetId === id))
    const spots: RoomPiece[] = scene.group
      ? saved.slice(0, 1)
      : saved
    const here: RoomPiece[] =
      spots.length > 0
        ? spots
        : solids.length === 0
          ? []
          : [{ id: 'here', cabinetId: 'here', ...freeSeat(scene.room, taken, foot, scene.typeId) }]
    const own: RoomPlacement[] = here.map((piece) => {
      const box = pieceSpan(piece.turn, foot.w, foot.d)
      return {
        id: piece.id,
        x: piece.x,
        y: piece.y,
        lift: piece.lift,
        turn: piece.turn,
        w: box.w,
        d: box.d,
        solids,
        dims: 'detail' as const,
      }
    })
    const rest: RoomPlacement[] = neighbors.flatMap(({ piece, cabinet }) => {
      const outer = groupOuterSize(cabinet, scene.cabinets)
      if (!outer) return []
      const box = pieceSpan(piece.turn, outer.w, outer.d)
      return [{
        id: piece.id,
        x: piece.x,
        y: piece.y,
        lift: piece.lift,
        turn: piece.turn,
        w: box.w,
        d: box.d,
        solids: (packs.get(piece.cabinetId) ?? []).filter((solid) => solid.kind !== 'dim'),
        dims: 'none' as const,
      }]
    })
    return { own, rest, anchored: spots.length > 0 }
  }, [neighbors, scene, solids, packs])

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
    return () => {
      studio.dispose()
      studioRef.current = null
    }
  }, [])

  useEffect(() => {
    const focus = placed.own[0]?.id
    studioRef.current?.setRoom(scene.room, [...placed.rest, ...placed.own], sheets, focus)
  }, [scene.room, placed, sheets])

  if (failed) {
    return <p className="py-8 text-center text-sm text-neutral-600">Браузърът не пуска 3D картината.</p>
  }

  const neighborCabinets = useMemo(() => {
    const seen = new Set<string>()
    return neighbors.flatMap(({ cabinet }) => {
      if (seen.has(cabinet.id)) return []
      seen.add(cabinet.id)
      return [cabinet]
    })
  }, [neighbors])

  return (
    <div>
      {neighborCabinets.map((cabinet) => (
        <NeighborCapture
          key={cabinet.id}
          cabinet={cabinet}
          cabinets={scene.cabinets}
          finishes={scene.finishes}
          onSolids={onSolids}
        />
      ))}
      <div className="relative h-[560px] w-full">
        <div ref={hostRef} className="h-full w-full" />
      </div>
      <p className="mt-1 text-center text-[11px] text-neutral-500">
        {placed.anchored
          ? 'Размерите се четат и докато въртиш. Клик отваря врата или чекмедже. Колелцето приближава.'
          : 'Размерите се четат и докато въртиш. Този шкаф още не е в плана и стои на свободно място.'}
      </p>
    </div>
  )
}
