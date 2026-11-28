import type { AssemblyStep } from '@/lib/assembly-time'
import type { SceneSolid } from '@/lib/cabinets/scene-solids'
import {
  benchJobs,
  benchLayout,
  isFixedShelf,
  jobCounts,
  mainBoxes,
  splitDividers,
  type BenchGroup,
} from '@/lib/bench-plan'
import type { FilmBatch, FilmMotion, FilmNail } from '@/lib/view3d/studio'

/** One scene of the assembly film: what is done in it, how long it takes, what is shown. */
export interface AssemblyStage {
  key: string
  title: string
  steps: AssemblyStep[]
  minutes: number
  /** A line under the title: what exactly is done (counts, tools). */
  note?: string
  /** Done on the loose boards on the bench: group `group` of `benchGroups`, job `job` of `benchJobs`. */
  bench?: { group: number; job: number }
  /** Done on the cabinet: what already stands, and what happens. */
  build?: { standing: SceneSolid[]; motion: FilmMotion }
}

type Box = Extract<SceneSolid, { kind: 'box' }>
type Rail = Extract<SceneSolid, { kind: 'rail' }>

const isBox = (solid: SceneSolid): solid is Box => solid.kind === 'box'
const pieceOf = (solid: SceneSolid) => (solid.kind === 'box' ? (solid.piece ?? '') : '')
const starts = (value: string, ...heads: string[]) => heads.some((head) => value.startsWith(head))

/** The cabinet lying the way it is worked on: upside down (bottom and plinths), on its front (backs). */
const UPRIGHT = 0
const UPSIDE_DOWN = Math.PI
const FACE_DOWN = Math.PI / 2

const HARDBOARD_MM = 3
/** Nails along a back or a drawer bottom: this far apart, this far in from the board's edge. */
const BACK_NAIL_STEP = 150
const DRAWER_NAIL_STEP = 110

/** Nails along a line, `step` apart, starting a little in from both ends. */
function nailLine(a: [number, number, number], b: [number, number, number], step: number, dir: FilmNail['dir']): FilmNail[] {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  if (length < 1) return []
  const inset = Math.min(40, length / 2)
  const count = Math.max(1, Math.round((length - inset * 2) / step) + 1)
  const out: FilmNail[] = []
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : (inset + ((length - inset * 2) * i) / (count - 1)) / length
    out.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t, dir })
  }
  return out
}

function uniqueNails(nails: FilmNail[]): FilmNail[] {
  const kept: FilmNail[] = []
  for (const nail of nails) {
    if (kept.some((item) => Math.hypot(item.x - nail.x, item.y - nail.y, item.z - nail.z) < 30)) continue
    kept.push(nail)
  }
  return kept
}

/** A copy of a box moved by (dx, dy, dz), with its drawer id marked so it does not mix with the real one. */
function moved(solid: Box, dx: number, dy: number, dz: number, tag: string): Box {
  return {
    ...solid,
    x: solid.x + dx,
    y: solid.y + dy,
    z: solid.z + dz,
    ...(solid.slide ? { slide: { ...solid.slide, id: `${solid.slide.id}${tag}` } } : {}),
  }
}

/** Splits the minutes of a step evenly over the scenes that share it. */
/** This stage's part of the steps: `part` of the whole (by how much of the work it shows). */
function share(steps: AssemblyStep[], part: number): AssemblyStep[] {
  if (part >= 1) return steps
  return steps.map((step) => ({ ...step, minutes: Math.round(step.minutes * part * 100) / 100 }))
}

/**
 * The cabinet put together the way the workshop does it. On the bench: the two outer sides side by
 * side (bottom, fixed shelves, clothes rail, shelf pins), the middle divider (slides, shelves), the
 * short dividers (slides), the bottom and the top (where the dividers stand). Then the plinths on
 * the bottom lying upside down, the bottom turned over, one side, the other, the top, the middle
 * divider with the rails, the short dividers, the fixed shelves one by one; the cabinet laid on its
 * front for the backs, nailed; and the drawers made in front of it and put in their places.
 */
export function assemblyStages(solids: SceneSolid[], steps: AssemblyStep[], groups: BenchGroup[]): AssemblyStage[] {
  const shown = solids.filter((solid) => solid.kind !== 'dim')
  const boxes = shown.filter(isBox)
  const pool = [...steps]
  const claim = (test: (step: AssemblyStep) => boolean) => {
    const taken: AssemblyStep[] = []
    for (let i = pool.length - 1; i >= 0; i -= 1) {
      if (test(pool[i])) taken.unshift(...pool.splice(i, 1))
    }
    return taken
  }
  const claimIds = (...heads: string[]) => claim((step) => starts(step.id, ...heads))

  const stages: AssemblyStage[] = []
  let standing: SceneSolid[] = []
  const used = new Set<SceneSolid>()
  const build = (
    key: string,
    title: string,
    taken: AssemblyStep[],
    batches: FilmBatch[],
    extra: Partial<FilmMotion> & { note?: string } = {},
  ) => {
    const { note, ...motion } = extra
    stages.push({
      key,
      title,
      steps: taken,
      minutes: 0,
      ...(note ? { note } : {}),
      build: { standing: [...standing], motion: { batches, ...motion } },
    })
    for (const batch of batches) {
      for (const solid of batch.solids) {
        standing.push(solid)
        used.add(solid)
      }
    }
  }
  /** Every box drawn for this piece name (a side can be drawn as several boxes). */
  const allOf = (name: string) => boxes.filter((box) => pieceOf(box) === name)

  // 0. Before anything: the edge band trimmed and sanded on every piece.
  const edges = claimIds('edge:')
  if (edges.length > 0) {
    stages.push({ key: 'edges', title: 'Подготовка: обработка на канта', steps: edges, minutes: 0, build: { standing: [], motion: { batches: [] } } })
  }

  // 1. The bench, group by group.
  const benchStages: { stage: AssemblyStage; group: BenchGroup; phase: string; face: number; counts: ReturnType<typeof jobCounts> }[] = []
  groups.forEach((group, groupIndex) => {
    benchJobs(group).forEach((job, jobIndex) => {
      const counts = jobCounts(group, job.face)
      const other = job.face > 0
      let title: string
      let note: string
      if (job.phase === 'mark') {
        const what: string[] = []
        if (counts.lines > 0) what.push(`${counts.lines} ${counts.lines === 1 ? 'линия' : 'линии'}`)
        if (counts.crosses > 0) what.push(`${counts.crosses} ${counts.crosses === 1 ? 'кръстче за лоста' : 'кръстчета за лоста'}`)
        if (counts.points > 0) what.push(`${counts.points} точки за рафтоносачи`)
        if (group.key === 'sides' && benchLayout(group) === 'one-by-one') {
          title = `${group.title} една по една: чертаене`
          note = `Двете не се събират на масата (90 см): чертаеш едната, вдигаш я и я облягаш на стената, после слагаш другата на масата. С молив: къде идва дъното, фиксираните рафтове и рафтовете, къде седи лостът. ${what.join(', ')}.`
        } else if (group.key === 'sides') {
          title = `${group.title} една до друга: чертаене`
          note = `Лежат една до друга на масата с вътрешната страна нагоре${benchLayout(group) === 'across' ? ', долният край към теб' : ''}, една линия минава и през двете. С молив: къде идва дъното, фиксираните рафтове и рафтовете, къде седи лостът. ${what.join(', ')}.`
        } else if (group.key === 'bottom' || group.key === 'top') {
          title = `${group.title}: къде стоят разделителните страници`
          note = `С молив двете линии на всяка разделителна страница, която стои ${group.key === 'bottom' ? 'на дъното' : 'под плота'}. ${what.join(', ')}.`
        } else {
          title = other ? `${group.title}: обръщаш и чертаеш другата страна` : `${group.title}: чертаене`
          note = `С молив: къде идват водачите, фиксираните рафтове и лостът. ${what.join(', ')}.`
        }
      } else if (job.phase === 'pins') {
        title = `${group.title}: рафтоносачи`
        note = `На всяка от ${counts.points} точки: център с шило и чук, дупка с бормашина и свредло 4,5 мм, после рафтоносачът се набива с чук.`
      } else {
        title = `${group.title}: водачи${other ? ' от другата страна' : ''}`
        note = `${counts.slides} ${counts.slides === 1 ? 'водач' : 'водача'} по начертаните линии. На всеки по 3 винта: в първата дупка, в последната и в средата.`
      }
      const stage: AssemblyStage = { key: `bench-${groupIndex}-${jobIndex}`, title, steps: [], minutes: 0, note, bench: { group: groupIndex, job: jobIndex } }
      stages.push(stage)
      benchStages.push({ stage, group, phase: job.phase, face: job.face, counts })
    })
  })
  // The bench steps go to the scenes that show them.
  type BenchItem = (typeof benchStages)[number]
  /** Split between the scenes that show the work, by how much of it each shows (`weight`), else evenly. */
  const giveTo = (taken: AssemblyStep[], targets: BenchItem[], weight?: (item: BenchItem) => number) => {
    if (taken.length === 0) return
    if (targets.length === 0) {
      pool.push(...taken)
      return
    }
    const weights = targets.map((item) => (weight ? Math.max(0, weight(item)) : 1))
    const total = weights.reduce((sum, value) => sum + value, 0)
    targets.forEach((item, i) => item.stage.steps.push(...share(taken, total > 0 ? weights[i] / total : 1 / targets.length)))
  }
  const benchWhere = (test: (item: BenchItem) => boolean) => benchStages.filter(test)
  // Each bench scene gets the time of what it shows: its own lines, crosses and pin points.
  const marking = (item: BenchItem) => item.phase === 'mark'
  giveTo(claimIds('mark-bottom'), benchWhere((item) => marking(item) && item.counts.linesOf('bottom') > 0), (item) => item.counts.linesOf('bottom'))
  giveTo(claimIds('mark-fixed-shelf'), benchWhere((item) => marking(item) && item.counts.linesOf('fixed') > 0), (item) => item.counts.linesOf('fixed'))
  giveTo(claimIds('mark-sides-swap'), benchWhere((item) => item.group.key === 'sides' && marking(item)))
  giveTo(claimIds('mark-clothes-rail'), benchWhere((item) => marking(item) && item.counts.crosses > 0), (item) => item.counts.crosses)
  giveTo(claimIds('mark-shelf'), benchWhere((item) => marking(item) && item.counts.points > 0), (item) => item.counts.points)
  // Measuring the fronts and trying a slide are done once, on the first boards with slides; the
  // lines are drawn on every board, so they are shared by how many each has.
  const slideMarks = benchWhere((item) => item.phase === 'mark' && item.counts.slides > 0)
  giveTo(claimIds('mark-drawer-fronts', 'mark-drawer-try'), slideMarks.slice(0, 1))
  giveTo(claimIds('mark-drawer-guides', 'mark-drawer'), slideMarks, (item) => item.counts.slides)
  giveTo(claimIds('mark-partition-bottom'), benchWhere((item) => item.group.key === 'bottom'))
  giveTo(claimIds('mark-partition-top'), benchWhere((item) => item.group.key === 'top'))
  giveTo(claimIds('shelf-pins'), benchWhere((item) => item.phase === 'pins'), (item) => item.counts.points)
  giveTo(claimIds('drawer-guides'), benchWhere((item) => item.phase === 'slides'), (item) => item.counts.slides)

  // 2. The carcass, piece by piece.
  const sides = mainBoxes(shown, (name) => name === 'side-left' || name === 'side-right')
  const { full, short } = splitDividers(shown)
  const uprights = [...sides, ...full, ...short]
  // The cabinet half of each slide goes in with the board it was screwed to on the bench.
  const slideOwner = new Map<Box, Box[]>()
  for (const slide of boxes.filter((box) => box.assembly === 'slide')) {
    const owner = uprights.find((board) => {
      const sameHeight = slide.y < board.y + board.h && slide.y + slide.h > board.y
      return sameHeight && (Math.abs(slide.x - (board.x + board.w)) <= 4 || Math.abs(slide.x + slide.w - board.x) <= 4)
    })
    if (!owner) continue
    slideOwner.set(owner, [...(slideOwner.get(owner) ?? []), slide])
  }
  const withSlides = (board: Box) => [...allOf(pieceOf(board)), ...(slideOwner.get(board) ?? [])]
  const floorY = boxes.reduce((most, box) => Math.max(most, box.y + box.h), 0)

  const bottom = allOf('bottom')
  const plinths = mainBoxes(shown, (name) => name.startsWith('plinth'))
    .flatMap((main) => [allOf(pieceOf(main))])
    .sort((a, b) => a[0].z - b[0].z)
  // Plinth pieces can share one name: then each box is its own plinth.
  const plinthList = plinths.length === 1 && plinths[0].length > 1 ? plinths[0].map((box) => [box]).sort((a, b) => a[0].z - b[0].z) : plinths
  const plinthSteps = claimIds('plinth')
  const sideSteps = claimIds('sides-bottom')
  if (bottom.length > 0 && plinthList.length > 0) {
    build('bottom-down', 'Дъното с лицето надолу на масата', [], [{ solids: bottom }], { pose: UPSIDE_DOWN })
    plinthList.forEach((plinth, index) => {
      const title =
        plinthList.length === 2 ? (index === 0 ? 'Предният цокъл към дъното' : 'Задният цокъл към дъното') : `Цокъл ${index + 1} към дъното`
      build(`plinth-${index}`, title, share(plinthSteps, 1 / plinthList.length), [{ solids: plinth }], {
        pose: UPSIDE_DOWN,
        note: 'Цокълът е с канта надолу, винтовете 5×60 минават през дъното.',
      })
    })
    build('bottom-turn', 'Обръщаш дъното с цоклите', [], [], { fromPose: UPSIDE_DOWN, pose: UPRIGHT })
  } else if (bottom.length > 0) {
    build('bottom', 'Дъното', [], [{ solids: bottom }])
    pool.push(...plinthSteps)
  } else {
    pool.push(...plinthSteps)
  }

  sides.forEach((side, index) => {
    const left = pieceOf(side) === 'side-left'
    const title = sides.length === 2 ? (index === 0 ? 'Едната страница' : 'Другата страница') : 'Страницата'
    build(`side-${index}`, title, share(sideSteps, 1 / sides.length), [{ solids: withSlides(side), from: [left ? -600 : 600, 0, 0] }], {
      note: 'Хваща се към дъното с 2 винта 5×60 през страницата.',
    })
  })
  if (sides.length === 0) pool.push(...sideSteps)

  const tops = boxes.filter((box) => /^(top|rail-|fascia)/.test(pieceOf(box)) && !used.has(box))
  if (tops.length > 0) {
    build('top', tops.some((box) => pieceOf(box) === 'top') ? 'Плотът' : 'Бленди', claimIds('top-rails', 'front-fascia', 'top'), [{ solids: tops }], {
      note: 'Влиза между страниците и се хваща с винтове 5×60 през тях.',
    })
  }

  const rails = shown.filter((solid): solid is Rail => solid.kind === 'rail')
  const railTouches = (rail: Rail, board: Box) =>
    Math.abs(rail.x - (board.x + board.w)) <= 30 || Math.abs(rail.x + rail.w - board.x) <= 30
  const partitionSteps = claimIds('partition')
  const railSteps = claimIds('clothes-rail')
  const dividerScenes = full.length + (short.length > 0 ? 1 : 0)
  let railsPlaced = false
  full.forEach((divider, index) => {
    const mine = rails.filter((rail) => !used.has(rail) && railTouches(rail, divider))
    const batches: FilmBatch[] = [{ solids: withSlides(divider), from: [0, 0, -900] }]
    for (const rail of mine) batches.push({ solids: [rail], from: [0, 0, -700] })
    const title =
      (full.length > 1 ? `Разделителна страница ${index + 1}` : 'Средната разделителна страница') + (mine.length > 0 ? ' и лостовете' : '')
    const taken = [...share(partitionSteps, 1 / dividerScenes), ...(mine.length > 0 && !railsPlaced ? railSteps : [])]
    if (mine.length > 0) railsPlaced = true
    build(`divider-${index}`, title, taken, batches, {
      note: mine.length > 0 ? 'Страницата сяда на дъното и под плота; лостовете влизат между нея и страниците.' : 'Сяда на дъното и под плота, винтове 5×60.',
    })
  })
  if (short.length > 0) {
    build(
      'short-dividers',
      short.length > 1 ? 'Малките разделителни страници' : 'Малката разделителна страница',
      share(partitionSteps, 1 / dividerScenes),
      short.map((divider) => ({ solids: withSlides(divider), from: [0, 0, -900] as [number, number, number] })),
      { note: 'Сядат на дъното, с водачите вече на тях.' },
    )
  }
  if (dividerScenes === 0) pool.push(...partitionSteps)

  const fixed = boxes.filter((box) => isFixedShelf(pieceOf(box))).sort((a, b) => a.y - b.y || a.x - b.x)
  if (fixed.length > 0) {
    build('fixed-shelves', fixed.length > 1 ? 'Фиксираните рафтове, един по един' : 'Фиксираният рафт', claimIds('fixed-shelf'), fixed.map((shelf) => ({ solids: [shelf], from: [0, 0, -800] as [number, number, number] })), {
      note: 'Всеки рафт по линията си, по 2 винта 5×60 през всяка страница.',
    })
  }
  const loose = rails.filter((rail) => !used.has(rail))
  if (loose.length > 0) {
    build('rail', 'Лост за дрехи', railsPlaced ? [] : railSteps, loose.map((rail) => ({ solids: [rail], from: [0, 0, -700] as [number, number, number] })))
  } else if (!railsPlaced) pool.push(...railSteps)

  const movable = boxes.filter((box) => pieceOf(box).startsWith('shelf') && !used.has(box))
  if (movable.length > 0) {
    build('shelves', 'Рафтовете на рафтоносачите', [], movable.map((shelf) => ({ solids: [shelf], from: [0, 0, -800] as [number, number, number] })))
  }

  const feet = boxes.filter((box) => !used.has(box) && (box.assembly === 'feet' || starts(pieceOf(box), 'leg', 'plinth')))
  if (feet.length > 0) build('feet', 'Крачета и цокъл', claimIds('legs', 'plinth'), [{ solids: feet }])

  // What else belongs to the carcass and was not named above goes in now, in one go.
  const isFront = (solid: SceneSolid) =>
    solid.kind === 'door' ||
    solid.kind === 'lift' ||
    solid.kind === 'glow' ||
    (solid.kind === 'box' && (!!solid.slide || solid.mirrorGlass === true || solid.assembly === 'mirror' || starts(pieceOf(solid), 'drawer', 'box-', 'mirror', 'back')))
  const rest = shown.filter((solid) => !used.has(solid) && !isFront(solid))
  if (rest.length > 0) build('carcass-rest', 'Останалото от корпуса', [], [{ solids: rest }])

  // 3. The backs: the cabinet laid on its front, each back nailed on.
  const backBoxes = boxes.filter((box) => pieceOf(box).startsWith('back'))
  const backSteps = claimIds('back')
  if (backBoxes.length > 0) {
    const nailed = backSteps.some((step) => step.id.startsWith('back-nails'))
    for (const box of backBoxes) used.add(box)
    if (!nailed) {
      build('back', 'Гръб', backSteps, [{ solids: backBoxes }])
    } else {
      const sideBoxes = sides.length > 0 ? sides : backBoxes
      const x0 = Math.min(...sideBoxes.map((box) => box.x))
      const x1 = Math.max(...sideBoxes.map((box) => box.x + box.w))
      const y0 = Math.min(...sideBoxes.map((box) => box.y))
      const y1 = bottom.length > 0 ? Math.max(...bottom.map((box) => box.y + box.h)) : Math.max(...backBoxes.map((box) => box.y + box.h))
      const z = Math.max(...backBoxes.map((box) => box.z + box.d))
      const color = backBoxes[0].color
      // Wider than a metre: two backs, split on the divider nearest the middle.
      const cuts = [x0, x1]
      if (x1 - x0 > 1000 && full.length > 0) {
        const middle = (x0 + x1) / 2
        const nearest = [...full].sort((a, b) => Math.abs(a.x + a.w / 2 - middle) - Math.abs(b.x + b.w / 2 - middle))[0]
        cuts.splice(1, 0, nearest.x + nearest.w / 2)
      }
      const pieces = cuts.slice(0, -1).map((a, index) => [a, cuts[index + 1]] as const)
      build('lay-down', 'Обръщаш шкафа с лицето надолу', [], [], { fromPose: UPRIGHT, pose: FACE_DOWN })
      const face = z + HARDBOARD_MM
      const reachesBack = (box: Box) => box.z + box.d >= z - 5
      pieces.forEach(([a, b], index) => {
        const sheet: Box = { kind: 'box', x: a, y: y0, z, w: b - a, h: y1 - y0, d: HARDBOARD_MM, color, piece: `back-film-${index}` }
        const lines: [[number, number, number], [number, number, number]][] = [
          [[a + 9, y0, face], [a + 9, y1, face]],
          [[b - 9, y0, face], [b - 9, y1, face]],
          [[a, y0 + 9, face], [b, y0 + 9, face]],
          [[a, y1 - 9, face], [b, y1 - 9, face]],
        ]
        for (const shelf of fixed.filter(reachesBack)) {
          const from = Math.max(a, shelf.x)
          const to = Math.min(b, shelf.x + shelf.w)
          if (to - from > 60) lines.push([[from, shelf.y + shelf.h / 2, face], [to, shelf.y + shelf.h / 2, face]])
        }
        for (const divider of [...full, ...short].filter(reachesBack)) {
          const middle = divider.x + divider.w / 2
          if (middle <= a + 20 || middle >= b - 20) continue
          lines.push([[middle, divider.y, face], [middle, divider.y + divider.h, face]])
        }
        const nails = uniqueNails(lines.flatMap(([p, q]) => nailLine(p, q, BACK_NAIL_STEP, 'back')))
        build(
          `back-${index}`,
          pieces.length > 1 ? `Гръб ${index + 1} от ${pieces.length}: фазер с пирони` : 'Гърбът: фазер с пирони',
          share(backSteps, 1 / pieces.length),
          [{ solids: [sheet] }],
          { pose: FACE_DOWN, nails, note: `${nails.length} пирона по ръба, по рафтовете и по разделителните страници.` },
        )
      })
      build('stand-up', 'Изправяш шкафа', [], [], { fromPose: FACE_DOWN, pose: UPRIGHT })
    }
  } else {
    pool.push(...backSteps)
  }

  // 4. The drawers: made in front of the cabinet, then put in their places.
  const drawerParts = new Map<string, Box[]>()
  for (const box of boxes) {
    if (!box.slide || used.has(box)) continue
    drawerParts.set(box.slide.id, [...(drawerParts.get(box.slide.id) ?? []), box])
  }
  const drawers = [...drawerParts.entries()]
    .map(([id, parts]) => {
      const front = parts.find((part) => starts(pieceOf(part), 'drawer-front')) ?? parts.find((part) => !!part.pull)
      const body = parts.filter((part) => part !== front)
      return { id, front, body }
    })
    .filter((item) => item.body.length > 0)
    .sort((a, b) => b.body[0].y - a.body[0].y || a.body[0].x - b.body[0].x)
  if (drawers.length > 0) {
    const runnerColor = '#f3f2ee'
    const centerX = sides.length > 0 ? (Math.min(...sides.map((s) => s.x)) + Math.max(...sides.map((s) => s.x + s.w))) / 2 : 0
    const perRow = 3
    const made = drawers.map((drawer, index) => {
      const body = drawer.body
      const bx0 = Math.min(...body.map((box) => box.x))
      const bx1 = Math.max(...body.map((box) => box.x + box.w))
      const top = Math.min(...body.map((box) => box.y))
      const under = Math.max(...body.map((box) => box.y + box.h))
      const bz0 = Math.min(...body.map((box) => box.z))
      const bz1 = Math.max(...body.map((box) => box.z + box.d))
      const color = backBoxes[0]?.color ?? '#b9a27f'
      const slideId = body[0].slide!
      const bottomSheet: Box = { kind: 'box', x: bx0, y: under, z: bz0, w: bx1 - bx0, h: HARDBOARD_MM, d: bz1 - bz0, color, slide: slideId }
      // The drawer half of each slide, on the lower edge of each side.
      const sidesOfBox = body.filter((box) => box.w < box.d)
      const runners: Box[] = sidesOfBox.map((side) => {
        const outward = side.x + side.w / 2 < (bx0 + bx1) / 2 ? -1 : 1
        return {
          kind: 'box',
          x: outward < 0 ? side.x - 12 : side.x + side.w,
          y: under - 16,
          z: side.z,
          w: 12,
          h: 16 + HARDBOARD_MM,
          d: side.d,
          color: runnerColor,
          slide: slideId,
        }
      })
      // Where it is made: rows of three on the floor in front of the cabinet.
      const row = Math.floor(index / perRow)
      const col = index % perRow
      const across = Math.min(perRow, drawers.length - row * perRow)
      const pitch = (bx1 - bx0) + 90
      const spotX = centerX + (col - (across - 1) / 2) * pitch - (bx0 + bx1) / 2
      const spotZ = -260 - row * ((bz1 - bz0) + 260) - bz1
      const tag = '@made'
      // Upside down while the bottom goes on: the box stands on its top edges, the bottom on top.
      const downDy = floorY - under
      const downBody = body.map((box) => moved(box, spotX, downDy, spotZ, tag))
      const downSheet: Box = { ...moved(bottomSheet, spotX, 0, spotZ, tag), y: top + downDy - HARDBOARD_MM }
      // The right way up: on its bottom, slides on, front on.
      const upDy = floorY - under - HARDBOARD_MM
      const upBody = [...body, bottomSheet].map((box) => moved(box, spotX, upDy, spotZ, tag))
      const upRunners = runners.map((box) => moved(box, spotX, upDy, spotZ, tag))
      const upFront = drawer.front ? moved(drawer.front, spotX, upDy, spotZ, tag) : null
      const nailY = top + downDy - HARDBOARD_MM
      const sx0 = bx0 + spotX
      const sx1 = bx1 + spotX
      const sz0 = bz0 + spotZ
      const sz1 = bz1 + spotZ
      const nails = uniqueNails(
        [
          [[sx0 + 9, nailY, sz0], [sx0 + 9, nailY, sz1]],
          [[sx1 - 9, nailY, sz0], [sx1 - 9, nailY, sz1]],
          [[sx0, nailY, sz0 + 9], [sx1, nailY, sz0 + 9]],
          [[sx0, nailY, sz1 - 9], [sx1, nailY, sz1 - 9]],
        ].flatMap(([p, q]) => nailLine(p as [number, number, number], q as [number, number, number], DRAWER_NAIL_STEP, 'up')),
      )
      const final = [...body, bottomSheet, ...runners, ...(drawer.front ? [drawer.front] : [])]
      return { downBody, downSheet, upBody, upRunners, upFront, nails, final, move: [spotX, upDy, spotZ] as [number, number, number], body, sidesOfBox }
    })
    const count = drawers.length
    const word = count === 1 ? 'чекмеджето' : 'чекмеджетата'
    // Box: the two long sides, then the front and back pieces, one drawer after another.
    build(
      'drawer-box',
      `Кутиите на ${word}`,
      claimIds('drawer-box'),
      made.flatMap((item) => {
        const sidesFirst = [...item.downBody].sort((a, b) => Number(b.w < b.d) - Number(a.w < a.d))
        return sidesFirst.map((box) => ({ solids: [box], unit: made.indexOf(item) }))
      }),
      { note: 'Страниците и царгите с винтове 5×60. Кутията се сглобява обърната, с горния ръб на масата.' },
    )
    // The hardboard bottom on the upturned box, stapled all round.
    build('drawer-bottom', `Дъно от фазер на ${word} с такер`, claimIds('drawer-back', 'drawer-bottom'), made.map((item, unit) => ({ solids: [item.downSheet], unit })), {
      nails: made.flatMap((item, unit) => item.nails.map((nail) => ({ ...nail, unit }))),
      tool: 'stapler',
      note: 'Фазерът се кове с такер по страниците и по царгите.',
    })
    // Turned the right way up; then the drawer half of each slide.
    standing = standing.filter((solid) => !made.some((item) => item.downBody.includes(solid as Box) || item.downSheet === solid))
    build(
      'drawer-runners',
      `Обръщаш ${word} и слагаш водачите`,
      claimIds('drawer-runners'),
      made.flatMap((item, unit) => [
        { solids: item.upBody, mode: 'flip' as const, unit },
        ...item.upRunners.map((runner) => ({
          unit,
          solids: [runner],
          from: [runner.x + runner.w / 2 < (Math.min(...item.upBody.map((b) => b.x)) + Math.max(...item.upBody.map((b) => b.x + b.w))) / 2 ? -150 : 150, 0, 0] as [number, number, number],
        })),
      ]),
      { note: 'На всеки водач по 3 винтчета 3,5×20 по долния ръб на страницата.' },
    )
    const fronts = made.filter((item) => item.upFront)
    if (fronts.length > 0) {
      build('drawer-fronts', 'Челата', claimIds('drawer-front', 'front-edge-take-drawer'), fronts.map((item) => ({ solids: [item.upFront!], from: [0, 0, -300] as [number, number, number] })), {
        note: 'Челото с дръжката се хваща към кутията отвътре.',
      })
    }
    standing = standing.filter((solid) => !made.some((item) => item.upBody.includes(solid as Box) || item.upRunners.includes(solid as Box) || item.upFront === solid))
    build(
      'drawer-in',
      `${count === 1 ? 'Чекмеджето' : 'Чекмеджетата'} по местата`,
      claimIds('soft-close'),
      made.map((item) => ({ solids: item.final, from: item.move, via: 'front' as const })),
      { note: 'Всяко чекмедже се вдига пред мястото си и се плъзга по водачите.' },
    )
  }

  // 5. The rest in the old order: doors, a bed's lift, a mirror.
  const doors = shown.filter((solid) => solid.kind === 'door' && !used.has(solid))
  if (doors.length > 0) build('doors', 'Врати', claimIds('door', 'tall-door', 'front-edge-take', 'sliding'), [{ solids: doors, from: [0, 0, -500] }])
  const lift = shown.filter((solid) => solid.kind === 'lift' && !used.has(solid))
  if (lift.length > 0) build('lift', 'Подматрачна рамка и механизъм', claim((step) => /lift|рамка|механиз/i.test(step.id + step.label)), [{ solids: lift }])
  const mirror = shown.filter((solid) => !used.has(solid) && (solid.kind === 'glow' || (solid.kind === 'box' && (solid.mirrorGlass === true || solid.assembly === 'mirror' || starts(pieceOf(solid), 'mirror')))))
  if (mirror.length > 0) build('mirror', 'Огледало', claimIds('mirror'), [{ solids: mirror }])
  const left = shown.filter((solid) => !used.has(solid))
  if (left.length > 0 || pool.length > 0) build('finish', 'Довършване', claim(() => true), left.length > 0 ? [{ solids: left }] : [])

  return stages.map((stage) => ({ ...stage, minutes: Math.round(stage.steps.reduce((sum, step) => sum + step.minutes, 0) * 10) / 10 }))
}
