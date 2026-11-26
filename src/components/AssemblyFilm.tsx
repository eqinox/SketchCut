import { useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronLeft, ChevronRight, FastForward, Pause, Play, RotateCcw } from 'lucide-react'
import { DecorSheetContext } from '@/lib/cabinets/draw-3d'
import type { CaptureStore } from '@/lib/cabinets/scene-solids'
import { AssemblyFilmContext } from '@/lib/assembly-context'
import { assemblyStages } from '@/lib/assembly-stages'
import { benchPlan } from '@/lib/bench-plan'
import { isSoftCloseSlide } from '@/lib/cabinets/hardware'
import { formatEur, formatMinutes, hourlyRateEur } from '@/lib/cabinets/estimate'
import { mountCabinetStudio, type CabinetStudio } from '@/lib/view3d/studio'
import { benchCounts, mountWorkbench, type Workbench } from '@/lib/view3d/workbench'

/** How long one assembly scene stays on screen while playing. */
const SCENE_MS = 3200
/** After a bench job ends, a short pause before the next scene. */
const AFTER_BENCH_MS = 900
const FAST_SPEED = 3

/**
 * The cabinet put together scene by scene. First the jobs on the loose boards, on the bench:
 * pencil marks, shelf-pin holes and pins, drawer slides with their screws. Then the carcass
 * and the rest, each scene dropping its pieces into place. Each scene says what is done, how long
 * it takes and what the work costs; below, the running total.
 */
export function AssemblyFilm({ store }: { store: CaptureStore }) {
  const solids = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const sheets = useContext(DecorSheetContext)
  const film = useContext(AssemblyFilmContext)
  const hostRef = useRef<HTMLDivElement>(null)
  const benchHostRef = useRef<HTMLDivElement>(null)
  const studioRef = useRef<CabinetStudio | null>(null)
  const benchRef = useRef<Workbench | null>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [at, setAt] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [fast, setFast] = useState(false)
  const [benchDone, setBenchDone] = useState('')

  const soft = film?.slideKind ? isSoftCloseSlide(film.slideKind) : false
  const boards = benchPlan(solids)
  const counts = benchCounts(boards)
  const stages = assemblyStages(solids, film?.steps ?? [], {
    mark: counts.lines + counts.points > 0,
    pins: counts.points > 0,
    slides: counts.slides > 0,
  })
  const last = Math.max(0, stages.length - 1)
  const index = Math.min(at, last)
  const stage = stages[index]
  const onBench = !!stage?.bench
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

  // The bench: built again only when the boards or their marks change.
  const benchKey = `${soft}:${JSON.stringify(boards)}`
  useEffect(() => {
    const host = benchHostRef.current
    if (!host || boards.length === 0) return
    let bench: Workbench
    try {
      bench = mountWorkbench(host, boards, soft)
    } catch {
      return
    }
    benchRef.current = bench
    return () => {
      bench.dispose()
      benchRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchKey])

  useEffect(() => {
    benchRef.current?.setSpeed(fast ? FAST_SPEED : 1)
  }, [fast, benchKey])

  // The scene on screen: on the bench a job plays; otherwise earlier scenes stand and this one's
  // pieces drop in.
  const sceneKey = stages.length > 0 ? `${index}/${stages.length}/${solids.length}/${benchKey}` : ''
  useEffect(() => {
    if (!stage) return
    if (stage.bench) {
      const key = sceneKey
      benchRef.current?.play(stage.bench, () => setBenchDone(key))
      return
    }
    const studio = studioRef.current
    if (!studio) return
    const done = stages.slice(0, index).flatMap((item) => item.solids)
    studio.setAssembly(done, stage.solids, solids, sheets)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey, ready, sheets])

  // Playing: on to the next scene after a while (on the bench, once the job is done).
  useEffect(() => {
    if (!playing) return
    if (index >= last && (!onBench || benchDone === sceneKey)) {
      const stop = window.setTimeout(() => setPlaying(false), onBench ? AFTER_BENCH_MS : SCENE_MS)
      return () => window.clearTimeout(stop)
    }
    if (onBench && benchDone !== sceneKey) return
    const wait = onBench ? AFTER_BENCH_MS : SCENE_MS / (fast ? FAST_SPEED : 1)
    const timer = window.setTimeout(() => setAt(index + 1), wait)
    return () => window.clearTimeout(timer)
  }, [playing, index, last, onBench, benchDone, sceneKey, fast])

  if (failed) {
    return <p className="py-8 text-center text-sm text-neutral-600">Браузърът не пуска 3D картината.</p>
  }

  const go = (next: number) => {
    setPlaying(false)
    setAt(Math.max(0, Math.min(last, next)))
  }
  const button = 'flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 disabled:opacity-40'
  const benchNote =
    stage?.bench === 'mark'
      ? `Детайлите лежат на масата с вътрешната страна нагоре. С молив: ${counts.lines} линии (водачи, неподвижни рафтове, разделители) и ${counts.points} точки за рафтоносачи.`
      : stage?.bench === 'pins'
        ? `На всяка от ${counts.points} точки: център с шило и чук, дупка с бормашина и свредло 4,5 мм, после рафтоносачът се набива с чук.`
        : stage?.bench === 'slides'
          ? `${counts.slides} ${soft ? 'водача с плавно прибиране' : 'ролкови водача'} по начертаните линии. На всеки по 3 винта: в първата дупка, в последната и в средата.`
          : ''
  return (
    <div className="w-full">
      <div className="relative h-[440px] w-full">
        <div ref={hostRef} className={`absolute inset-0 ${onBench ? 'invisible' : ''}`} />
        <div ref={benchHostRef} className={`absolute inset-0 ${onBench ? '' : 'invisible'}`} />
      </div>
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
                className={`${button} ${fast ? 'border-neutral-900 bg-neutral-900 text-white' : ''}`}
                aria-pressed={fast}
                onClick={() => setFast((on) => !on)}
              >
                <FastForward className="h-4 w-4" />
                По-бързо
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  setAt(0)
                  setBenchDone('')
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
          {benchNote && <p className="mt-1 text-xs text-neutral-700">{benchNote}</p>}
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
            <p className="mt-1 text-xs text-neutral-600">Тук няма отделно време в цената.</p>
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
