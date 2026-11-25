import { useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { DecorSheetContext } from '@/lib/cabinets/draw-3d'
import { PULL_CHOICES, PullChoiceContext, type PullSku } from '@/lib/cabinets/pulls'
import { SceneCaptureContext, createCaptureStore, type CaptureStore } from '@/lib/cabinets/scene-solids'
import { CabinetRoom } from '@/components/CabinetRoom'
import { ProjectRoomContext } from '@/lib/project-room'
import { PieceColorChoiceContext } from '@/lib/piece-color-choice'
import { KronospanColorGrid, KronospanFinishOptions } from '@/components/KronospanColors'
import { kronospanBoardId, kronospanCodeFromFinish } from '@/lib/kronospan-color'
import { mountCabinetStudio, type CabinetStudio, type StudioPick } from '@/lib/view3d/studio'

export function CabinetModel({ store }: { store: CaptureStore }) {
  const solids = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const sheets = useContext(DecorSheetContext)
  const pulls = useContext(PullChoiceContext)
  const pieceColors = useContext(PieceColorChoiceContext)
  const hostRef = useRef<HTMLDivElement>(null)
  const studioRef = useRef<CabinetStudio | null>(null)
  const [failed, setFailed] = useState(false)
  const [menu, setMenu] = useState<(StudioPick & { left: number; top: number }) | null>(null)
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let studio: CabinetStudio
    try {
      studio = mountCabinetStudio(host, {
        onGestureStart: () => setMenu(null),
        onPick: (pick) => {
          // Left click opens or closes the door at once. Right click (or a tap) asks what to do.
          // The back has nothing to choose yet.
          if (pick.kind === 'board' && (!pick.piece || pick.piece.startsWith('back'))) return
          if (!pick.menu && !pick.touch && pick.kind !== 'board') {
            studioRef.current?.toggle(pick.animKey)
            setMenu(null)
            return
          }
          const rect = host.getBoundingClientRect()
          const left = Math.min(Math.max(8, pick.clientX - rect.left), Math.max(8, rect.width - 330))
          const top = Math.min(Math.max(8, pick.clientY - rect.top), Math.max(8, rect.height - 470))
          setOpened(pick.open)
          setMenu({ ...pick, left, top })
        },
      })
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
    studioRef.current?.setContent(solids, sheets)
  }, [solids, sheets])

  if (failed) {
    return <p className="py-8 text-center text-sm text-neutral-600">Браузърът не пуска 3D картината.</p>
  }

  const current = menu && menu.kind !== 'board' ? (pulls?.skuFor(menu.pullKey) ?? 'normal') : 'none'
  const ownColor = menu?.piece && pieceColors ? pieceColors.current(menu.piece) : ''
  // A bed's slat frame on a lift mechanism opens like a door but has no handle.
  const isLift = Boolean(menu?.animKey.includes('lift:'))
  // A mirror's light is "closed" when lit, like a door at rest.
  const isLight = Boolean(menu?.animKey.includes('light:'))
  const title = isLight
    ? 'Осветление на огледалото'
    : isLift
    ? 'Подматрачна рамка'
    : menu?.piece && pieceColors
      ? pieceColors.label(menu.piece)
      : menu?.kind === 'drawer'
        ? 'Чекмедже'
        : 'Врата'
  return (
    <div className="relative h-[520px] w-full">
      <div ref={hostRef} className="h-full w-full" />
      {menu && (
        <div
          role="menu"
          aria-label={title}
          className="absolute z-20 flex w-80 flex-col gap-2 rounded-md border border-neutral-300 bg-white p-2 text-sm text-neutral-900 shadow-lg"
          style={{ left: menu.left, top: menu.top }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{title}</span>
            <button
              type="button"
              aria-label="Затвори менюто"
              className="rounded px-1.5 text-neutral-500 hover:bg-neutral-100"
              onClick={() => setMenu(null)}
            >
              ×
            </button>
          </div>
          {menu.kind !== 'board' && (
            <button
              type="button"
              className="rounded border border-neutral-200 px-2 py-1 text-left hover:bg-neutral-100"
              onClick={() => {
                studioRef.current?.toggle(menu.animKey)
                setMenu(null)
              }}
            >
              {isLight ? (opened ? 'Включи' : 'Изключи') : isLift ? (opened ? 'Свали' : 'Повдигни') : opened ? 'Затвори' : 'Отвори'}
            </button>
          )}
          {menu.kind !== 'board' && !isLift && !isLight && pulls?.choose && (
            <label className="flex flex-col gap-1 text-xs text-neutral-600">
              Дръжка
              <select
                aria-label="Дръжка на тази врата"
                className="h-8 rounded border border-neutral-300 bg-white px-1 text-sm text-neutral-900"
                value={current}
                onChange={(event) => {
                  pulls.choose?.(menu.pullKey, event.target.value as PullSku)
                  setMenu(null)
                }}
              >
                {PULL_CHOICES.map((choice) => (
                  <option key={choice.sku} value={choice.sku}>
                    {choice.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {/* The back is always white fibreboard for now, so it has no colour choice. */}
          {menu.piece && pieceColors && !menu.piece.startsWith('back') && (
            <div className="flex flex-col gap-1 text-xs text-neutral-600">
              <span>Цвят само на този детайл</span>
              <select
                aria-label="Цвят само на този детайл"
                className="h-8 rounded border border-neutral-300 bg-white px-1 text-sm text-neutral-900"
                value={ownColor}
                onChange={(event) => {
                  if (menu.piece) pieceColors.choose(menu.piece, event.target.value)
                }}
              >
                <option value="">Като останалите</option>
                <KronospanFinishOptions finishes={pieceColors.finishes} />
              </select>
              <span className="text-[11px] leading-snug">
                {ownColor
                  ? '🔒 Свой цвят: остава такъв, дори да смениш корпуса или вратите.'
                  : 'Избери цвят и той ще остане такъв, дори да смениш корпуса или вратите.'}
              </span>
              {/* The same colour squares as in "Цветове", for this one piece. */}
              <div className="max-h-64 overflow-y-auto rounded border border-neutral-200 p-1.5 text-neutral-900">
                <KronospanColorGrid
                  finishes={pieceColors.finishes}
                  selectedCode={kronospanCodeFromFinish({ id: ownColor })}
                  selectedId={ownColor}
                  onPick={(board) => {
                    if (menu.piece) pieceColors.choose(menu.piece, kronospanBoardId(board))
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function CapturedModel({ children }: { children: ReactNode }) {
  const storeRef = useRef<CaptureStore | null>(null)
  if (!storeRef.current) storeRef.current = createCaptureStore()
  const store = storeRef.current
  const solids = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const scene = useContext(ProjectRoomContext)
  return (
    <SceneCaptureContext.Provider value={store}>
      <div className="relative w-full">
        <div className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" aria-hidden>
          {children}
        </div>
        {scene ? (
          <CabinetRoom scene={scene} solids={solids} />
        ) : (
          <>
            <CabinetModel store={store} />
            <p className="mt-1 text-center text-[11px] text-neutral-500">
              Размерите се четат и докато въртиш · клик на врата или чекмедже го отваря · десен клик на детайл: дръжка и свой цвят · колелцето приближава
            </p>
          </>
        )}
      </div>
    </SceneCaptureContext.Provider>
  )
}
