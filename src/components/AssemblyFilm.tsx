import { useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronLeft, ChevronRight, FastForward, Pause, Play, RotateCcw, Turtle } from 'lucide-react'
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

/** Each job on the bench: its name on the label, what one piece of it is, and the priced steps. */
const BENCH_OPS: Record<BenchOp, { title: string; unit?: string; steps: (id: string) => boolean; otherwise: string }> = {
  'line:bottom': { title: 'Линии за дъното', unit: '2 линии', steps: (id) => id === 'mark-bottom', otherwise: 'без отделно време' },
  'line:fixed': { title: 'Линии за фиксиран рафт', unit: '2 линии', steps: (id) => id === 'mark-fixed-shelf', otherwise: 'без отделно време' },
  'line:slide': { title: 'Линия за водач', unit: 'линия', steps: (id) => id.startsWith('mark-drawer'), otherwise: 'във времето за водачите' },
  'line:divider': {
    title: 'Линии за разделителна страница',
    unit: '2 линии',
    steps: (id) => id === 'mark-partition-bottom' || id === 'mark-partition-top',
    otherwise: 'без отделно време',
  },
  cross: { title: 'Кръстче за лоста', unit: 'кръстче', steps: (id) => id === 'mark-clothes-rail', otherwise: 'във времето за лоста' },
  point: {
    title: 'Изчисление и точки за рафтоносачи',
    unit: 'точка',
    steps: (id) => id === 'mark-shelf-pins' || id === 'mark-shelf-pins-calc',
    otherwise: 'без отделно време',
  },
  dent: { title: 'Център с шило и чук', unit: 'точка', steps: (id) => id === 'shelf-pins-dent', otherwise: 'без отделно време' },
  drill: { title: 'Пробиване с бургия 4,5', unit: 'дупка', steps: (id) => id === 'shelf-pins-drill', otherwise: 'без отделно време' },
  pin: { title: 'Набиване на рафтоносачите', unit: 'рафтоносач', steps: (id) => id === 'shelf-pins', otherwise: 'без отделно време' },
  slide: { title: 'Водач на мястото си', unit: 'водач', steps: (id) => id.startsWith('drawer-guides'), otherwise: 'без отделно време' },
  screw: { title: 'Винтове на водача', unit: 'водач', steps: (id) => id.startsWith('drawer-guides'), otherwise: 'без отделно време' },
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
  /** Every repeat as slow as the first ones (otherwise the rest of a long job is hurried). */
  const [allSlow, setAllSlow] = useState(false)
  /** True while the bar under the picture is held: the film stands still under the finger. */
  const [scrubbing, setScrubbing] = useState(false)
  /** How fast the 3D work runs: 0 while paused or held. */
  const pace = playing && !scrubbing ? (fast ? FAST_SPEED : 1) : 0
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

  // The bar under the picture, like a video's: one stretch per scene, the knob where the film is.
  const barRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  /** The panel at the top of the picture: the labels beside the tools stay below it. */
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const update = () => {
      const top = String(panel.offsetHeight + 14)
      for (const host of [hostRef.current, benchHostRef.current]) if (host) host.dataset.tagTop = top
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(panel)
    return () => observer.disconnect()
  })
  /** Where the bar is held (0 → 1 of the whole film), or null when it is not. */
  const heldAt = useRef<number | null>(null)
  /** A jump inside the scene on screen, done on the next frame (one per frame while dragging). */
  const wantSeek = useRef<number | null>(null)
  /** A jump into another scene, done once that scene is set up. */
  const pendingSeek = useRef<number | null>(null)
  const where = useRef({ index: 0, count: 1, onBench: false })
  useEffect(() => {
    where.current = { index, count: Math.max(1, stages.length), onBench }
  })
  useEffect(() => {
    let frame = 0
    const step = () => {
      frame = requestAnimationFrame(step)
      const { index: at, count, onBench: bench } = where.current
      if (wantSeek.current !== null) {
        const fraction = wantSeek.current
        wantSeek.current = null
        if (bench) benchRef.current?.seek(fraction)
        else studioRef.current?.seekFilm(fraction)
      }
      const inScene = bench ? (benchRef.current?.progress() ?? 0) : (studioRef.current?.filmProgress() ?? 0)
      const value = heldAt.current ?? (at + inScene) / count
      const percent = `${Math.min(100, Math.max(0, value * 100))}%`
      if (fillRef.current) fillRef.current.style.width = percent
      if (knobRef.current) knobRef.current.style.left = percent
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
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

  useEffect(() => {
    benchRef.current?.setAllSlow(allSlow)
    studioRef.current?.setFilmAllSlow(allSlow)
  }, [allSlow, benchKey, ready])

  // Beside the tool or the piece: what is done, its time and its price.
  const allSteps = film?.steps ?? []
  // This scene's part of the job, the same as in the list under the picture; the whole cabinet's
  // only when the scene's list does not have that job.
  // One board at a time on the bench: `part` is that board's share, so the label is for what is
  // on the bench now.
  const describe = (op: BenchOp, part: number, piece: { index: number; count: number } | null) => {
    const job = BENCH_OPS[op]
    const here = (stage?.steps ?? []).filter((step) => job.steps(step.id))
    const steps = here.length > 0 ? here : allSteps.filter((step) => job.steps(step.id))
    const scaled = part < 1 ? steps.map((step) => ({ ...step, minutes: step.minutes * part })) : steps
    // Just this piece: „Линии за фиксиран рафт — 2 линии, 1 от 2 · 1 мин · 0,33 €“.
    const title = piece && piece.count > 1 && job.unit ? `${job.title} — ${job.unit}, ${piece.index + 1} от ${piece.count}` : job.title
    return tagText(title, scaled, priceOf, job.otherwise)
  }
  // Several pieces in one scene (fixed shelves one by one, the short dividers): each its share.
  const stageTag =
    stage && !stage.bench
      ? (piece: { index: number; count: number } | null) =>
          piece
            ? tagText(
                `${stage.title} — ${piece.index + 1} от ${piece.count}`,
                stage.steps.map((step) => ({ ...step, minutes: step.minutes / piece.count })),
                priceOf,
                'без отделно време',
              )
            : tagText(stage.title, stage.steps, priceOf, 'без отделно време')
      : null
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
      if (pendingSeek.current !== null) benchRef.current?.seek(pendingSeek.current)
      pendingSeek.current = null
      return
    }
    const studio = studioRef.current
    if (!studio || !stage.build) return
    // Framed on everything the film shows, the drawers made in front of the cabinet too.
    const framing = [...new Set(stages.flatMap((item) => [...(item.build?.standing ?? []), ...(item.build?.motion.batches.flatMap((batch) => batch.solids) ?? [])]))]
    studio.setAssembly(stage.build.standing, stage.build.motion, framing, sheets, () => setSceneDone(key))
    if (pendingSeek.current !== null) studio.seekFilm(pendingSeek.current)
    pendingSeek.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey, ready, sheets])

  // Playing: on to the next scene a moment after this one's work is done.
  useEffect(() => {
    if (!playing || scrubbing || sceneDone !== sceneKey) return
    const wait = (still ? SCENE_MS : AFTER_MS) / (fast ? FAST_SPEED : 1)
    if (index >= last) {
      const stop = window.setTimeout(() => setPlaying(false), wait)
      return () => window.clearTimeout(stop)
    }
    const timer = window.setTimeout(() => setAt(index + 1), wait)
    return () => window.clearTimeout(timer)
  }, [playing, scrubbing, index, last, still, sceneDone, sceneKey, fast])

  if (failed) {
    return <p className="py-8 text-center text-sm text-neutral-600">Браузърът не пуска 3D картината.</p>
  }

  const go = (next: number) => {
    setAt(Math.max(0, Math.min(last, next)))
  }
  /** Held or dragged on the bar: to that scene, and to that point in it. */
  const scrubTo = (clientX: number) => {
    const bar = barRef.current
    if (!bar || stages.length === 0) return
    const box = bar.getBoundingClientRect()
    const value = Math.min(0.99999, Math.max(0, (clientX - box.left) / Math.max(1, box.width)))
    heldAt.current = value
    const scaled = value * stages.length
    const scene = Math.floor(scaled)
    const fraction = scaled - scene
    setSceneDone('')
    if (scene !== index) {
      pendingSeek.current = fraction
      wantSeek.current = null
      setAt(scene)
    } else {
      wantSeek.current = fraction
    }
  }
  const button = 'flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 disabled:opacity-40'
  return (
    <div className="w-full">
      <div className="relative h-[440px] w-full">
        <div ref={hostRef} className={`absolute inset-0 ${onBench ? 'invisible' : ''}`} />
        <div ref={benchHostRef} className={`absolute inset-0 ${onBench ? '' : 'invisible'}`} />
        {stage && (
          // On the picture itself, always in view: what the whole assembly takes and costs, how far
          // it has got, the buttons and the bar to move through it like a video.
          <div ref={panelRef} className="absolute inset-x-2 top-2 rounded-md bg-white/90 px-2.5 py-1.5 text-neutral-900 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="leading-tight">
                <p className="text-sm font-semibold">
                  Целият шкаф: {formatMinutes(totalMinutes)}
                  {priceOf(totalMinutes) ? ` · ${priceOf(totalMinutes)}` : ''}
                </p>
                <p className="text-xs">
                  Досега: {formatMinutes(doneMinutes)}
                  {priceOf(doneMinutes) ? ` · ${priceOf(doneMinutes)}` : ''}
                  {hourly > 0 ? '' : ' · без ставка'}
                </p>
              </div>
                <div className="flex flex-wrap items-center gap-1">
                  <button type="button" className={button} disabled={index === 0} onClick={() => go(index - 1)} aria-label="Назад">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={button}
                    aria-label={playing ? 'Пауза' : 'Пусни'}
                    onClick={() => {
                      if (!playing && index >= last) setAt(0)
                      setPlaying((on) => !on)
                    }}
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    <span className="hidden sm:inline">{playing ? 'Пауза' : 'Пусни'}</span>
                  </button>
                  <button type="button" className={button} disabled={index >= last} onClick={() => go(index + 1)} aria-label="Напред">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={`${button} ${fast ? 'border-neutral-900 bg-neutral-900 text-white' : ''}`}
                    aria-pressed={fast}
                    aria-label="По-бързо"
                    onClick={() => setFast((on) => !on)}
                  >
                    <FastForward className="h-4 w-4" />
                    <span className="hidden sm:inline">По-бързо</span>
                  </button>
                  <button
                    type="button"
                    className={`${button} ${allSlow ? 'border-neutral-900 bg-neutral-900 text-white' : ''}`}
                    aria-pressed={allSlow}
                    aria-label="Всичко бавно"
                    title="Всяко повторение толкова бавно, колкото първите — без забързване"
                    onClick={() => setAllSlow((on) => !on)}
                  >
                    <Turtle className="h-4 w-4" />
                    <span className="hidden sm:inline">Всичко бавно</span>
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
            <div
              ref={barRef}
              className="relative mt-1 h-5 cursor-pointer touch-none select-none"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                setScrubbing(true)
                scrubTo(event.clientX)
              }}
              onPointerMove={(event) => {
                if (heldAt.current !== null) scrubTo(event.clientX)
              }}
              onPointerUp={() => {
                heldAt.current = null
                setScrubbing(false)
              }}
              onPointerCancel={() => {
                heldAt.current = null
                setScrubbing(false)
              }}
            >
              <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-neutral-300">
                <div ref={fillRef} className="h-full bg-neutral-900" style={{ width: '0%' }} />
              </div>
              <div className="absolute inset-0 flex">
                {stages.map((item, i) => (
                  <div key={item.key} title={`${i + 1}. ${item.title}`} className="relative h-full flex-1">
                    {i > 0 && <span className="absolute left-0 top-1/2 h-3 w-0.5 -translate-y-1/2 bg-white" />}
                  </div>
                ))}
              </div>
              <div
                ref={knobRef}
                className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-neutral-900 shadow"
                style={{ left: '0%' }}
              />
            </div>
          </div>
        )}
      </div>
      {stage && (
        <div className="mt-2 rounded-md border border-neutral-200 bg-white p-3 text-neutral-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Стъпка {index + 1} от {stages.length}: {stage.title}
            </p>
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
