import {
  fastenerLine,
  pricedLine,
  CLOTHES_RAIL,
  SCREW_4X16,
  SCREW_4X20,
  SCREW_35X16,
  SHELF_PIN,
  SHELF_PINS_PER_SHELF,
  HINGE_SOFT_CLOSE,
  HINGE_NORMAL,
  HANDLE_NORMAL,
  HANDLES_PER_DOOR,
  HANDLES_PER_DRAWER,
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
  confirmatCount,
  SCREW_5X60,
  type SlideKind,
} from './hardware'
import { evenShelfBottoms } from './joinery'
import {
  doorCutSize,
  doorCutRuleNote,
  drawerFrontCutSize,
  doorWithDrawersCutSize,
  parseDoorCount,
  parseDrawerFrontHeights,
  parseShelfCount,
  drawerBoxRails,
  canCombineFronts,
  combinedFrontCutHeight,
  COMBINED_FRONT_SAW_BUFFER,
  SOFT_SLIDE_OUTER_RAIL_SHORTEN,
  DRAWER_RAIL_BELOW_FRONT,
  SOFT_INNER_RAIL_HEIGHT_DROP,
  DEFAULT_HARDBOARD_THICKNESS,
  hardboardCutSize,
  type DoorCount,
} from './materials'
import { DEFAULT_SHELF_FRONT_INSET, FASCIA_SETBACK_MM, edges, panelHoleFits, panelHoleNote, type GeneratedPanel, type HardwareItem, type PanelHole } from './types'
import type { HardwareSettings } from '@/lib/settings'
import {
  layoutInterior,
  layoutCounts,
  parseDoorSpan,
  parseFixedShelves,
  parsePartitions,
  parseZoneMap,
  fixedShelfMeasureLabel,
  partitionMeasureLabel,
  consecutiveZoneFrontRuns,
  canCombineZoneFrontRun,
  zoneFrontStackKind,
  type CabinetZoneId,
  type DoorSpan,
  type FixedShelfSpec,
  type OverlayFrontCovers,
  type LaidOutZone,
  type PartitionSpec,
  type ZoneFittings,
} from './zones'

export interface InteriorFittings {
  shelfCount: number
  /** 3 mm hardboard back. */
  hasBack: boolean
  doorCount: DoorCount
  drawerFrontHeights: number[]
  cutFromOneBoard: boolean
  /** When true (default), 1 handle per door and per drawer is added to the price. */
  includeHandles: boolean
  /** Clothes hanging rail between the sides. */
  hasClothesRail: boolean
  slideKind: SlideKind
  slideLength: number
  /** Up to 2 shelves screwed through the sides with 5×60. */
  fixedShelves: FixedShelfSpec[]
  /** Vertical dividers that split the carcass into columns. */
  partitions: PartitionSpec[]
  /** Full-height doors vs doors only on some compartments. */
  doorSpan: DoorSpan
  /** Fittings per compartment when the carcass is split by a shelf or divider. */
  zones: Partial<Record<CabinetZoneId, ZoneFittings>>
}

export const EMPTY_INTERIOR_FITTINGS: InteriorFittings = {
  shelfCount: 0,
  hasBack: false,
  doorCount: 0,
  drawerFrontHeights: [],
  cutFromOneBoard: false,
  includeHandles: true,
  hasClothesRail: false,
  slideKind: 'roller',
  slideLength: 300,
  fixedShelves: [],
  partitions: [],
  doorSpan: 'full',
  zones: {},
}

export function parseInteriorFittings(raw: Record<string, unknown>, slideDepth: number): InteriorFittings {
  const slideKind = parseSlideKind(raw.slideKind)
  return {
    shelfCount: parseShelfCount(raw.shelfCount),
    hasBack: raw.hasBack === true,
    doorCount: parseDoorCount(raw.doorCount),
    drawerFrontHeights: parseDrawerFrontHeights(raw.drawerFrontHeights, raw.drawerFrontHeight),
    cutFromOneBoard: typeof raw.cutFromOneBoard === 'boolean' ? raw.cutFromOneBoard : false,
    includeHandles: raw.includeHandles !== false,
    hasClothesRail: raw.hasClothesRail === true,
    slideKind,
    slideLength: parseSlideLength(raw.slideLength, slideDepth, slideKind),
    fixedShelves: parseFixedShelves(raw.fixedShelves),
    partitions: parsePartitions(raw.partitions),
    doorSpan: parseDoorSpan(raw.doorSpan),
    zones: parseZoneMap(raw.zones),
  }
}

export function appendHardboard(
  input: { width: number; height: number; plinthHeight?: number },
  panels: GeneratedPanel[],
  notes: string[],
): void {
  const plinth = Math.max(0, input.plinthHeight ?? 0)
  const cut = hardboardCutSize(input.width, input.height, plinth)
  notes.push(
    plinth > 0
      ? `Фазер ${DEFAULT_HARDBOARD_THICKNESS} мм на гърба: ${cut.width} × ${cut.height} мм — цокълът ${plinth} мм не се покрива.`
      : `Фазер ${DEFAULT_HARDBOARD_THICKNESS} мм на гърба: ${cut.width} × ${cut.height} мм — покрива целия гръб.`,
  )
  panels.push({
    role: 'back',
    name: 'Фазер',
    width: cut.width,
    height: cut.height,
    quantity: 1,
    canRotate: true,
    edges: edges({}),
    material: 'hardboard',
    note:
      plinth > 0
        ? `Фазер ${DEFAULT_HARDBOARD_THICKNESS} мм. Без кант. Цокълът не се запълва. Разкроява се отделно от ПДЧ.`
        : `Фазер ${DEFAULT_HARDBOARD_THICKNESS} мм. Без кант. Покрива целия гръб. Разкроява се отделно от ПДЧ.`,
  })
}

/** Inner span of a clothes rail between the sides. */
export function clothesRailLengthMm(width: number, thickness: number): number {
  return Math.max(0, width - 2 * thickness)
}

export function appendClothesRail(
  input: { width: number; thickness: number; zoneLabel?: string; innerLengthMm?: number },
  hardware: HardwareItem[],
  notes: string[],
  hardwareSettings: HardwareSettings,
): void {
  const lengthMm = Math.round(input.innerLengthMm ?? clothesRailLengthMm(input.width, input.thickness))
  if (!(lengthMm > 0)) return
  const metres = Math.round((lengthMm / 1000) * 1000) / 1000
  const price = metres * hardwareSettings.clothesRailEurPerM
  const where = input.zoneLabel ? `${input.zoneLabel}: ` : ''
  notes.push(`${where}Лост за дрехи ${lengthMm} мм (${metres} м) · ${hardwareSettings.clothesRailEurPerM} €/м.`)
  hardware.push(
    pricedLine(
      { id: CLOTHES_RAIL.id, name: CLOTHES_RAIL.name, unitPriceEur: price },
      1,
      `${input.zoneLabel ? `${input.zoneLabel} · ` : ''}${lengthMm} мм · ${hardwareSettings.clothesRailEurPerM} €/м`,
    ),
  )
}

export function appendShelves(
  input: {
    shelfCount: number
    innerW: number
    innerH: number
    sideD: number
    thickness: number
    zoneLabel?: string
    hole?: PanelHole
  },
  panels: GeneratedPanel[],
  hardware: HardwareItem[],
  notes: string[],
  hardwareSettings: HardwareSettings,
): void {
  if (input.shelfCount <= 0) return
  const bottoms = evenShelfBottoms(input.innerH, input.shelfCount, input.thickness)
  const gap = bottoms[0] ?? 0
  const shelfDepth = input.sideD - DEFAULT_SHELF_FRONT_INSET
  const hole = input.hole && panelHoleFits(input.innerW, shelfDepth, input.hole) ? input.hole : undefined
  const where = input.zoneLabel ? `${input.zoneLabel}: ` : ''
  const name = input.zoneLabel ? `Рафт (${input.zoneLabel})` : 'Рафт'
  notes.push(
    `${where}${input.shelfCount} ${input.shelfCount === 1 ? 'рафт' : 'рафта'} с еднакви празнини по ${Math.round(gap)} мм.`,
  )
  notes.push(
    `Рафтът е с ${DEFAULT_SHELF_FRONT_INSET} мм по-къс от дълбочината (${shelfDepth} мм) — започва на 5 см отпред и стига дозад.`,
  )
  if (hole) {
    notes.push(`${where}${panelHoleNote(hole)}`)
  }
  notes.push(
    `Рафтоносачи: ${input.shelfCount * SHELF_PINS_PER_SHELF} бр. (по ${SHELF_PINS_PER_SHELF} на рафт, 5 цента/бр.).`,
  )
  hardware.push(
    pricedLine(
      { ...SHELF_PIN, unitPriceEur: hardwareSettings.shelfPinEur },
      input.shelfCount * SHELF_PINS_PER_SHELF,
      `по ${SHELF_PINS_PER_SHELF} на рафт${input.zoneLabel ? ` · ${input.zoneLabel}` : ''}`,
    ),
  )
  panels.push({
    role: 'shelf',
    name,
    width: input.innerW,
    height: shelfDepth,
    quantity: input.shelfCount,
    canRotate: false,
    edges: edges({ top: true }),
    note: hole
      ? `Кант: предната видима страна. Дълбочина ${shelfDepth} мм (корпусът минус 50 мм отпред). ${panelHoleNote(hole)}`
      : `Кант: предната видима страна. Дълбочина ${shelfDepth} мм (корпусът минус 50 мм отпред).`,
    hole,
  })
}

export function appendFixedShelves(
  input: {
    count: number
    innerW: number
    sideD: number
    thickness: number
    positionsNote?: string
    /** Clear widths of each bay when vertical dividers split the shelf. */
    columnInnerWs?: number[]
    /** Per-spec bay: `null` = every column, otherwise that column only. */
    shelfColumns?: (number | null)[]
    hole?: PanelHole
  },
  panels: GeneratedPanel[],
  hardware: HardwareItem[],
  notes: string[],
  hardwareSettings: HardwareSettings,
): void {
  if (input.count <= 0) return
  const allBays = (input.columnInnerWs?.filter((w) => w > 0) ?? []).length > 1
    ? input.columnInnerWs!.filter((w) => w > 0)
    : [input.innerW]
  const pieces: number[] = []
  if (input.shelfColumns && input.shelfColumns.length > 0) {
    for (const col of input.shelfColumns) {
      if (col == null) {
        pieces.push(...allBays)
      } else {
        const w = input.columnInnerWs?.[col]
        if (typeof w === 'number' && w > 0) pieces.push(w)
        else if (allBays.length === 1) pieces.push(allBays[0])
      }
    }
  } else {
    for (let i = 0; i < input.count; i++) pieces.push(...allBays)
  }
  if (pieces.length === 0) return
  const perSide = confirmatCount(input.sideD)
  const screws = perSide * 2 * pieces.length
  const splitNote = pieces.length > input.count ? ' Отделен рафт във всяка избрана част.' : ''
  notes.push(
    input.count === 1
      ? `1 фиксиран рафт — хванат с винтове 5×60 през страниците, не с рафтоносачи.${input.positionsNote ? ` ${input.positionsNote}` : ''}${splitNote}`
      : `${input.count} фиксирани рафта — хванати с винтове 5×60 през страниците.${input.positionsNote ? ` ${input.positionsNote}` : ''}${splitNote}`,
  )
  notes.push(
    `Винтове 5×60: ${screws} бр. (${perSide} на страница × 2 страници${pieces.length > 1 ? ` × ${pieces.length} рафта` : ''}). Пълна дълбочина, без отстъп отпред.`,
  )
  hardware.push(
    fastenerLine(
      { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur },
      screws,
      `Фиксиран рафт — ${perSide} на страница`,
    ),
  )
  const byWidth = new Map<number, number>()
  for (const w of pieces) byWidth.set(w, (byWidth.get(w) ?? 0) + 1)
  for (const [w, qty] of byWidth) {
      const hole = input.hole && panelHoleFits(w, input.sideD, input.hole) ? input.hole : undefined
      panels.push({
      role: 'shelf',
      name: pieces.length > input.count || allBays.length > 1 ? 'Фиксиран рафт (част)' : 'Фиксиран рафт',
      width: w,
      height: input.sideD,
      quantity: qty,
      canRotate: false,
      edges: edges({ top: true }),
      note: hole
        ? `Кант: предната видима страна. Хваща се с 5×60 през страниците. Пълна дълбочина ${input.sideD} мм. ${panelHoleNote(hole)}`
        : `Кант: предната видима страна. Хваща се с 5×60 през страниците. Пълна дълбочина ${input.sideD} мм.`,
      hole,
    })
  }
}

export function appendPartitions(
  input: {
    count: number
    sideD: number
    sideH: number
    positionsNote?: string
    coveringBottom?: boolean
    innerTop?: boolean
  },
  panels: GeneratedPanel[],
  hardware: HardwareItem[],
  notes: string[],
  hardwareSettings: HardwareSettings,
): void {
  if (input.count <= 0) return
  const perEnd = confirmatCount(input.sideD)
  let screws = perEnd * input.count
  let joinNote = input.coveringBottom
    ? `${perEnd} през дъното отдолу`
    : `${perEnd} през страницата в дъното`
  if (input.innerTop) {
    screws += perEnd * input.count
    joinNote += ` и ${perEnd} през страницата в плота`
  }
  notes.push(
    input.count === 1
      ? `1 разделителна страница ${Math.round(input.sideD)} × ${Math.round(input.sideH)} мм — вътрешна страница, сяда на дъното и разделя шкафа.${input.positionsNote ? ` ${input.positionsNote}` : ''}`
      : `${input.count} разделителни страници ${Math.round(input.sideD)} × ${Math.round(input.sideH)} мм — сядат на дъното и разделят шкафа на ${input.count + 1} части.${input.positionsNote ? ` ${input.positionsNote}` : ''}`,
  )
  notes.push(`Винтове 5×60: ${screws} бр. (${joinNote} × ${input.count === 1 ? '1 страница' : `${input.count} страници`}).`)
  hardware.push(
    fastenerLine(
      { ...SCREW_5X60, packPriceEur: hardwareSettings.screw5x60_500PackEur },
      screws,
      'Разделителна страница — 5×60',
    ),
  )
  panels.push({
    role: 'side',
    name: input.count === 1 ? 'Разделителна страница' : 'Разделителна страница',
    width: input.sideD,
    height: input.sideH,
    quantity: input.count,
    canRotate: false,
    edges: edges({ top: true, left: true }),
    note: 'Кант: предна и горна. Сяда на дъното като вътрешна страница.',
  })
}

export function appendDoorsAndDrawers(
  input: {
    width: number
    frontHeight: number
    thickness: number
    doorCount: DoorCount
    drawerFrontHeights: number[]
    cutFromOneBoard: boolean
    includeHandles?: boolean
    slideKind: SlideKind
    slideLength: number
    zoneLabel?: string
    groupKey?: string
    /** Fronts already first-cut as one board with neighbouring parts. */
    externalCombined?: { groupId: string }
  },
  panels: GeneratedPanel[],
  hardware: HardwareItem[],
  notes: string[],
  hardwareSettings: HardwareSettings,
): { doorCount: number; drawerCount: number } {
  const drawerHeights = input.drawerFrontHeights
  const hasDrawers = drawerHeights.length > 0
  const doorCount = input.doorCount === 1 || input.doorCount === 2 ? input.doorCount : 0
  const hasDoors = doorCount !== 0
  const includeDoorInCombine = doorCount === 1
  const fromExternal = !!input.externalCombined
  const combineBoard =
    !fromExternal && input.cutFromOneBoard && canCombineFronts(drawerHeights.length, doorCount)
  const softClose = isSoftCloseSlide(input.slideKind)
  let combinedGroupId: string | undefined = input.externalCombined?.groupId
  let doorFromCombined = fromExternal && hasDoors

  const door =
    doorCount === 1 || doorCount === 2
      ? hasDrawers
        ? doorWithDrawersCutSize(input.width, input.frontHeight, drawerHeights, doorCount)
        : doorCutSize(input.width, input.frontHeight, doorCount)
      : null
  const where = input.zoneLabel ? `${input.zoneLabel}: ` : ''
  const zoneInName = input.zoneLabel ? ` (${input.zoneLabel})` : ''

  if (hasDrawers) {
    const heightCounts = countByHeight(drawerHeights)
    const n = drawerHeights.length
    const slideQty = n * SLIDES_PER_DRAWER
    const perSlide = screws35x16PerSlide(input.slideKind)
    const slideScrews = slideQty * perSlide
    const slidePrice = slideUnitPriceEur(input.slideKind, input.slideLength, hardwareSettings)
    const slideScrewNote = softClose
      ? `по ${SCREWS_35X16_PER_SLIDE} на водач + ${SCREWS_35X16_PER_SLIDE_WING} за перките`
      : `по ${SCREWS_35X16_PER_SLIDE} на водач`

    const heightsLabel = drawerHeights.map((h) => `${Math.round(h)}`).join(' + ')
    notes.push(
      n === 1
        ? `${where}Чекмедже отгоре ${Math.round(drawerHeights[0])} мм.`
        : `${where}${n} чекмеджета отгоре надолу: ${heightsLabel} мм. Фуга 3 мм между челата.`,
    )

    if (combineBoard) {
      const drawerCuts = drawerHeights.map((h) => drawerFrontCutSize(input.width, h))
      const pieces = includeDoorInCombine && door ? [...drawerCuts, door] : drawerCuts
      const combinedHeight = combinedFrontCutHeight(pieces.map((c) => c.height))
      const width = drawerCuts[0]?.width ?? pieces[0]?.width ?? 0
      combinedGroupId = input.groupKey ?? `combined-${input.zoneLabel ?? 'front'}`
      doorFromCombined = includeDoorInCombine && !!door

      const partsLabel = pieces.map((c) => Math.round(c.height)).join(' + ')
      const bufferNote =
        pieces.length > 1
          ? ` + ${COMBINED_FRONT_SAW_BUFFER * (pieces.length - 1)} мм буфер`
          : ''
      const combinedName = doorFromCombined
        ? drawerHeights.length === 1
          ? `🔴 Чело+Врата (комбинирано)${zoneInName}`
          : `🔴 Чела+Врата (комбинирано)${zoneInName}`
        : `🔴 Чела (комбинирано)${zoneInName}`
      const afterSplit = [
        ...drawerHeights.map((_, i) =>
          drawerHeights.length === 1
            ? `чело ${Math.round(drawerCuts[i].height)} мм`
            : `чело ${i + 1} ${Math.round(drawerCuts[i].height)} мм`,
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
    } else if (fromExternal && combinedGroupId) {
      drawerHeights.forEach((frontH, i) => {
        const cut = drawerFrontCutSize(input.width, frontH)
        const name =
          (n === 1 ? '  ↳ Чело (след разрязване)' : `  ↳ Чело ${i + 1} (${Math.round(frontH)} мм)`) +
          zoneInName
        notes.push(
          `${where}${n === 1 ? 'Чело' : `Чело ${i + 1}`}: рязане ${Math.round(cut.width)} × ${Math.round(cut.height)} мм — от комбинираната плоча.`,
        )
        panels.push({
          role: 'drawer-front',
          name,
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
    } else {
      drawerHeights.forEach((frontH, i) => {
        const drawerFront = drawerFrontCutSize(input.width, frontH)
        const name =
          (n === 1 ? 'Чело на чекмедже' : `Чело ${i + 1}`) + zoneInName
        notes.push(
          `${name}: рязане ${Math.round(drawerFront.width)} × ${Math.round(drawerFront.height)} мм (кант 2 мм от 4 страни).`,
        )
        panels.push({
          role: 'drawer-front',
          name,
          width: drawerFront.width,
          height: drawerFront.height,
          quantity: 1,
          canRotate: false,
          edges: edges({ top: true, bottom: true, left: true, right: true }),
          note: 'Кант 2 мм от 4 страни. Размерът е за рязане (без канта).',
        })
      })
    }

    notes.push(
      `Водачи: ${slideQty} бр. ${slideName(input.slideKind, input.slideLength)} (по ${SLIDES_PER_DRAWER} на чекмедже) · винтчета 3.5×16: ${slideScrews} бр. (${slideScrewNote}).`,
    )

    let wroteBoxIntro = false
    for (const [frontH, qty] of heightCounts) {
      const box = drawerBoxRails(input.width, input.thickness, frontH, input.slideLength, softClose)
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
        `Царги${manySizes ? ` за чело ${Math.round(frontH)} мм` : ''}: вътрешни ${Math.round(box.inner.width)} × ${Math.round(box.inner.height)} мм (${2 * qty} бр.), външни ${Math.round(box.outer.width)} × ${Math.round(box.outer.height)} мм (${2 * qty} бр.${softClose ? `, водачът минус ${SOFT_SLIDE_OUTER_RAIL_SHORTEN} мм, вътрешните с ${SOFT_INNER_RAIL_HEIGHT_DROP} мм по-ниски` : ', колкото водача'}). Височината на външните е челото минус ${DRAWER_RAIL_BELOW_FRONT} мм, закръглена на 10 мм.`,
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
          ? `Предна и задна на кутията. ${Math.round(box.drawerOuterW)} − 2×${input.thickness} = ${Math.round(box.inner.width)} мм. С ${SOFT_INNER_RAIL_HEIGHT_DROP} мм по-ниски от външните заради канала за гърба. Кант: горната дълга страна.`
          : `Предна и задна на кутията. ${Math.round(box.drawerOuterW)} − 2×${input.thickness} = ${Math.round(box.inner.width)} мм. Кант: горната дълга страна.`,
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
          ? `Страници на кутията. Дължина = водач ${input.slideLength} − ${SOFT_SLIDE_OUTER_RAIL_SHORTEN} мм. Кант: горната дълга страна. Канал за водача с плавно прибиране на по-високата царга.`
          : `Страници на кутията. Дължина = водач ${input.slideLength} мм. Кант: горната дълга страна.`,
      })
    }

    hardware.push(
      pricedLine(
        { id: slideId(input.slideKind, input.slideLength), name: slideName(input.slideKind, input.slideLength), unitPriceEur: slidePrice },
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
    const doorWord = doorCount === 1 ? 'една врата' : 'две врати'
    const totalHinges = doorCount * HINGES_PER_SMALL_DOOR
    const hinge4x16 = totalHinges * SCREWS_4X16_PER_HINGE
    const hinge4x20 = totalHinges * SCREWS_4X20_PER_HINGE
    const hingePrice = hardwareSettings.useNormalHinge ? hardwareSettings.hingeNormalEur : hardwareSettings.hingeSoftCloseEur
    const hingeName = hardwareSettings.useNormalHinge ? 'Панта нормално прибиране' : 'Панта плавно прибиране'

    notes.push(
      `${where}${doorCount === 1 ? 'Една врата' : 'Две врати'}: рязане ${Math.round(door.width)} × ${Math.round(door.height)} мм (${doorCutRuleNote({ withDrawerGaps: hasDrawers })}).`,
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
        name: input.zoneLabel ? `Врата (${input.zoneLabel})` : 'Врата',
        width: door.width,
        height: door.height,
        quantity: doorCount,
        canRotate: false,
        edges: edges({ top: true, bottom: true, left: true, right: true }),
        note: `Кант 2 мм от 4 страни. ${doorWord}. Размерът е за рязане (без канта).`,
      })
    } else if (fromExternal && combinedGroupId && !combineBoard) {
      panels.push({
        role: 'door',
        name: `  ↳ Врата (след разрязване)${zoneInName}`,
        width: door.width,
        height: door.height,
        quantity: doorCount,
        canRotate: false,
        edges: edges({}),
        note: '⚠️ НЕ СЕ РЕЖЕ ОТДЕЛНО - произлиза от комбинираното парче след разрязване.',
        groupId: combinedGroupId,
        excludeFromCutting: true,
        highlightColor: 'red',
      })
    }
  }

  const handleCount =
    doorCount * HANDLES_PER_DOOR + drawerHeights.length * HANDLES_PER_DRAWER
  if (input.includeHandles !== false && handleCount > 0) {
    const handlePrice = hardwareSettings.handleNormalEur
    const doorPart =
      doorCount > 0
        ? `${doorCount * HANDLES_PER_DOOR} на ${doorCount === 1 ? 'вратата' : 'вратите'}`
        : ''
    const drawerPart =
      drawerHeights.length > 0
        ? `${drawerHeights.length * HANDLES_PER_DRAWER} на ${drawerHeights.length === 1 ? 'чекмеджето' : 'чекмеджетата'}`
        : ''
    const parts = [doorPart, drawerPart].filter(Boolean).join(' + ')
    notes.push(
      `Дръжки: ${handleCount} бр. ${HANDLE_NORMAL.name} (${parts}) · ${handlePrice} €/бр.`,
    )
    hardware.push(
      pricedLine(
        { id: HANDLE_NORMAL.id, name: HANDLE_NORMAL.name, unitPriceEur: handlePrice },
        handleCount,
        parts,
      ),
    )
  }

  return { doorCount, drawerCount: drawerHeights.length }
}

type CombinedFrontPiece = {
  width: number
  height: number
  role: 'door' | 'drawer-front'
  label: string
}

function zoneFullWidthFrontCuts(z: LaidOutZone, cabinetWidth: number): CombinedFrontPiece[] {
  const drawers = z.drawerFrontHeights.filter((h) => h > 0)
  const out: CombinedFrontPiece[] = []
  for (const h of drawers) {
    const c = drawerFrontCutSize(cabinetWidth, h)
    out.push({ ...c, role: 'drawer-front', label: `чело ${Math.round(h)} мм (${z.label})` })
  }
  if (z.doorCount === 1) {
    const door = drawers.length
      ? doorWithDrawersCutSize(cabinetWidth, z.frontHeight, drawers, 1)
      : doorCutSize(cabinetWidth, z.frontHeight, 1)
    out.push({ ...door, role: 'door', label: `врата (${z.label})` })
  }
  return out
}

function pushCombinedFirstCut(
  pieces: CombinedFrontPiece[],
  opts: { groupId: string; labels: string; quantity: number },
  panels: GeneratedPanel[],
  notes: string[],
) {
  if (pieces.length < 2) return
  const combinedHeight = combinedFrontCutHeight(pieces.map((c) => c.height))
  const width = pieces[0]?.width ?? 0
  const partsLabel = pieces.map((c) => Math.round(c.height)).join(' + ')
  const bufferNote = ` + ${COMBINED_FRONT_SAW_BUFFER * (pieces.length - 1)} мм буфер`
  const qtyNote = opts.quantity > 1 ? ` ×${opts.quantity}` : ''
  notes.push(
    `${opts.labels} от една плоча: Първо рязане ${Math.round(width)} × ${Math.round(combinedHeight)} мм${qtyNote} (${partsLabel}${bufferNote}).`,
  )
  notes.push(`След кантиране се разрязва на ${pieces.map((p) => p.label).join(', ')}.`)
  panels.push({
    role: pieces.some((p) => p.role === 'door') ? 'door' : 'drawer-front',
    name: `🔴 Чела (комбинирано) (${opts.labels})`,
    width,
    height: combinedHeight,
    quantity: opts.quantity,
    canRotate: false,
    edges: edges({ top: true, bottom: true, left: true, right: true }),
    note: `ПЪРВО РЯЗАНЕ от една плоча за продължена фладера (${opts.labels}). След кантиране се разрязва на ${pieces.length} парчета.`,
    groupId: opts.groupId,
    highlightColor: 'red',
  })
}

export function appendZonedInterior(
  input: {
    fittings: InteriorFittings
    innerW: number
    innerH: number
    sideD: number
    sideH?: number
    thickness: number
    width: number
    frontHeight: number
    overlayCovers?: OverlayFrontCovers
    coveringBottom?: boolean
    innerTop?: boolean
    shelfHole?: PanelHole
  },
  panels: GeneratedPanel[],
  hardware: HardwareItem[],
  notes: string[],
  hardwareSettings: HardwareSettings,
): {
  doorCount: number
  drawerCount: number
  shelfCount: number
  clothesRailCount: number
  fixedShelfCount: number
  partitionCount: number
} {
  const f = input.fittings
  const layout = layoutInterior({
    innerH: input.innerH,
    innerW: input.innerW,
    thickness: input.thickness,
    fixedShelves: f.fixedShelves,
    partitions: f.partitions,
    doorSpan: f.doorSpan,
    doorCount: f.doorCount,
    shelfCount: f.shelfCount,
    drawerFrontHeights: f.drawerFrontHeights,
    cutFromOneBoard: f.cutFromOneBoard,
    hasClothesRail: f.hasClothesRail,
    zones: f.zones,
    overlayCovers: input.overlayCovers,
  })
  const zoned = layout.shelves.length > 0 || layout.partitions.length > 0
  const zoneNote = zoned ? 'zoned' : undefined
  const columnInnerWs = layout.columns.map((c) => c.innerW)

  if (layout.partitions.length > 0) {
    const pos = layout.partitions.map((p) => partitionMeasureLabel(p)).join(' и ')
    appendPartitions(
      {
        count: layout.partitions.length,
        sideD: input.sideD,
        sideH: input.sideH ?? input.innerH,
        positionsNote: `Позиция: ${pos}.`,
        coveringBottom: input.coveringBottom,
        innerTop: input.innerTop,
      },
      panels,
      hardware,
      notes,
      hardwareSettings,
    )
  }

  if (layout.shelves.length > 0) {
    const pos = layout.shelves.map((s) => fixedShelfMeasureLabel(s)).join(' и ')
    appendFixedShelves(
      {
        count: layout.shelves.length,
        innerW: input.innerW,
        sideD: input.sideD,
        thickness: input.thickness,
        positionsNote: `Позиция: ${pos}.`,
        columnInnerWs,
        shelfColumns: layout.shelves.map((s) => s.columnIndex ?? null),
        hole: input.shelfHole,
      },
      panels,
      hardware,
      notes,
      hardwareSettings,
    )
  }

  for (const z of layout.zones) {
    const label = zoned ? z.label : undefined
    appendShelves(
      {
        shelfCount: z.shelfCount,
        innerW: z.innerW > 0 ? z.innerW : input.innerW,
        innerH: z.innerH,
        sideD: input.sideD,
        thickness: input.thickness,
        zoneLabel: label,
        hole: input.shelfHole,
      },
      panels,
      hardware,
      notes,
      hardwareSettings,
    )
    if (z.hasClothesRail) {
      appendClothesRail(
        {
          width: input.width,
          thickness: input.thickness,
          zoneLabel: label,
          innerLengthMm: z.innerW > 0 ? z.innerW : undefined,
        },
        hardware,
        notes,
        hardwareSettings,
      )
    }
  }

  let doorCount = 0
  let drawerCount = 0
  const crossGroup = new Map<string, string>()

  if (consecutiveZoneFrontRuns(layout.zones).some((r) => r.length >= 2)) {
    notes.push(
      'Съседните части имат чела/врати едно след друго: фуга 3 мм между тях, без застъпване върху рафта.',
    )
  }

  if (f.cutFromOneBoard) {
    for (const run of consecutiveZoneFrontRuns(layout.zones)) {
      if (!canCombineZoneFrontRun(run)) continue
      const kind = zoneFrontStackKind(run[0])
      const groupId = `zones-${run.map((z) => z.id).join('-')}`
      const topFirst = [...run].reverse()
      const labels = topFirst.map((z) => z.label).join(' + ')
      if (kind === 'full') {
        pushCombinedFirstCut(
          topFirst.flatMap((z) => zoneFullWidthFrontCuts(z, z.frontWidth > 0 ? z.frontWidth : input.width)),
          { groupId, labels, quantity: 1 },
          panels,
          notes,
        )
      } else if (kind === 'half') {
        const pieces: CombinedFrontPiece[] = topFirst.map((z) => {
          const w = z.frontWidth > 0 ? z.frontWidth : input.width
          const c = doorCutSize(w, z.frontHeight, 2)
          return { ...c, role: 'door', label: `врата (${z.label})` }
        })
        pushCombinedFirstCut(pieces, { groupId, labels, quantity: 2 }, panels, notes)
      }
      for (const z of run) crossGroup.set(z.id, groupId)
    }
  }

  if (layout.fullDoorCount > 0 || layout.fullDrawerFrontHeights.length > 0) {
    const r = appendDoorsAndDrawers(
      {
        width: input.width,
        frontHeight: input.frontHeight,
        thickness: input.thickness,
        doorCount: layout.fullDoorCount,
        drawerFrontHeights: layout.fullDrawerFrontHeights,
        cutFromOneBoard: f.cutFromOneBoard,
        includeHandles: f.includeHandles,
        slideKind: f.slideKind,
        slideLength: f.slideLength,
        zoneLabel: zoned ? 'Цял шкаф' : undefined,
        groupKey: 'full-fronts',
      },
      panels,
      hardware,
      notes,
      hardwareSettings,
    )
    doorCount += r.doorCount
    drawerCount += r.drawerCount
  }

  for (const z of layout.zones) {
    if (z.doorCount === 0 && z.drawerFrontHeights.length === 0) continue
    const r = appendDoorsAndDrawers(
      {
        width: z.frontWidth > 0 ? z.frontWidth : input.width,
        frontHeight: z.frontHeight,
        thickness: input.thickness,
        doorCount: z.doorCount,
        drawerFrontHeights: z.drawerFrontHeights,
        cutFromOneBoard: crossGroup.has(z.id) ? false : z.cutFromOneBoard,
        includeHandles: f.includeHandles,
        slideKind: f.slideKind,
        slideLength: f.slideLength,
        zoneLabel: zoned ? z.label : undefined,
        groupKey: zoned ? `zone-${z.id}` : zoneNote,
        externalCombined: crossGroup.has(z.id) ? { groupId: crossGroup.get(z.id)! } : undefined,
      },
      panels,
      hardware,
      notes,
      hardwareSettings,
    )
    doorCount += r.doorCount
    drawerCount += r.drawerCount
  }

  const counts = layoutCounts(layout)
  return {
    doorCount,
    drawerCount,
    shelfCount: counts.shelfCount,
    clothesRailCount: counts.clothesRailCount,
    fixedShelfCount: counts.fixedShelves,
    partitionCount: counts.partitions,
  }
}

/** One hanging fascia per column: innerW × railWidth, thickness as depth, 3 mm setback. */
export function appendHangingFascias(
  input: {
    columns: { innerW: number }[]
    railWidth: number
    fallbackInnerW: number
    hardwareSettings: HardwareSettings
  },
  panels: GeneratedPanel[],
  hardware: HardwareItem[],
  notes: string[],
): { screws: number; bayCount: number } {
  const bayCount = Math.max(1, input.columns.length)
  const R = input.railWidth
  const byWidth = new Map<number, number>()
  for (const col of input.columns) {
    const w = Math.round(col.innerW > 0 ? col.innerW : input.fallbackInnerW)
    byWidth.set(w, (byWidth.get(w) ?? 0) + 1)
  }
  for (const [w, qty] of byWidth) {
    panels.push({
      role: 'rail',
      name: bayCount > 1 ? 'Бленда надолу (част)' : 'Бленда надолу',
      width: w,
      height: R,
      quantity: qty,
      canRotate: false,
      edges: edges({ bottom: true }),
      note:
        bayCount > 1
          ? `Кант: долната дълга страна. Виси надолу ${R} мм, ${FASCIA_SETBACK_MM} мм навътре от предния край. Във всяка колона.`
          : `Кант: долната дълга страна. Виси надолу ${R} мм, ${FASCIA_SETBACK_MM} мм навътре от предния край. За шкаф под мивка.`,
    })
  }
  const screws = confirmatCount(R) * 2 * bayCount
  hardware.push(
    fastenerLine(
      { ...SCREW_5X60, packPriceEur: input.hardwareSettings.screw5x60_500PackEur },
      screws,
      bayCount > 1 ? `Бленда надолу · ${bayCount} колони` : 'Бленда надолу',
    ),
  )
  notes.push(
    bayCount > 1
      ? `Бленда надолу във всяка колона: ${R} мм височина × дебелина на плоскостта, ${FASCIA_SETBACK_MM} мм навътре от предния край. Хваща се с 5×60 през страниците.`
      : `Бленда надолу вместо плот: ${R} мм от горе надолу × дебелина на плоскостта, ${FASCIA_SETBACK_MM} мм навътре от предния край. Хваща се с 5×60 през страниците.`,
  )
  return { screws, bayCount }
}

function countByHeight(heights: number[]): [number, number][] {
  const counts = new Map<number, number>()
  for (const h of heights) counts.set(h, (counts.get(h) ?? 0) + 1)
  return [...counts.entries()]
}
