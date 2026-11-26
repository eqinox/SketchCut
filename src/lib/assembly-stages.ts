import type { AssemblyStep } from '@/lib/assembly-time'
import type { SceneSolid } from '@/lib/cabinets/scene-solids'

/** One scene of the assembly film: what is done in it, how long it takes, which pieces arrive. */
export interface AssemblyStage {
  key: string
  title: string
  steps: AssemblyStep[]
  minutes: number
  solids: SceneSolid[]
}

type Rule = {
  key: string
  title: string
  step: (id: string, step: AssemblyStep) => boolean
  solid: (solid: SceneSolid) => boolean
}

const pieceOf = (solid: SceneSolid) => (solid.kind === 'box' ? (solid.piece ?? '') : '')
const starts = (value: string, ...heads: string[]) => heads.some((head) => value.startsWith(head))

/**
 * In the order a carpenter puts a cabinet together: the carcass first, then the legs or plinth
 * on its bottom. A step or piece goes to the first rule that
 * takes it; whatever none takes goes to the carcass (pieces) or to a last „Довършване“ (steps).
 */
const RULES: Rule[] = [
  {
    // Before anything is put together: the edge band is trimmed and sanded on every piece.
    key: 'edges',
    title: 'Подготовка: обработка на канта',
    step: (id) => starts(id, 'edge:'),
    solid: () => false,
  },
  {
    key: 'carcass',
    title: 'Корпус: страници и дъно',
    step: (id) => starts(id, 'sides-bottom', 'wall-carcass', 'prepare-wall-sides', 'partition', 'mark-partition'),
    solid: (solid) => starts(pieceOf(solid), 'side', 'bottom', 'divider', 'fascia'),
  },
  {
    key: 'feet',
    title: 'Крачета и цокъл',
    step: (id) => starts(id, 'legs', 'plinth'),
    solid: (solid) => (solid.kind === 'box' && solid.assembly === 'feet') || starts(pieceOf(solid), 'leg', 'plinth'),
  },
  {
    key: 'top',
    title: 'Плот и бленди',
    step: (id) => starts(id, 'top-rails', 'front-fascia', 'top'),
    solid: (solid) => starts(pieceOf(solid), 'top', 'rail-'),
  },
  {
    key: 'shelves',
    title: 'Рафтове',
    step: (id) => starts(id, 'shelf-pins', 'fixed-shelf', 'mark-shelf-pins', 'mark-fixed-shelf'),
    solid: (solid) => starts(pieceOf(solid), 'shelf'),
  },
  {
    key: 'back',
    title: 'Гръб',
    step: (id) => starts(id, 'back'),
    solid: (solid) => starts(pieceOf(solid), 'back'),
  },
  {
    key: 'rail',
    title: 'Лост за дрехи',
    step: (id) => starts(id, 'clothes-rail', 'mark-clothes-rail'),
    solid: (solid) => solid.kind === 'rail',
  },
  {
    key: 'drawers',
    title: 'Чекмеджета',
    step: (id) => starts(id, 'drawer', 'mark-drawer', 'soft-close', 'front-edge-take-drawer'),
    solid: (solid) => (solid.kind === 'box' && !!solid.slide) || starts(pieceOf(solid), 'drawer', 'box-'),
  },
  {
    key: 'doors',
    title: 'Врати',
    step: (id) => starts(id, 'door', 'tall-door', 'front-edge-take', 'sliding'),
    solid: (solid) => solid.kind === 'door',
  },
  {
    key: 'lift',
    title: 'Подматрачна рамка и механизъм',
    step: (id, step) => /lift|рамка|механиз/i.test(id + step.label),
    solid: (solid) => solid.kind === 'lift',
  },
  {
    key: 'mirror',
    title: 'Огледало',
    step: (id) => starts(id, 'mirror'),
    solid: (solid) =>
      (solid.kind === 'box' && (solid.mirrorGlass === true || solid.assembly === 'mirror')) ||
      solid.kind === 'glow' ||
      starts(pieceOf(solid), 'mirror'),
  },
]

/** Splits a cabinet's 3D pieces and its assembly steps into scenes, in working order. */
export function assemblyStages(solids: SceneSolid[], steps: AssemblyStep[]): AssemblyStage[] {
  const stages: AssemblyStage[] = RULES.map((rule) => ({ key: rule.key, title: rule.title, steps: [], minutes: 0, solids: [] }))
  const carcass = stages.find((stage) => stage.key === 'carcass')!
  const finish: AssemblyStage = { key: 'finish', title: 'Довършване', steps: [], minutes: 0, solids: [] }
  for (const solid of solids) {
    if (solid.kind === 'dim') continue
    const index = RULES.findIndex((rule) => rule.solid(solid))
    ;(index >= 0 ? stages[index] : carcass).solids.push(solid)
  }
  for (const step of steps) {
    const index = RULES.findIndex((rule) => rule.step(step.id, step))
    ;(index >= 0 ? stages[index] : finish).steps.push(step)
  }
  return [...stages, finish]
    .map((stage) => ({ ...stage, minutes: Math.round(stage.steps.reduce((sum, step) => sum + step.minutes, 0) * 10) / 10 }))
    .filter((stage) => stage.solids.length > 0 || stage.steps.length > 0)
}
