import { drawingRuleSection } from './draw-3d'
import { laborHourRuleBlock } from './estimate'
import { shelfRuleSection } from './fronts'
import { confirmatRuleBlock, hingeRuleBlock } from './hardware'
import { hoodRuleBlock } from './kitchen-wall'
import { boardRuleBlocks, drawerRuleSection, insetDoorRuleSection, overlayDoorRuleSection } from './materials'
import { carcassRuleSection, clothesRailRuleSection, depthRuleSection } from './nightstand'
import type { RuleSection } from './rule-text'
import { slidingDoorRuleSection } from './sliding-doors'
import { zoneSplitRuleSection } from './zones'

export type { RuleBlock, RuleSection } from './rule-text'

/** Страницата „Правила“ само подрежда текстовете, които двигателите вече смятат. */
export function cabinetRuleSections(): RuleSection[] {
  const carcass = carcassRuleSection()
  return [
    slidingDoorRuleSection(),
    overlayDoorRuleSection(),
    insetDoorRuleSection(),
    zoneSplitRuleSection(),
    depthRuleSection(),
    { ...carcass, blocks: [...carcass.blocks, confirmatRuleBlock(), hoodRuleBlock()] },
    shelfRuleSection(),
    clothesRailRuleSection(),
    drawerRuleSection(),
    { id: 'hardware', title: 'Панти и винтове', blocks: [hingeRuleBlock()] },
    { id: 'edge', title: 'Кант, гръб и рязане', blocks: [...boardRuleBlocks(), laborHourRuleBlock()] },
    drawingRuleSection(),
  ]
}
