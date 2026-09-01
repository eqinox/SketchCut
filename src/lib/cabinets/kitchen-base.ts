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
  doorWithDrawerCutSize,
  parseDoorCount,
  drawerBoxRails,
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
  drawerFrontHeight: 0,
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
    drawerFrontHeight: typeof raw.drawerFrontHeight === 'number' && raw.drawerFrontHeight >= 0 ? raw.drawerFrontHeight : 0,
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
  const hardwareSettings = (settings as HardwareSettings | undefined) ?? DEFAULT_HARDWARE_SETTINGS
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

  if (p.doorCount === 1 || p.doorCount === 2) {
    const hasDrawer = p.drawerFrontHeight > 0
    const door = hasDrawer 
      ? doorWithDrawerCutSize(p.width, p.height, p.drawerFrontHeight, p.doorCount)
      : doorCutSize(p.width, p.height, p.doorCount)
    const doorWord = p.doorCount === 1 ? 'една врата' : 'две врати'
    const totalHinges = p.doorCount * HINGES_PER_SMALL_DOOR
    const hinge4x16 = totalHinges * SCREWS_4X16_PER_HINGE
    const hinge4x20 = totalHinges * SCREWS_4X20_PER_HINGE
    const hingePrice = hardwareSettings.useNormalHinge ? hardwareSettings.hingeNormalEur : hardwareSettings.hingeSoftCloseEur
    const hingeName = hardwareSettings.useNormalHinge ? 'Панта нормално прибиране' : 'Панта плавно прибиране'
    
    let combinedGroupId: string | undefined
    
    if (hasDrawer) {
      const drawerFront = drawerFrontCutSize(p.width, p.drawerFrontHeight)
      
      if (p.cutFromOneBoard) {
        // Combined piece: drawer + door + 6mm buffer
        const combinedHeight = drawerFront.height + door.height + 6
        combinedGroupId = `combined-${Date.now()}`
        
        notes.push(
          `Чекмедже + врата от една плоча: Първо рязане ${Math.round(drawerFront.width)} × ${Math.round(combinedHeight)} мм (${Math.round(drawerFront.height)} + ${Math.round(door.height)} + 6 мм буфер).`,
        )
        notes.push(
          `След кантиране се разрязва на чело ${Math.round(drawerFront.height)} мм и врата ${Math.round(door.height)} мм.`,
        )
        
        // Add the combined panel that needs to be cut first
        panels.push({
          role: 'drawer-front',
          name: '🔴 Чело+Врата (комбинирано)',
          width: drawerFront.width,
          height: combinedHeight,
          quantity: 1, // One combined piece (contains both drawer and one door)
          canRotate: false,
          edges: edges({ top: true, bottom: true, left: true, right: true }),
          note: `ПЪРВО РЯЗАНЕ от една плоча за продължена фладера. След кантиране се разрязва на 2 парчета.`,
          groupId: combinedGroupId,
          highlightColor: 'red',
        })
        
        // Add the individual pieces with notes that they come from the combined piece
        // These are for reference only and should NOT be included in cutting
        panels.push({
          role: 'drawer-front',
          name: '  ↳ Чело (след разрязване)',
          width: drawerFront.width,
          height: drawerFront.height,
          quantity: 1,
          canRotate: false,
          edges: edges({}), // Already edged as part of combined piece
          note: `⚠️ НЕ СЕ РЕЖЕ ОТДЕЛНО - произлиза от комбинираното парче след разрязване.`,
          groupId: combinedGroupId,
          excludeFromCutting: true,
          highlightColor: 'red',
        })
      } else {
        notes.push(
          `Чело на чекмедже: рязане ${Math.round(drawerFront.width)} × ${Math.round(drawerFront.height)} мм (кант 2 мм от 4 страни).`,
        )
        panels.push({
          role: 'drawer-front',
          name: 'Чело на чекмедже',
          width: drawerFront.width,
          height: drawerFront.height,
          quantity: 1,
          canRotate: false,
          edges: edges({ top: true, bottom: true, left: true, right: true }),
          note: `Кант 2 мм от 4 страни. Размерът е за рязане (без канта).`,
        })
      }

      const slideQty = SLIDES_PER_DRAWER
      const perSlide = screws35x16PerSlide(p.slideKind)
      const slideScrews = slideQty * perSlide
      const slidePrice = slideUnitPriceEur(p.slideKind, p.slideLength, hardwareSettings)
      const slideScrewNote = isSoftCloseSlide(p.slideKind)
        ? `по ${SCREWS_35X16_PER_SLIDE} на водач + ${SCREWS_35X16_PER_SLIDE_WING} за перките`
        : `по ${SCREWS_35X16_PER_SLIDE} на водач`
      notes.push(
        `Водачи: ${slideQty} бр. ${slideName(p.slideKind, p.slideLength)} (по ${SLIDES_PER_DRAWER} на чекмедже) · винтчета 3.5×16: ${slideScrews} бр. (${slideScrewNote}).`,
      )

      const box = drawerBoxRails(
        p.width,
        p.thickness,
        p.drawerFrontHeight,
        p.slideLength,
        isSoftCloseSlide(p.slideKind),
      )
      if (box) {
        const gapTotal = box.sideGapEach * 2
        notes.push(
          `Чекмедже: вътрешна ширина ${Math.round(box.innerCarcassW)} мм − ${gapTotal} мм луфт (${box.sideGapEach} мм от страна) = ${Math.round(box.drawerOuterW)} мм общо.`,
        )
        notes.push(
          `Царги: вътрешни ${Math.round(box.inner.width)} × ${Math.round(box.inner.height)} мм (2 бр.), външни ${Math.round(box.outer.width)} × ${Math.round(box.outer.height)} мм (2 бр.${isSoftCloseSlide(p.slideKind) ? `, водачът минус ${SOFT_SLIDE_OUTER_RAIL_SHORTEN} мм, вътрешните с ${SOFT_INNER_RAIL_HEIGHT_DROP} мм по-ниски` : ', колкото водача'}). Височината на външните е с ${DRAWER_RAIL_BELOW_FRONT} мм по-малка от челото.`,
        )
        panels.push({
          role: 'drawer-back',
          name: 'Царга вътрешна',
          width: box.inner.width,
          height: box.inner.height,
          quantity: 2,
          canRotate: false,
          edges: edges({ top: true }),
          note: isSoftCloseSlide(p.slideKind)
            ? `Предна и задна на кутията. ${Math.round(box.drawerOuterW)} − 2×${p.thickness} = ${Math.round(box.inner.width)} мм. С ${SOFT_INNER_RAIL_HEIGHT_DROP} мм по-ниски от външните заради канала за гърба. Кант: горната дълга страна.`
            : `Предна и задна на кутията. ${Math.round(box.drawerOuterW)} − 2×${p.thickness} = ${Math.round(box.inner.width)} мм. Кант: горната дълга страна.`,
        })
        panels.push({
          role: 'drawer-side',
          name: 'Царга външна',
          width: box.outer.width,
          height: box.outer.height,
          quantity: 2,
          canRotate: false,
          edges: edges({ top: true }),
          note: isSoftCloseSlide(p.slideKind)
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
      
      notes.push(
        `${p.doorCount === 1 ? 'Една врата' : 'Две врати'}: рязане ${Math.round(door.width)} × ${Math.round(door.height)} мм (фуга 5 мм отгоре, 3 мм между чело и врата, кант 2 мм от 4 страни).`,
      )
    } else {
      notes.push(
        `${p.doorCount === 1 ? 'Една врата' : 'Две врати'}: рязане ${Math.round(door.width)} × ${Math.round(door.height)} мм (фуга 5 мм само отгоре, кант 2 мм от 4 страни).`,
      )
    }
    
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
    
    panels.push({
      role: 'door',
      name: hasDrawer && p.cutFromOneBoard ? '  ↳ Врата (след разрязване)' : (p.doorCount === 1 ? 'Врата' : 'Врата'),
      width: door.width,
      height: door.height,
      quantity: p.doorCount,
      canRotate: false,
      edges: hasDrawer && p.cutFromOneBoard ? edges({}) : edges({ top: true, bottom: true, left: true, right: true }),
      note: hasDrawer && p.cutFromOneBoard 
        ? `⚠️ НЕ СЕ РЕЖЕ ОТДЕЛНО - произлиза от комбинираното парче след разрязване.`
        : `Кант 2 мм от 4 страни. ${doorWord}. Размерът е за рязане (без канта).`,
      groupId: combinedGroupId,
      excludeFromCutting: hasDrawer && p.cutFromOneBoard,
      highlightColor: hasDrawer && p.cutFromOneBoard ? 'red' : undefined,
    })
  }

  return {
    joinery: KITCHEN_BASE_JOINERY,
    labor: emptyLabor(),
    hardware,
    notes,
    panels,
  }
}

export const kitchenBaseType: CabinetTypeDefinition = {
  id: KITCHEN_BASE_TYPE_ID,
  name: 'Долен кухненски шкаф',
  category: 'kitchen-base',
  description:
    'Корпус на крачета. По избор фазер на гърба и една или две врати.',
  defaultParams: { ...DEFAULT_KITCHEN_BASE_PARAMS },
  generate: generateKitchenBase,
}
