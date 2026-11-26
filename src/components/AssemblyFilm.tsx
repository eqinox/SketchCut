import { useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { DecorSheetContext } from '@/lib/cabinets/draw-3d'
import type { CaptureStore } from '@/lib/cabinets/scene-solids'
import { AssemblyFilmContext } from '@/lib/assembly-context'
import { assemblyStages } from '@/lib/assembly-stages'
import { formatEur, formatMinutes, hourlyRateEur } from '@/lib/cabinets/estimate'
import { mountCabinetStudio, type CabinetStudio } from '@/lib/view3d/studio'

/** How long one scene stays on screen while playing. */
const SCENE_MS = 3200

/**
 * The cabinet put together scene by scene: each scene drops its pieces into place and says
 * what is done, how long it takes and what the work costs; below, the running total.
 */
export function AssemblyFilm({ store }: { store: CaptureStore }) {
  const solids = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const sheets = useContext(DecorSheetContext)
  const film = useContext(AssemblyFilmContext)
  const hostRef = useRef<HTMLDivElement>(null)
  const studioRef = useRef<CabinetStudio | null>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [at, setAt] = useState(0)
  const [playing, setPlaying] = useState(true)

  const stages = assemblyStages(solids, film?.steps ?? [])
  const last = Math.max(0, stages.length - 1)
  const index = Math.min(at, last)
  const stage = stages[index]
  const hourly = hourlyRateEur(film?.dailyRateEur ?? 0)
  const priceOf = (minutes: number) => (hourly > 0 ? formatEur((minutes / 60) * hourly) : null)
  const doneMinutes = stages.slice(0, index + 1).reduce((sum, item) => sum + item.minutes, 0)
  const totalMinutes = stages.reduce((sum, item) => sum + item.minutes, 0)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let studio: CabinetStudio
    try {
      studio = mountCabinetStudio(host, { onPick: () => {} })
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

  // The scene on screen: earlier scenes stand, this one's pieces drop in.
  const doneKey = stages.length > 0 ? `${index}/${stages.length}/${solids.length}` : ''
  useEffect(() => {
    const studio = studioRef.current
    if (!studio || stages.length === 0) return
    const done = stages.slice(0, index).flatMap((item) => item.solids)
    studio.setAssembly(done, stages[index].solids, solids, sheets)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey, ready, sheets])

  // Playing: on to the next scene after a while, and stop at the end.
  useEffect(() => {
    if (!playing) return
    if (index >= last) {
      const stop = window.setTimeout(() => setPlaying(false), 0)
      return () => window.clearTimeout(stop)
    }
    const timer = window.setTimeout(() => setAt(index + 1), SCENE_MS)
    return () => window.clearTimeout(timer)
  }, [playing, index, last])

  if (failed) {
    return <p className="py-8 text-center text-sm text-neutral-600">Браузърът не пуска 3D картината.</p>
  }

  const go = (next: number) => {
    setPlaying(false)
    setAt(Math.max(0, Math.min(last, next)))
  }
  const button = 'flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 disabled:opacity-40'
  return (
    <div className="w-full">
      <div ref={hostRef} className="relative h-[440px] w-full" />
      {stage && (
        <div className="mt-2 rounded-md border border-neutral-200 bg-white p-3 text-neutral-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Стъпка {index + 1} от {stages.length}: {stage.title}
            </p>
            <div className="flex items-center gap-1">
              <button type="button" className={button} disabled={index === 0} onClick={() => go(index - 1)} aria-label="Назад">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  if (!playing && index >= last) setAt(0)
                  setPlaying((on) => !on)
                }}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playing ? 'Пауза' : 'Пусни'}
              </button>
              <button type="button" className={button} disabled={index >= last} onClick={() => go(index + 1)} aria-label="Напред">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  setAt(0)
                  setPlaying(true)
                }}
                aria-label="Отначало"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-1 text-sm">
            {formatMinutes(stage.minutes)}
            {priceOf(stage.minutes) ? ` · ${priceOf(stage.minutes)} труд` : ''}
          </p>
          {stage.steps.length > 0 ? (
            <ul className="mt-1 list-disc pl-5 text-xs text-neutral-700">
              {stage.steps.map((step, i) => (
                <li key={`${step.id}-${i}`}>
                  {step.label} — {formatMinutes(step.minutes)}
                  {priceOf(step.minutes) ? ` · ${priceOf(step.minutes)}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-neutral-600">Тук само се слагат детайлите, без отделно време в цената.</p>
          )}
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-neutral-200">
            <div
              className="h-full bg-neutral-800 transition-all"
              style={{ width: `${totalMinutes > 0 ? (doneMinutes / totalMinutes) * 100 : ((index + 1) / stages.length) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            Досега {formatMinutes(doneMinutes)}
            {priceOf(doneMinutes) ? ` · ${priceOf(doneMinutes)}` : ''} от общо {formatMinutes(totalMinutes)}
            {priceOf(totalMinutes) ? ` · ${priceOf(totalMinutes)}` : ''} за сглобяване.
            {hourly > 0 ? '' : ' Сложи ставка в „Шкафове“, за да видиш и цената.'}
          </p>
        </div>
      )}
    </div>
  )
}
