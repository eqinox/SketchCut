import { useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronLeft, ChevronRight, FastForward, Pause, Play, RotateCcw } from 'lucide-react'
import { DecorSheetContext } from '@/lib/cabinets/draw-3d'
import type { CaptureStore } from '@/lib/cabinets/scene-solids'
import { AssemblyFilmContext } from '@/lib/assembly-context'
import { assemblyStages } from '@/lib/assembly-stages'
import { benchGroups } from '@/lib/bench-plan'
import { isSoftCloseSlide } from '@/lib/cabinets/hardware'
import { formatEur, formatMinutes, hourlyRateEur } from '@/lib/cabinets/estimate'
import { mountCabinetStudio, type CabinetStudio } from '@/lib/view3d/studio'
import { mountWorkbench, type BenchOp, type Workbench } from '@/lib/view3d/workbench'
import type { AssemblyStep } from '@/lib/assembly-time'

/** How long a scene with nothing moving stays on screen while playing. */
const SCENE_MS = 3200
/** After a scene's work ends, a short pause before the next one. */
const AFTER_MS = 900
const FAST_SPEED = 3

/** Each job on the bench: its name on the label and the priced steps it belongs to. */
const BENCH_OPS: Record<BenchOp, { title: string; steps: (id: string) => boolean; otherwise: string }> = {
  'line:bottom': { title: 'Линии за дъното', steps: () => false, otherwise: 'без отделно време' },
  'line:fixed': { title: 'Линии за фиксиран рафт', steps: (id) => id === 'mark-fixed-shelf', otherwise: 'без отделно време' },
  'line:slide': { title: 'Линия за водач', steps: (id) => id.startsWith('mark-drawer'), otherwise: 'във времето за водачите' },
  'line:divider': {
    title: 'Линии за разделителна страница',
    steps: (id) => id === 'mark-partition-bottom' || id === 'mark-partition-top',
    otherwise: 'без отделно време',
  },
  cross: { title: 'Кръстче за лоста', steps: (id) => id === 'mark-clothes-rail', otherwise: 'във времето за лоста' },
  point: {
    title: 'Изчисление и точки за рафтоносачи',
    steps: (id) => id === 'mark-shelf-pins' || id === 'mark-shelf-pins-calc',
    otherwise: 'без отделно време',
  },
  dent: { title: 'Център с шило и чук', steps: (id) => id === 'shelf-pins-dent', otherwise: 'без отделно време' },
  drill: { title: 'Пробиване с бургия 4,5', steps: (id) => id === 'shelf-pins-drill', otherwise: 'без отделно време' },
  pin: { title: 'Набиване на рафтоносачите', steps: (id) => id === 'shelf-pins', otherwise: 'без отделно време' },
  slide: { title: 'Водачите на местата им', steps: (id) => id.startsWith('drawer-guides'), otherwise: 'без отделно време' },
  screw: { title: 'Винтовете на водачите', steps: (id) => id.startsWith('drawer-guides'), otherwise: 'без отделно време' },
  swap: { title: 'Смяна на плоскостта на масата', steps: (id) => id.endsWith('-swap'), otherwise: 'без отделно време' },
}

/** To the second: „55 сек“, „1 мин 30 сек“, „1 ч 5 мин“. */
function clock(minutes: number): string {
  const total = Math.round(minutes * 60)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  if (h > 0) return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
  if (m === 0) return `${sec} сек`
  return sec > 0 ? `${m} мин ${sec} сек` : `${m} мин`
}

/** The label text: what is done, how long it takes in this cabinet altogether, and its price. */
function tagText(title: string, steps: AssemblyStep[], price: (minutes: number) => string | null, otherwise: string): string {
  if (steps.length === 0) return `${title} · ${otherwise}`
  const minutes = steps.reduce((sum, step) => sum + step.minutes, 0)
  const cost = price(minutes)
  return `${title} · ${clock(minutes)}${cost ? ` · ${cost}` : ''}`
}

/**
 * The cabinet put together scene by scene, the way the workshop does it. First the loose boards on
 * the bench, a group at a time: pencil marks, shelf-pin holes and pins, drawer slides with their
 * screws. Then the carcass piece by piece, the backs nailed on with the cabinet on its front, and
 * the drawers. Each scene says what is done, how long it takes and what the work costs; below, the
 * running total.
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
  /** How fast the 3D work runs: 0 while paused. */
  const pace = playing ? (fast ? FAST_SPEED : 1) : 0
  const [sceneDone, setSceneDone] = useState('')
  /** Goes up on „Отначало“, so the scene plays again even when it is already the one on screen. */
  const [round, setRound] = useState(0)

  const soft = film?.slideKind ? isSoftCloseSlide(film.slideKind) : false
  const groups = benchGroups(solids)
  const stages = assemblyStages(solids, film?.steps ?? [], groups)
  const last = Math.max(0, stages.length - 1)
  const index = Math.min(at, last)
  const stage = stages[index]
  const onBench = !!stage?.bench
  const benchGroup = stage?.bench ? groups[stage.bench.group] : null
  // A scene where nothing moves (the edge band) just stays a while.
  const still = !stage?.bench && (stage?.build?.motion.batches.length ?? 0) === 0 && stage?.build?.motion.fromPose === undefined
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

  // The bench: built again only when another group of boards comes on, or its marks change.
  const benchKey = benchGroup ? `${soft}:${stage?.bench?.group}:${JSON.stringify(benchGroup)}` : ''
  useEffect(() => {
    const host = benchHostRef.current
    if (!host || !benchGroup) return
    let bench: Workbench
    try {
      bench = mountWorkbench(host, benchGroup, soft)
    } catch {
      return
    }
    bench.setSpeed(pace)
    benchRef.current = bench
    return () => {
      bench.dispose()
      benchRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchKey])

  // Paused, everything on screen stands still where it is; „По-бързо“ runs it three times as fast.
  useEffect(() => {
    benchRef.current?.setSpeed(pace)
    studioRef.current?.setSpeed(pace)
  }, [pace, benchKey, ready])

  // Beside the tool or the piece: what is done, its time and its price.
  const allSteps = film?.steps ?? []
  const describe = (op: BenchOp) => {
    const job = BENCH_OPS[op]
    return tagText(job.title, allSteps.filter((step) => job.steps(step.id)), priceOf, job.otherwise)
  }
  const stageTag = stage && !stage.bench ? tagText(stage.title, stage.steps, priceOf, 'без отделно време') : null
  useEffect(() => {
    benchRef.current?.setDescribe(describe)
    studioRef.current?.setTag(stageTag)
  })

  // The scene on screen: on the bench a job plays; otherwise what stands is shown and this
  // scene's work plays on it.
  const sceneKey = stages.length > 0 ? `${round}:${index}/${stages.length}/${solids.length}/${benchKey}` : ''
  useEffect(() => {
    if (!stage) return
    const key = sceneKey
    if (stage.bench) {
      benchRef.current?.play(stage.bench.job, () => setSceneDone(key))
      return
    }
    const studio = studioRef.current
    if (!studio || !stage.build) return
    // Framed on everything the film shows, the drawers made in front of the cabinet too.
    const framing = [...new Set(stages.flatMap((item) => [...(item.build?.standing ?? []), ...(item.build?.motion.batches.flatMap((batch) => batch.solids) ?? [])]))]
    studio.setAssembly(stage.build.standing, stage.build.motion, framing, sheets, () => setSceneDone(key))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey, ready, sheets])

  // Playing: on to the next scene a moment after this one's work is done.
  useEffect(() => {
    if (!playing || sceneDone !== sceneKey) return
    const wait = (still ? SCENE_MS : AFTER_MS) / (fast ? FAST_SPEED : 1)
    if (index >= last) {
      const stop = window.setTimeout(() => setPlaying(false), wait)
      return () => window.clearTimeout(stop)
    }
    const timer = window.setTimeout(() => setAt(index + 1), wait)
    return () => window.clearTimeout(timer)
  }, [playing, index, last, still, sceneDone, sceneKey, fast])

  if (failed) {
    return <p className="py-8 text-center text-sm text-neutral-600">Браузърът не пуска 3D картината.</p>
  }

  const go = (next: number) => {
    setAt(Math.max(0, Math.min(last, next)))
  }
  const button = 'flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 disabled:opacity-40'
  return (
    <div className="w-full">
      <div className="relative h-[440px] w-full">
        <div ref={hostRef} className={`absolute inset-0 ${onBench ? 'invisible' : ''}`} />
        <div ref={benchHostRef} className={`absolute inset-0 ${onBench ? '' : 'invisible'}`} />
        {stage && (
          // On the picture itself: what the whole assembly takes and costs, and how far it has got.
          <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-white/90 px-2.5 py-1.5 text-neutral-900 shadow-sm">
            <p className="text-sm font-semibold">
              Целият шкаф: {formatMinutes(totalMinutes)}
              {priceOf(totalMinutes) ? ` · ${priceOf(totalMinutes)}` : ''}
            </p>
            <p className="text-xs">
              Досега: {formatMinutes(doneMinutes)}
              {priceOf(doneMinutes) ? ` · ${priceOf(doneMinutes)}` : ''}
            </p>
            {hourly > 0 ? null : <p className="text-xs text-neutral-600">Без ставка: сложи я в „Шкафове“</p>}
          </div>
        )}
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
                  setRound((n) => n + 1)
                  setSceneDone('')
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
          {stage.note && <p className="mt-1 text-xs text-neutral-700">{stage.note}</p>}
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
