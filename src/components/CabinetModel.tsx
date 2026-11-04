import { useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { DecorSheetContext } from '@/lib/cabinets/draw-3d'
import { PULL_CHOICES, PullChoiceContext, type PullSku } from '@/lib/cabinets/pulls'
import { SceneCaptureContext, createCaptureStore, type CaptureStore } from '@/lib/cabinets/scene-solids'
import { mountCabinetStudio, type CabinetStudio, type StudioPick } from '@/lib/view3d/studio'

export function CabinetModel({ store }: { store: CaptureStore }) {
  const solids = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const sheets = useContext(DecorSheetContext)
  const pulls = useContext(PullChoiceContext)
  const hostRef = useRef<HTMLDivElement>(null)
  const studioRef = useRef<CabinetStudio | null>(null)
  const [failed, setFailed] = useState(false)
  const [menu, setMenu] = useState<(StudioPick & { left: number; top: number }) | null>(null)
  const [opened, setOpened] = useState(false)
  const [handlesOpen, setHandlesOpen] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let studio: CabinetStudio
    try {
      studio = mountCabinetStudio(host, {
        onGestureStart: () => setMenu(null),
        onPick: (pick) => {
          const rect = host.getBoundingClientRect()
          const left = Math.min(Math.max(8, pick.clientX - rect.left), Math.max(8, rect.width - 220))
          const top = Math.min(Math.max(8, pick.clientY - rect.top), Math.max(8, rect.height - 220))
          setOpened(pick.open)
          setHandlesOpen(false)
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

  const current = menu ? (pulls?.skuFor(menu.pullKey) ?? 'normal') : 'none'
  return (
    <div className="relative h-[520px] w-full">
      <div ref={hostRef} className="h-full w-full" />
      {menu && (
        <div
          className="absolute z-20 w-52 rounded-md border border-neutral-300 bg-white p-1 text-sm text-neutral-900 shadow-lg"
          style={{ left: menu.left, top: menu.top }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {!handlesOpen && (
            <>
              <button
                type="button"
                className="w-full rounded px-2 py-1.5 text-left text-neutral-900 hover:bg-neutral-100"
                onClick={() => {
                  studioRef.current?.toggle(menu.animKey)
                  setMenu(null)
                }}
              >
                {opened ? 'Затвори' : 'Отвори'}
              </button>
              {pulls?.choose && (
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-neutral-900 hover:bg-neutral-100"
                  onClick={() => setHandlesOpen(true)}
                >
                  Смени дръжка
                </button>
              )}
            </>
          )}
          {handlesOpen && pulls?.choose && (
            <>
              {PULL_CHOICES.map((choice) => (
                <button
                  key={choice.sku}
                  type="button"
                  className={
                    choice.sku === current
                      ? 'w-full rounded bg-orange-50 px-2 py-1.5 text-left text-orange-900'
                      : 'w-full rounded px-2 py-1.5 text-left text-neutral-900 hover:bg-neutral-100'
                  }
                  onClick={() => {
                    pulls.choose?.(menu.pullKey, choice.sku as PullSku)
                    setMenu(null)
                  }}
                >
                  {choice.name}
                </button>
              ))}
            </>
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
  return (
    <SceneCaptureContext.Provider value={store}>
      <div className="relative w-full">
        <div className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" aria-hidden>
          {children}
        </div>
        <CabinetModel store={store} />
        <p className="mt-1 text-center text-[11px] text-neutral-500">
          Кликни врата или чекмедже: отваряне и смяна на дръжката · завърти с мишката · колелцето приближава
        </p>
      </div>
    </SceneCaptureContext.Provider>
  )
}
