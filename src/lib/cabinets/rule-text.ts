/** Text blocks for the Правила page. Filled only by the modules that do the math. */
export interface RuleBlock {
  title: string
  lines: string[]
}

export interface RuleSection {
  id: string
  title: string
  blocks: RuleBlock[]
}
