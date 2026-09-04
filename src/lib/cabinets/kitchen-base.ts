import { parsePartColors, DEFAULT_PART_COLORS } from './colors'
import {
  fastenerLine,
  KITCHEN_BASE_SCREWS_BOTTOM,
  KITCHEN_BASE_SCREWS_RAILS,
  KITCHEN_BASE_SCREWS_TOTAL,
  pricedLine,
  SCREW_5X60,
  SCREW_4X16,
  SCREW_4X20,
  SCREW_35X16,
  SHELF_PIN,
  SHELF_PINS_PER_SHELF,
  HINGE_SOFT_CLOSE,
  HINGE_NORMAL,
  HINGES_PER_SMALL_DOOR,
  SCREWS_4X16_PER_HINGE,
  SCREWS_4X20_PER_HINGE,
  SLIDES_PER_DRAWER,
  SCREWS_35X16_PER_SLIDE,
  SCREWS_35X16_PER_SLIDE_WING,
  isSoftCloseSlide,
  screws35x16PerSlide,
  parseSlideKind,
  parseSlideLength,
  slideId,
  slideName,
  slideUnitPriceEur,
} from './hardware'
import { evenShelfBottoms, KITCHEN_BASE_JOINERY, measureCarcass } from './joinery'
import {
  DEFAULT_HARDBOARD_THICKNESS,
  doorCutSize,
  drawerFrontCutSize,
  doorWithDrawersCutSize,
  parseDoorCount,
  parseDrawerFrontHeights,
  drawerBoxRails,
  canCombineFronts,
  combinedFrontCutHeight,
  COMBINED_FRONT_SAW_BUFFER,
  SOFT_SLIDE_OUTER_RAIL_SHORTEN,
  DRAWER_RAIL_BELOW_FRONT,
  SOFT_INNER_RAIL_HEIGHT_DROP,
} from './materials'
import {
  DEFAULT_LEG_HEIGHT,
  DEFAULT_PANEL_THICKNESS,
  DEFAULT_RAIL_WIDTH,
  DEFAULT_SHELF_FRONT_INSET,
  emptyLabor,
  edges,
  type CabinetGeneratorResult,
  type CabinetTypeDefinition,
  type GeneratedPanel,
  type KitchenBaseParams,
} from './types'
import type { HardwareSettings } from '@/lib/settings'
import { DEFAULT_HARDWARE_SETTINGS } from '@/lib/settings'
import {
  calculatePanelEdgeBandingTime,
  calculateDrawerAssemblyTime,
  type AssemblyTimeSettings,
} from '@/lib/assembly-time'
import { DEFAULT_ASSEMBLY_TIME_SETTINGS } from '@/lib/assembly-time'

export const KITCHEN_BASE_TYPE_ID = 'kitchen-base'

export const DEFAULT_KITCHEN_BASE_PARAMS: KitchenBaseParams = {
  width: 600,
  height: 720,
  depth: 560,
  thickness: DEFAULT_PANEL_THICKNESS,
  legHeight: DEFAULT_LEG_HEIGHT,
  railWidth: DEFAULT_RAIL_WIDTH,
  shelfCount: 0,
  hasBack: true,
  doorCount: 0,
  drawerFrontHeights: [],
  cutFromOneBoard: false,
  slideKind: 'roller',
  slideLength: 500,
  colors: { ...DEFAULT_PART_COLORS },
}

export function parseKitchenBaseParams(raw: Record<string, unknown>): KitchenBaseParams {
  const d = DEFAULT_KITCHEN_BASE_PARAMS
  const num = (key: keyof KitchenBaseParams, fallback: number) => {
    const v = raw[key]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
  }
  const leg = num('legHeight', d.legHeight)
  const depth = num('depth', d.depth)
  const slideKind = parseSlideKind(raw.slideKind)
  return {
    width: num('width', d.width),
    height: num('height', d.height),
    depth,
    thickness: num('thickness', d.thickness),
    legHeight: leg === 150 ? 150 : 100,
    railWidth: num('railWidth', d.railWidth),
    shelfCount: parseShelfCount(raw.shelfCount),
    hasBack: typeof raw.hasBack === 'boolean' ? raw.hasBack : false,
    doorCount: parseDoorCount(raw.doorCount),
    drawerFrontHeights: parseDrawerFrontHeights(raw.drawerFrontHeights, raw.drawerFrontHeight),
    cutFromOneBoard: typeof raw.cutFromOneBoard === 'boolean' ? raw.cutFromOneBoard : false,
    slideKind,
    slideLength: parseSlideLength(raw.slideLength, depth, slideKind),
    colors: parsePartColors(raw.colors),
  }
}

function parseShelfCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(3, Math.floor(n))
}

export function generateKitchenBase(
  raw: Record<string, unknown>,
  settings?: unknown,
): CabinetGeneratorResult {
  const hardwareSettings = (settings as { hardware?: HardwareSettings; assemblyTime?: AssemblyTimeSettings })?.hardware ?? DEFAULT_HARDWARE_SETTINGS
  const assemblyTimeSettings = (settings as { hardware?: HardwareSettings; assemblyTime?: AssemblyTimeSettings })?.assemblyTime ?? DEFAULT_ASSEMBLY_TIME_SETTINGS
  const p = parseKitchenBaseParams(raw)
  const m = measureCarcass(
    { width: p.width, height: p.height, depth: p.depth, thickness: p.thickness },
    KITCHEN_BASE_JOINERY,
  )

  const notes: string[] = [
    `Корпус ${p.width} × ${p.height} × ${p.depth} мм, плоскост ${p.thickness} мм.`,
    `Крачета ${p.legHeight} мм — обща височина от пода ${p.height + p.legHeight} мм.`,
    'Дъното покрива страниците: страниците сядат върху дъното, винтовете се виждат отдолу.',
    'Блендите влизат между страниците горе — по една отпред и отзад.',
    `Сглобяване с винтове ${SCREW_5X60.name}: ${KITCHEN_BASE_SCREWS_BOTTOM} на дъното и ${KITCHEN_BASE_SCREWS_RAILS} за блендите (${KITCHEN_BASE_SCREWS_TOTAL} бр.).`,
  ]

  if (p.depth < p.railWidth * 2) {
    notes.push('Внимание: дълбочината е по-малка от двете бленди една до друга.')
  }

  const hardware = [
    { name: `Краче ${p.legHeight} мм`, quantity: 4 },
    fastenerLine(
      { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur },
      KITCHEN_BASE_SCREWS_BOTTOM,
      'Дъно — винтове отдолу',
    ),
    fastenerLine(
      { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur },
      KITCHEN_BASE_SCREWS_RAILS,
      'Бленди горе',
    ),
  ]
  const panels: GeneratedPanel[] = [
    {
      role: 'bottom' as const,
      name: 'Дъно',
      width: m.bottomW,
      height: m.bottomD,
      quantity: 1,
      canRotate: false,
      edges: edges({ top: true, left: true, right: true }),
      note: 'Кант: предна + двете страни. Задната не се кантира.',
    },
    {
      role: 'side' as const,
      name: 'Страница',
      width: m.sideD,
      height: m.sideH,
      quantity: 2,
      canRotate: false,
      edges: edges({ top: true, left: true }),
      note: 'Кант: предна и горна. Долната сяда в дъното, задната не се вижда.',
    },
    {
      role: 'rail' as const,
      name: 'Бленда',
      width: m.railLength,
      height: p.railWidth,
      quantity: 2,
      canRotate: false,
      edges: edges({ top: true }),
      note: 'Кант: едната дълга страна. Предна и задна бленда са еднакви.',
    },
  ]

  if (p.shelfCount > 0) {
    const bottoms = evenShelfBottoms(m.innerH, p.shelfCount, p.thickness)
    const gap = bottoms[0] ?? 0
    const shelfDepth = m.sideD - DEFAULT_SHELF_FRONT_INSET
    notes.push(
      `${p.shelfCount} ${p.shelfCount === 1 ? 'рафт' : 'рафта'} с еднакви празнини по ${Math.round(gap)} мм.`,
    )
    notes.push(
      `Рафтът е с ${DEFAULT_SHELF_FRONT_INSET} мм по-къс от дълбочината (${shelfDepth} мм) — започва на 5 см отпред и стига дозад.`,
    )
    notes.push(
      `Рафтоносачи: ${p.shelfCount * SHELF_PINS_PER_SHELF} бр. (по ${SHELF_PINS_PER_SHELF} на рафт, 5 цента/бр.).`,
    )
    hardware.push(
      pricedLine(
        { ...SHELF_PIN, unitPriceEur: hardwareSettings.shelfPinEur },
        p.shelfCount * SHELF_PINS_PER_SHELF,
        `по ${SHELF_PINS_PER_SHELF} на рафт`,
      ),
    )
    panels.push({
      role: 'shelf',
      name: 'Рафт',
      width: m.innerW,
      height: shelfDepth,
      quantity: p.shelfCount,
      canRotate: false,
      edges: edges({ top: true }),
      note: `Кант: предната видима страна. Дълбочина ${shelfDepth} мм (корпусът минус 50 мм отпред).`,
    })
  }

  if (p.hasBack) {
    notes.push(
      `Фазер ${DEFAULT_HARDBOARD_THICKNESS} мм на гърба: ${m.innerW} × ${m.sideH} мм, отделен разкрой.`,
    )
    panels.push({
      role: 'back',
      name: 'Фазер',
      width: m.innerW,
      height: m.sideH,
      quantity: 1,
      canRotate: true,
      edges: edges({}),
      material: 'hardboard',
      note: `Фазер ${DEFAULT_HARDBOARD_THICKNESS} мм. Без кант. Разкроява се отделно от ПДЧ.`,
    })
  }

  const drawerHeights = p.drawerFrontHeights
  const hasDrawers = drawerHeights.length > 0
  const doorCount = p.doorCount === 1 || p.doorCount === 2 ? p.doorCount : 0
  const hasDoors = doorCount !== 0
  const includeDoorInCombine = doorCount === 1
  const combineBoard = p.cutFromOneBoard && canCombineFronts(drawerHeights.length, doorCount)
  const softClose = isSoftCloseSlide(p.slideKind)
  let combinedGroupId: string | undefined
  let doorFromCombined = false

  const door =
    doorCount === 1 || doorCount === 2
      ? hasDrawers
        ? doorWithDrawersCutSize(p.width, p.height, drawerHeights, doorCount)
        : doorCutSize(p.width, p.height, doorCount)
      : null

  if (hasDrawers) {
    const heightCounts = countByHeight(drawerHeights)
    const n = drawerHeights.length
    const slideQty = n * SLIDES_PER_DRAWER
    const perSlide = screws35x16PerSlide(p.slideKind)
    const slideScrews = slideQty * perSlide
    const slidePrice = slideUnitPriceEur(p.slideKind, p.slideLength, hardwareSettings)
    const slideScrewNote = softClose
      ? `по ${SCREWS_35X16_PER_SLIDE} на водач + ${SCREWS_35X16_PER_SLIDE_WING} за перките`
      : `по ${SCREWS_35X16_PER_SLIDE} на водач`

    const heightsLabel = drawerHeights.map((h) => `${Math.round(h)}`).join(' + ')
    notes.push(
      n === 1
        ? `Чекмедже отгоре ${Math.round(drawerHeights[0])} мм.`
        : `${n} чекмеджета отгоре надолу: ${heightsLabel} мм. Фуга 3 мм между челата.`,
    )

    if (combineBoard) {
      const drawerCuts = drawerHeights.map((h) => drawerFrontCutSize(p.width, h))
      const pieces = includeDoorInCombine && door ? [...drawerCuts, door] : drawerCuts
      const combinedHeight = combinedFrontCutHeight(pieces.map((c) => c.height))
      const width = drawerCuts[0]?.width ?? pieces[0]?.width ?? 0
      combinedGroupId = `combined-${Date.now()}`
      doorFromCombined = includeDoorInCombine && !!door

      const partsLabel = pieces
        .map((c) => Math.round(c.height))
        .join(' + ')
      const bufferNote =
        pieces.length > 1
          ? ` + ${COMBINED_FRONT_SAW_BUFFER * (pieces.length - 1)} мм буфер`
          : ''
      const combinedName = doorFromCombined
        ? drawerHeights.length === 1
          ? '🔴 Чело+Врата (комбинирано)'
          : '🔴 Чела+Врата (комбинирано)'
        : '🔴 Чела (комбинирано)'
      const afterSplit = [
        ...drawerHeights.map((_, i) =>
          drawerHeights.length === 1 ? `чело ${Math.round(drawerCuts[i].height)} мм` : `чело ${i + 1} ${Math.round(drawerCuts[i].height)} мм`,
        ),
        ...(doorFromCombined && door ? [`врата ${Math.round(door.height)} мм`] : []),
      ].join(', ')

      notes.push(
        `${doorFromCombined ? 'Чела и врата' : 'Чела'} от една плоча: Първо рязане ${Math.round(width)} × ${Math.round(combinedHeight)} мм (${partsLabel}${bufferNote}).`,
      )
      notes.push(`След кантиране се разрязва на ${afterSplit}.`)

      panels.push({
        role: 'drawer-front',
        name: combinedName,
        width,
        height: combinedHeight,
        quantity: 1,
        canRotate: false,
        edges: edges({ top: true, bottom: true, left: true, right: true }),
        note: `ПЪРВО РЯЗАНЕ от една плоча за продължена фладера. След кантиране се разрязва на ${pieces.length} парчета.`,
        groupId: combinedGroupId,
        highlightColor: 'red',
      })

      drawerHeights.forEach((frontH, i) => {
        const cut = drawerCuts[i]
        panels.push({
          role: 'drawer-front',
          name:
            drawerHeights.length === 1
              ? '  ↳ Чело (след разрязване)'
              : `  ↳ Чело ${i + 1} (${Math.round(frontH)} мм)`,
          width: cut.width,
          height: cut.height,
          quantity: 1,
          canRotate: false,
          edges: edges({}),
          note: '⚠️ НЕ СЕ РЕЖЕ ОТДЕЛНО - произлиза от комбинираното парче след разрязване.',
          groupId: combinedGroupId,
          excludeFromCutting: true,
          highlightColor: 'red',
        })
      })

      if (doorFromCombined && door) {
        panels.push({
          role: 'door',
          name: '  ↳ Врата (след разрязване)',
          width: door.width,
          height: door.height,
          quantity: 1,
          canRotate: false,
          edges: edges({}),
          note: '⚠️ НЕ СЕ РЕЖЕ ОТДЕЛНО - произлиза от комбинираното парче след разрязване.',
          groupId: combinedGroupId,
          excludeFromCutting: true,
          highlightColor: 'red',
        })
      }
    } else {
      for (const [frontH, qty] of heightCounts) {
        const drawerFront = drawerFrontCutSize(p.width, frontH)
        const name =
          n === 1
            ? 'Чело на чекмедже'
            : heightCounts.length === 1
              ? 'Чело на чекмедже'
              : `Чело ${Math.round(frontH)} мм`
        notes.push(
          `${name}: рязане ${Math.round(drawerFront.width)} × ${Math.round(drawerFront.height)} мм × ${qty} бр. (кант 2 мм от 4 страни).`,
        )
        panels.push({
          role: 'drawer-front',
          name,
          width: drawerFront.width,
          height: drawerFront.height,
          quantity: qty,
          canRotate: false,
          edges: edges({ top: true, bottom: true, left: true, right: true }),
          note: 'Кант 2 мм от 4 страни. Размерът е за рязане (без канта).',
        })
      }
    }

    notes.push(
      `Водачи: ${slideQty} бр. ${slideName(p.slideKind, p.slideLength)} (по ${SLIDES_PER_DRAWER} на чекмедже) · винтчета 3.5×16: ${slideScrews} бр. (${slideScrewNote}).`,
    )

    let wroteBoxIntro = false
    for (const [frontH, qty] of heightCounts) {
      const box = drawerBoxRails(p.width, p.thickness, frontH, p.slideLength, softClose)
      if (!box) continue
      if (!wroteBoxIntro) {
        const gapTotal = box.sideGapEach * 2
        notes.push(
          `Чекмедже: вътрешна ширина ${Math.round(box.innerCarcassW)} мм − ${gapTotal} мм луфт (${box.sideGapEach} мм от страна) = ${Math.round(box.drawerOuterW)} мм общо.`,
        )
        wroteBoxIntro = true
      }
      const manySizes = heightCounts.length > 1
      notes.push(
        `Царги${manySizes ? ` за чело ${Math.round(frontH)} мм` : ''}: вътрешни ${Math.round(box.inner.width)} × ${Math.round(box.inner.height)} мм (${2 * qty} бр.), външни ${Math.round(box.outer.width)} × ${Math.round(box.outer.height)} мм (${2 * qty} бр.${softClose ? `, водачът минус ${SOFT_SLIDE_OUTER_RAIL_SHORTEN} мм, вътрешните с ${SOFT_INNER_RAIL_HEIGHT_DROP} мм по-ниски` : ', колкото водача'}). Височината на външните е с ${DRAWER_RAIL_BELOW_FRONT} мм по-малка от челото.`,
      )
      panels.push({
        role: 'drawer-back',
        name: manySizes ? `Царга вътрешна (${Math.round(frontH)} мм)` : 'Царга вътрешна',
        width: box.inner.width,
        height: box.inner.height,
        quantity: 2 * qty,
        canRotate: false,
        edges: edges({ top: true }),
        note: softClose
          ? `Предна и задна на кутията. ${Math.round(box.drawerOuterW)} − 2×${p.thickness} = ${Math.round(box.inner.width)} мм. С ${SOFT_INNER_RAIL_HEIGHT_DROP} мм по-ниски от външните заради канала за гърба. Кант: горната дълга страна.`
          : `Предна и задна на кутията. ${Math.round(box.drawerOuterW)} − 2×${p.thickness} = ${Math.round(box.inner.width)} мм. Кант: горната дълга страна.`,
      })
      panels.push({
        role: 'drawer-side',
        name: manySizes ? `Царга външна (${Math.round(frontH)} мм)` : 'Царга външна',
        width: box.outer.width,
        height: box.outer.height,
        quantity: 2 * qty,
        canRotate: false,
        edges: edges({ top: true }),
        note: softClose
          ? `Страници на кутията. Дължина = водач ${p.slideLength} − ${SOFT_SLIDE_OUTER_RAIL_SHORTEN} мм. Кант: горната дълга страна.`
          : `Страници на кутията. Дължина = водач ${p.slideLength} мм. Кант: горната дълга страна.`,
      })
    }

    hardware.push(
      pricedLine(
        { id: slideId(p.slideKind, p.slideLength), name: slideName(p.slideKind, p.slideLength), unitPriceEur: slidePrice },
        slideQty,
        `по ${SLIDES_PER_DRAWER} на чекмедже`,
      ),
    )
    hardware.push(
      fastenerLine(
        { ...SCREW_35X16, packPriceEur: hardwareSettings.smallScrew1000PackEur },
        slideScrews,
        slideScrewNote,
      ),
    )
  }

  if (hasDoors && door) {
    const doorWord = p.doorCount === 1 ? 'една врата' : 'две врати'
    const totalHinges = p.doorCount * HINGES_PER_SMALL_DOOR
    const hinge4x16 = totalHinges * SCREWS_4X16_PER_HINGE
    const hinge4x20 = totalHinges * SCREWS_4X20_PER_HINGE
    const hingePrice = hardwareSettings.useNormalHinge ? hardwareSettings.hingeNormalEur : hardwareSettings.hingeSoftCloseEur
    const hingeName = hardwareSettings.useNormalHinge ? 'Панта нормално прибиране' : 'Панта плавно прибиране'

    notes.push(
      hasDrawers
        ? `${p.doorCount === 1 ? 'Една врата' : 'Две врати'}: рязане ${Math.round(door.width)} × ${Math.round(door.height)} мм (фуга 5 мм отгоре, 3 мм между челата, кант 2 мм от 4 страни).`
        : `${p.doorCount === 1 ? 'Една врата' : 'Две врати'}: рязане ${Math.round(door.width)} × ${Math.round(door.height)} мм (фуга 5 мм само отгоре, кант 2 мм от 4 страни).`,
    )
    notes.push(
      `Панти: ${totalHinges} бр. (по ${HINGES_PER_SMALL_DOOR} на врата) · винтчета 4×16: ${hinge4x16} бр. и 4×20: ${hinge4x20} бр. (по ${SCREWS_4X16_PER_HINGE}+${SCREWS_4X20_PER_HINGE} на панта).`,
    )

    hardware.push(
      pricedLine(
        { id: hardwareSettings.useNormalHinge ? HINGE_NORMAL.id : HINGE_SOFT_CLOSE.id, name: hingeName, unitPriceEur: hingePrice },
        totalHinges,
        `по ${HINGES_PER_SMALL_DOOR} на врата`,
      ),
    )
    hardware.push(
      fastenerLine(
        { ...SCREW_4X16, packPriceEur: hardwareSettings.smallScrew1000PackEur },
        hinge4x16,
        `по ${SCREWS_4X16_PER_HINGE} на панта`,
      ),
    )
    hardware.push(
      fastenerLine(
        { ...SCREW_4X20, packPriceEur: hardwareSettings.smallScrew1000PackEur },
        hinge4x20,
        `по ${SCREWS_4X20_PER_HINGE} на панта`,
      ),
    )

    if (!doorFromCombined) {
      panels.push({
        role: 'door',
        name: 'Врата',
        width: door.width,
        height: door.height,
        quantity: p.doorCount,
        canRotate: false,
        edges: edges({ top: true, bottom: true, left: true, right: true }),
        note: `Кант 2 мм от 4 страни. ${doorWord}. Размерът е за рязане (без канта).`,
      })
    }
  }

  // Calculate assembly time
  let assemblyMinutes = 0
  
  // Add time for installing legs (if has legs)
  if (p.legHeight > 0) {
    assemblyMinutes += assemblyTimeSettings.installLegsMinutes
  }
  
  // Add time for assembling sides
  assemblyMinutes += assemblyTimeSettings.assembleSidesMinutes
  
  // Add time for assembling top rails
  assemblyMinutes += assemblyTimeSettings.assembleTopRailsMinutes
  
  // Add time for edge banding processing (chiseling and sanding) for all panels
  for (const panel of panels) {
    if (panel.excludeFromCutting) continue
    const edgeTime = calculatePanelEdgeBandingTime(
      panel.width,
      panel.height,
      panel.edges,
      panel.quantity,
      assemblyTimeSettings.edgeBanding,
    )
    assemblyMinutes += edgeTime
  }
  
  // Add time for drawer assembly if there's a drawer
  const drawerCount = p.drawerFrontHeights.length
  if (drawerCount > 0) {
    assemblyMinutes += calculateDrawerAssemblyTime(drawerCount, assemblyTimeSettings)
    // Also add time for installing guides on the sides
    assemblyMinutes += assemblyTimeSettings.installDrawerGuidesMinutes
  }
  
  // Add time for door installation (use the doorCount variable already defined above)
  if (doorCount > 0) {
    // Time per door includes: cleaning, measuring, drilling for hinges, installing
    assemblyMinutes += doorCount * assemblyTimeSettings.installDoorMinutes
  }

  return {
    joinery: KITCHEN_BASE_JOINERY,
    labor: {
      ...emptyLabor(),
      assemblyMinutes: Math.round(assemblyMinutes * 10) / 10,
    },
    hardware,
    notes,
    panels,
  }
}

function countByHeight(heights: number[]): [number, number][] {
  const counts = new Map<number, number>()
  for (const h of heights) counts.set(h, (counts.get(h) ?? 0) + 1)
  return [...counts.entries()]
}

export const kitchenBaseType: CabinetTypeDefinition = {
  id: KITCHEN_BASE_TYPE_ID,
  name: 'Долен кухненски шкаф',
  category: 'kitchen-base',
  description:
    'Корпус на крачета. По избор фазер, врати и чекмеджета с различни височини.',
  defaultParams: { ...DEFAULT_KITCHEN_BASE_PARAMS },
  generate: generateKitchenBase,
}
