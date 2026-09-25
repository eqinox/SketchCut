import React, { type ReactNode } from 'react'
import { exactMm, formatMm } from '@/lib/utils'
import { KITCHEN_BASE_JOINERY, KITCHEN_WALL_JOINERY, measureCarcass } from '@/lib/cabinets/joinery'
import {
  parseKitchenBaseParams,
  parseKitchenWallParams,
  parseNightstandParams,
  parseSectionParams,
  parseWardrobeParams,
  measureNightstand,
  DEFAULT_SHELF_FRONT_INSET,
  DEFAULT_HARDBOARD_COLOR,
  FASCIA_SETBACK_MM,
  kitchenClearInnerH,
  wallBottomHole,
  wallShelfHole,
  drawerBoxRails,
  isSoftCloseSlide,
  DOOR_GAP_X,
  layoutInterior,
  layoutCounts,
  allDrawerFrontHeights,
  zoneFrontBox,
  stackFronts,
  shelvesForColumn,
  layoutSlidingDoors,
  SLIDING_BOTTOM_TRACK_MM,
  SLIDING_DRAWER_FROM_BOTTOM_MM,
  type KitchenBaseParams,
  type KitchenWallParams,
  type NightstandParams,
  type DrawerBoxRails,
  type InteriorLayout,
  type PanelHole,
} from '@/lib/cabinets'
import {
  BETWEEN_FACES,
  Board,
  BOX_FACES,
  DimLine,
  DimText,
  DRAW_STROKE,
  DRAW_DIM,
  SIDE_LEFT_BODY,
  SIDE_LEFT_TOP,
  SIDE_RIGHT,
  SketchSvg,
  createDrawCam,
} from '@/lib/cabinets/draw-3d'
import { cn } from '@/lib/utils'

interface CabinetPreviewProps {
  typeId?: string
  params: Record<string, unknown>
  className?: string
  /** Extension lines and arrows. Off by default — sizes sit next to the panels. */
  showDimLines?: boolean
  /** Inner openings between partitions and shelves — count depends on the layout. */
  showOpeningDims?: boolean
  /** Draw doors, drawer fronts and drawer faces on the 3D view. */
  showFronts?: boolean
}

const SLIDE_STROKE_COLOR = DRAW_STROKE
const CLOTHES_RAIL_COLOR = '#94a3b8'
const SHELF_PIN_COLOR = '#6b7280'

function shelfPinMark(vbH: number) {
  return Math.max(8, Math.min(32, vbH * (5 / 460)))
}
const SLIDE_PROFILE_H = 18
const SLIDE_FRONT_INSET = 28
const SLIDE_STROKE = 10
const FRONT_FILL = '#c4a06a'

function mm(n: number) {
  return formatMm(n)
}

function scaledDimFont(base: number, scale: number) {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1
  return Math.max(8, base * s)
}

function drawerSlideStacks(
  layout: InteriorLayout,
  opts: { innerFloorY: number; carcassTopY: number; carcassBotY: number; thickness: number },
): {
  id: string
  heights: number[]
  box: { y: number; h: number }
  doorCount: 0 | 1 | 2
}[] {
  const sources: {
    id: string
    heights: number[]
    box: { y: number; h: number }
    doorCount: 0 | 1 | 2
  }[] = []
  if (layout.fullDrawerFrontHeights.length > 0) {
    sources.push({
      id: 'full',
      heights: layout.fullDrawerFrontHeights,
      box: { y: opts.carcassTopY, h: Math.max(1, opts.carcassBotY - opts.carcassTopY) },
      doorCount: layout.fullDoorCount,
    })
  }
  for (const zone of layout.zones) {
    if (zone.drawerFrontHeights.length === 0) continue
    sources.push({
      id: zone.id,
      heights: zone.drawerFrontHeights,
      box: zoneFrontBox(zone, opts),
      doorCount: zone.doorCount,
    })
  }
  return sources
}

function drawerFrontTopY(
  box: { y: number; h: number },
  doorCount: 0 | 1 | 2,
  heights: number[],
  index: number,
): number {
  const row = stackFronts({
    frontHeight: box.h,
    doorCount,
    drawerFrontHeights: heights,
  }).find((s) => s.kind === 'drawer' && s.index === index)
  return box.y + (row?.yFromFrontTop ?? 0)
}

function drawerSlideWorldX(layout: InteriorLayout, sourceId: string, thickness: number): number {
  if (sourceId === 'full') return thickness
  const zone = layout.zones.find((z) => z.id === sourceId)
  if (!zone) return thickness
  return thickness + zone.x0
}

function columnsWithDrawers(layout: InteriorLayout): Set<number> {
  const out = new Set<number>()
  if (layout.fullDrawerFrontHeights.length > 0) {
    layout.columns.forEach((_, i) => out.add(i))
  }
  for (const z of layout.zones) {
    if (z.drawerFrontHeights.length > 0) out.add(z.colIndex ?? 0)
  }
  return out
}

function crowdedDimColumns(layout: InteriorLayout): Set<number> {
  const out = columnsWithDrawers(layout)
  for (const s of layout.shelves) {
    if (s.columnIndex != null) out.add(s.columnIndex)
  }
  return out
}

function DrawerSlidesOnCabinet({
  layout,
  T,
  cam,
  z0,
  partitionFrontZ,
  width,
  thickness,
  slideLength,
  slideKind,
  innerFloorY,
  carcassTopY,
  carcassBotY,
  fontScale = 1,
}: {
  layout: InteriorLayout
  T: number
  cam: ReturnType<typeof createDrawCam>
  z0: number
  /** Front of a set-back inner partition. Zone drawers on that wall start here, not at the outer side. */
  partitionFrontZ?: number
  width: number
  thickness: number
  slideLength: number
  slideKind: KitchenBaseParams['slideKind']
  innerFloorY: number
  carcassTopY: number
  carcassBotY: number
  fontScale?: number
}) {
  return (
    <>
      {drawerSlideStacks(layout, {
        innerFloorY,
        carcassTopY,
        carcassBotY,
        thickness: T,
      }).flatMap((src) =>
        src.heights.map((frontH, i) => {
          const rails = drawerBoxRails(
            width,
            thickness,
            frontH,
            slideLength,
            isSoftCloseSlide(slideKind),
          )
          if (!rails) return null
          const x = drawerSlideWorldX(layout, src.id, T)
          const zone = src.id === 'full' ? undefined : layout.zones.find((z) => z.id === src.id)
          const startZ =
            partitionFrontZ != null && zone != null && zone.x0 > 0.5
              ? partitionFrontZ
              : z0
          const z1 = startZ + slideLength
          const yBot = drawerFrontTopY(src.box, src.doorCount, src.heights, i) + rails.outer.height
          const yTopS = yBot - SLIDE_PROFILE_H
          const a0 = cam.proj(x, yTopS, startZ)
          const a1 = cam.proj(x, yTopS, z1)
          const b0 = cam.proj(x, yBot, startZ)
          const b1 = cam.proj(x, yBot, z1)
          const mid = cam.proj(x, yTopS, startZ + slideLength / 2)
          const slideFont = scaledDimFont(Math.max(32, Math.min(slideLength * 0.1, 56)), fontScale)
          return (
            <g key={`slide-${src.id}-${i}`}>
              <g stroke={SLIDE_STROKE_COLOR} fill="none" strokeWidth={SLIDE_STROKE} strokeLinecap="butt">
                <line x1={a0.x} y1={a0.y} x2={a1.x} y2={a1.y} />
                <line x1={b0.x} y1={b0.y} x2={b1.x} y2={b1.y} />
              </g>
              {i === 0 && (
                <DimText
                  x={mid.x + 18}
                  y={mid.y - 8}
                  label={mm(slideLength)}
                  fontSize={slideFont}
                  fill={SLIDE_STROKE_COLOR}
                />
              )}
            </g>
          )
        }),
      )}
    </>
  )
}

/** Single 3D front view with depth extending to the right. */
export function CabinetPreview({
  typeId = 'kitchen-base',
  params,
  className,
  showDimLines = false,
  showOpeningDims = false,
  showFronts = false,
}: CabinetPreviewProps) {
  if (typeId === 'kitchen-wall') {
    return (
      <KitchenWallPreview
        params={params}
        className={className}
        showDimLines={showDimLines}
        showOpeningDims={showOpeningDims}
        showFronts={showFronts}
      />
    )
  }
  if (typeId === 'nightstand' || typeId === 'section' || typeId === 'wardrobe') {
    return (
      <PlinthBoxPreview
        typeId={typeId}
        params={params}
        className={className}
        showDimLines={showDimLines}
        showOpeningDims={showOpeningDims}
        showFronts={showFronts}
      />
    )
  }

  const p = parseKitchenBaseParams(params)
  const m = measureCarcass(
    { width: p.width, height: p.height, depth: p.depth, thickness: p.thickness },
    KITCHEN_BASE_JOINERY,
  )
  const { colors } = p
  const layout = layoutInterior({
    innerH: kitchenClearInnerH(p.height, p.thickness, p.topStyle),
    innerW: m.innerW,
    thickness: p.thickness,
    fixedShelves: p.fixedShelves,
    partitions: p.partitions,
    doorSpan: p.doorSpan,
    doorCount: p.doorCount,
    shelfCount: p.shelfCount,
    movableShelves: p.movableShelves,
    drawerFrontHeights: p.drawerFrontHeights,
    cutFromOneBoard: p.cutFromOneBoard,
    hasClothesRail: p.hasClothesRail,
    clothesRails: p.clothesRails,
    zones: p.zones,
    overlayCovers: p.topStyle === 'rails' ? undefined : { top: false, bottom: true },
  })
  const drawerViews = uniqueDrawerViews({ ...p, drawerFrontHeights: allDrawerFrontHeights(layout) })

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ViewCard title="3D Изглед отпред">
        <ZoomableView>
          <Front3DView
            p={p}
            m={m}
            layout={layout}
            showDimLines={showDimLines}
            showOpeningDims={showOpeningDims}
            showFronts={showFronts}
          />
        </ZoomableView>
      </ViewCard>
      {drawerViews.map((view) => (
        <ViewCard
          key={view.frontHeight}
          title={
            drawerViews.length === 1
              ? view.count > 1
                ? `Чекмедже ×${view.count}`
                : 'Чекмедже'
              : view.count > 1
                ? `Чекмедже ${view.frontHeight} мм ×${view.count}`
                : `Чекмедже ${view.frontHeight} мм`
          }
        >
          <ZoomableView>
            <Drawer3DView p={p} box={view.box} />
          </ZoomableView>
        </ViewCard>
      ))}
      <p className="text-center text-[11px] text-[var(--color-muted-foreground)]">
        <span className="mr-3" style={{ color: colors.bottom }}>■ Дъно</span>
        <span className="mr-3" style={{ color: colors.side }}>■ Страници</span>
        {p.topStyle !== 'none' && (
          <span className="mr-3" style={{ color: colors.rail }}>
            {p.topStyle === 'fascia' ? '■ Бленда надолу' : '■ Бленди'}
          </span>
        )}
        {(layoutCounts(layout).shelfCount > 0 || layout.shelves.length > 0) && (
          <span className="mr-3" style={{ color: colors.shelf }}>■ Рафтове</span>
        )}
        {p.hasBack && (
          <span className="mr-3" style={{ color: DEFAULT_HARDBOARD_COLOR }}>■ Фазер</span>
        )}
        {layoutCounts(layout).clothesRailCount > 0 && (
          <span className="mr-3" style={{ color: CLOTHES_RAIL_COLOR }}>■ Лост</span>
        )}
        {drawerViews.length > 0 && (
          <span className="mr-3" style={{ color: SLIDE_STROKE_COLOR }}>■ Водачи</span>
        )}
        <span style={{ color: colors.leg }}>■ Крачета</span>
        {showFronts && (layoutCounts(layout).doorCount > 0 || layoutCounts(layout).drawerCount > 0) && (
          <span className="mr-3" style={{ color: FRONT_FILL }}>
            {' '}■ Врати и чела
          </span>
        )}
        {!showFronts && layoutCounts(layout).doorCount > 0 && (
          <>
            {' · '}
            {layoutCounts(layout).doorCount === 1 ? '1 врата' : `${layoutCounts(layout).doorCount} врати`} (включи ги с отметката)
          </>
        )}
        {!showFronts && layoutCounts(layout).drawerCount > 0 && (
          <>
            {' · '}
            {layoutCounts(layout).drawerCount === 1
              ? '1 чекмедже'
              : `${layoutCounts(layout).drawerCount} чекмеджета`}{' '}
            (челата с отметката)
          </>
        )}
        {' · '}страниците сядат върху дъното, винтове отдолу
      </p>
    </div>
  )
}

function uniqueDrawerViews(p: {
  width: number
  thickness: number
  slideKind: KitchenBaseParams['slideKind']
  slideLength: number
  drawerFrontHeights: number[]
}): { frontHeight: number; box: DrawerBoxRails; count: number }[] {
  const soft = isSoftCloseSlide(p.slideKind)
  const byHeight = new Map<number, { box: DrawerBoxRails; count: number }>()
  for (const frontHeight of p.drawerFrontHeights) {
    const existing = byHeight.get(frontHeight)
    if (existing) {
      existing.count += 1
      continue
    }
    const box = drawerBoxRails(p.width, p.thickness, frontHeight, p.slideLength, soft)
    if (box) byHeight.set(frontHeight, { box, count: 1 })
  }
  return [...byHeight.entries()].map(([frontHeight, v]) => ({ frontHeight, ...v }))
}

function shelfMeasureEndY(s: { toFace?: 'top' | 'bottom'; yTop: number; yBottom: number; endY: number }) {
  return s.toFace === 'top' ? s.yTop : s.toFace === 'bottom' ? s.yBottom : s.endY
}

function heightRangesOverlap(a0: number, a1: number, b0: number, b1: number, clearMm = 100): boolean {
  const A0 = Math.min(a0, a1)
  const A1 = Math.max(a0, a1)
  const B0 = Math.min(b0, b1)
  const B1 = Math.max(b0, b1)
  return Math.min(A1, B1) - Math.max(A0, B0) >= -clearMm
}

type HeightDimPlace = {
  id: string
  col: number
  y0: number
  y1: number
  offsetMm: number
  originZ: number
  endZ: number
  inside?: boolean
}

function heightDimSpecs(
  layout: InteriorLayout,
  opts: { originZ: number; shelfZ: number; railZ: number; shiftRightColumns?: Set<number> },
): HeightDimPlace[] {
  const dims: HeightDimPlace[] = []
  layout.shelves.forEach((s, i) => {
    dims.push({
      id: `fixed-${i}`,
      col: s.columnIndex ?? 0,
      y0: s.startY,
      y1: shelfMeasureEndY(s),
      offsetMm: s.offsetMm,
      originZ: opts.originZ,
      endZ: opts.shelfZ,
      inside: s.columnIndex != null && opts.shiftRightColumns?.has(s.columnIndex),
    })
  })
  for (const z of layout.zones) {
    const col = z.colIndex ?? 0
    z.movable.forEach((s, i) => {
      if (s.from === 'middle') return
      dims.push({
        id: `mov-${z.id}-${i}`,
        col,
        y0: z.y0 + s.startY,
        y1: z.y0 + shelfMeasureEndY(s),
        offsetMm: s.offsetMm,
        originZ: opts.originZ,
        endZ: opts.shelfZ,
      })
    })
    z.rails.forEach((r, i) => {
      if (r.from === 'middle') return
      dims.push({
        id: `rail-${z.id}-${i}`,
        col,
        y0: r.from === 'top' ? z.y1 : z.y0,
        y1: r.yTop,
        offsetMm: r.offsetMm,
        originZ: opts.originZ,
        endZ: opts.railZ,
      })
    })
  }
  return dims
}

/** Same column + overlapping (or touching) height spans → different X, so numbers never sit on each other. */
function placeHeightDimX(
  dims: HeightDimPlace[],
  columns: InteriorLayout['columns'],
  worldX0: number,
  fontSize: number,
): Map<string, number> {
  const stagger = Math.max(36, fontSize * 0.5)
  const inset = Math.max(28, fontSize * 0.32)
  const out = new Map<string, number>()
  const byCol = new Map<number, HeightDimPlace[]>()
  for (const d of dims) {
    const arr = byCol.get(d.col) ?? []
    arr.push(d)
    byCol.set(d.col, arr)
  }
  for (const [colIndex, list] of byCol) {
    const col = columns[colIndex]
    const lanes: HeightDimPlace[][] = []
    for (const d of list) {
      if (d.inside && col && col.innerW > 1) {
        const margin = Math.max(inset * 1.6, fontSize * 0.45)
        const fromLeft = Math.min(Math.max(col.innerW * 0.58, margin), col.innerW - margin)
        out.set(d.id, worldX0 + col.x0 + fromLeft - inset)
        continue
      }
      let lane = 0
      for (; lane < lanes.length; lane++) {
        if (!lanes[lane]!.some((o) => heightRangesOverlap(d.y0, d.y1, o.y0, o.y1))) break
      }
      if (!lanes[lane]) lanes[lane] = []
      lanes[lane]!.push(d)
      out.set(d.id, worldX0 + (col?.x0 ?? 0) + lane * stagger)
    }
  }
  return out
}

function InteriorHeightDimLines({
  layout,
  innerFloorY,
  T,
  fontSize,
  cam,
  originZ = 0,
  shelfZ = 0,
  railZ = 0,
}: {
  layout: InteriorLayout
  innerFloorY: number
  T: number
  fontSize: number
  cam: ReturnType<typeof createDrawCam>
  originZ?: number
  shelfZ?: number
  railZ?: number
}) {
  const worldX0 = T + Math.max(28, fontSize * 0.32)
  const specs = heightDimSpecs(layout, {
    originZ,
    shelfZ,
    railZ,
    shiftRightColumns: columnsWithDrawers(layout),
  })
  const xs = placeHeightDimX(specs, layout.columns, worldX0, fontSize)
  const tick = Math.max(12, fontSize * 0.22)
  return (
    <>
      {specs.map((d) => {
        const worldX = xs.get(d.id) ?? worldX0
        const a = cam.proj(worldX, innerFloorY - d.y0, d.originZ)
        const b = cam.proj(worldX, innerFloorY - d.y1, d.endZ)
        return (
          <g key={d.id} stroke={DRAW_DIM} fill={DRAW_DIM}>
            <line x1={a.x - tick} y1={a.y} x2={a.x + tick} y2={a.y} strokeWidth={2} />
            <line x1={b.x - tick} y1={b.y} x2={b.x + tick} y2={b.y} strokeWidth={2} />
            <DimLine x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            <DimText
              x={(a.x + b.x) / 2}
              y={(a.y + b.y) / 2}
              label={mm(d.offsetMm)}
              fontSize={fontSize}
              rotate={-90}
              fill={DRAW_DIM}
            />
          </g>
        )
      })}
    </>
  )
}

function spansOverlap(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
  frac = 0.8,
): boolean {
  const opening = a1 - a0
  if (opening <= 0) return true
  return Math.min(a1, b1) - Math.max(a0, b0) >= opening * frac
}

/** Clear openings that the user did not already measure (the leftover on the other side). */
function leftoverPartitionSpans(
  partitions: InteriorLayout['partitions'],
  columns: InteriorLayout['columns'],
): { startX: number; endX: number; offsetMm: number }[] {
  if (partitions.length === 0) return []
  const measured = partitions
    .filter((p) => p.from !== 'middle')
    .map((p) => {
      const a = Math.min(p.startX, p.endX)
      const b = Math.max(p.startX, p.endX)
      return { a, b }
    })
  return columns
    .filter((col) => col.innerW > 0.5 && !measured.some((m) => spansOverlap(col.x0, col.x1, m.a, m.b)))
    .map((col) => ({ startX: col.x0, endX: col.x1, offsetMm: col.innerW }))
}

/** Openings not already labeled by a measure line or leftover. */
function openingWidthSpans(
  partitions: InteriorLayout['partitions'],
  columns: InteriorLayout['columns'],
): { startX: number; endX: number; offsetMm: number }[] {
  if (columns.length <= 1) return []
  const drawn = partitions
    .filter((p) => p.from !== 'middle')
    .map((p) => ({ a: Math.min(p.startX, p.endX), b: Math.max(p.startX, p.endX) }))
  const leftover = leftoverPartitionSpans(partitions, columns)
  const labeled = [
    ...drawn,
    ...leftover.map((s) => ({ a: Math.min(s.startX, s.endX), b: Math.max(s.startX, s.endX) })),
  ]
  return columns
    .filter(
      (col) => col.innerW > 0.5 && !labeled.some((m) => spansOverlap(col.x0, col.x1, m.a, m.b)),
    )
    .map((col) => ({ startX: col.x0, endX: col.x1, offsetMm: col.innerW }))
}

function sameOpeningMm(a: number, b: number) {
  return exactMm(a) === exactMm(b)
}

function columnsHaveEqualInnerW(columns: InteriorLayout['columns']): boolean {
  if (columns.length < 2) return false
  const w = columns[0]?.innerW ?? 0
  return columns.every((c) => sameOpeningMm(c.innerW, w))
}

/** When every bay is the same width, keep one leftover label and put it in a quiet bay. */
function spreadEqualOpeningSpans(
  spans: { startX: number; endX: number; offsetMm: number }[],
  columns: InteriorLayout['columns'],
  crowded: Set<number>,
): { startX: number; endX: number; offsetMm: number }[] {
  if (spans.length === 0 || !columnsHaveEqualInnerW(columns)) return spans
  const w = columns[0]?.innerW ?? 0
  const equal = spans.filter((s) => sameOpeningMm(s.offsetMm, w))
  const rest = spans.filter((s) => !sameOpeningMm(s.offsetMm, w))
  if (equal.length === 0) return spans

  const spanColumn = (s: { startX: number; endX: number }) => {
    const a = Math.min(s.startX, s.endX)
    const b = Math.max(s.startX, s.endX)
    return columns.findIndex((c) => Math.abs(c.x0 - a) < 0.5 && Math.abs(c.x1 - b) < 0.5)
  }
  const originalsCrowded = equal.some((s) => {
    const i = spanColumn(s)
    return i >= 0 && crowded.has(i)
  })

  const quiet = columns
    .map((col, i) => ({ col, i }))
    .filter(({ i }) => !crowded.has(i))
  if (quiet.length === 0) {
    return equal.length >= 2 ? [...rest, equal[0]!] : spans
  }
  if (!originalsCrowded && equal.length === 1) return spans

  const pick = quiet
    .map(({ col, i }) => ({
      col,
      i,
      dist: crowded.size === 0 ? 0 : Math.min(...[...crowded].map((c) => Math.abs(c - i))),
    }))
    .sort((a, b) => b.dist - a.dist || a.i - b.i)[0]!
  return [...rest, { startX: pick.col.x0, endX: pick.col.x1, offsetMm: pick.col.innerW }]
}

function clearSpans(length: number, occupied: { a: number; b: number }[]): { start: number; end: number }[] {
  const merged: { a: number; b: number }[] = []
  for (const band of [...occupied].sort((x, y) => x.a - y.a)) {
    if (!(band.b > band.a)) continue
    const last = merged[merged.length - 1]
    if (!last || band.a > last.b) merged.push({ a: band.a, b: band.b })
    else last.b = Math.max(last.b, band.b)
  }
  const gaps: { start: number; end: number }[] = []
  let cursor = 0
  for (const m of merged) {
    if (m.a > cursor) gaps.push({ start: cursor, end: m.a })
    cursor = Math.max(cursor, m.b)
  }
  if (cursor < length) gaps.push({ start: cursor, end: length })
  return gaps
}

function remainingHeightSpans(
  layout: InteriorLayout,
  innerH: number,
): { x0: number; x1: number; startY: number; endY: number; offsetMm: number }[] {
  if (!(innerH > 0.5)) return []
  const labeled: { col: number | null; a: number; b: number }[] = []
  for (const s of layout.shelves) {
    const a = Math.min(s.startY, shelfMeasureEndY(s))
    const b = Math.max(s.startY, shelfMeasureEndY(s))
    labeled.push({ col: s.columnIndex ?? null, a, b })
  }
  for (const z of layout.zones) {
    const col = z.colIndex ?? 0
    for (const s of z.movable) {
      if (s.from === 'middle') continue
      const start = z.y0 + s.startY
      const end = z.y0 + shelfMeasureEndY(s)
      labeled.push({ col, a: Math.min(start, end), b: Math.max(start, end) })
    }
    for (const r of z.rails) {
      if (r.from === 'middle') continue
      const origin = r.from === 'top' ? z.y1 : z.y0
      labeled.push({ col, a: Math.min(origin, r.yTop), b: Math.max(origin, r.yTop) })
    }
  }
  const covers = (colIndex: number, y0: number, y1: number) =>
    labeled.some(
      (m) => (m.col == null || m.col === colIndex) && spansOverlap(y0, y1, m.a, m.b),
    )

  const out: { x0: number; x1: number; startY: number; endY: number; offsetMm: number }[] = []
  for (let c = 0; c < layout.columns.length; c++) {
    const col = layout.columns[c]
    const occupied: { a: number; b: number }[] = []
    for (const s of shelvesForColumn(layout.shelves, c)) {
      occupied.push({ a: s.yBottom, b: s.yTop })
    }
    for (const z of layout.zones) {
      if ((z.colIndex ?? 0) !== c) continue
      for (const s of z.movable) {
        occupied.push({ a: z.y0 + s.yBottom, b: z.y0 + s.yTop })
      }
    }
    const gaps = clearSpans(innerH, occupied)
    if (gaps.length <= 1) continue
    for (const g of gaps) {
      const h = g.end - g.start
      if (h <= 0.5 || covers(c, g.start, g.end)) continue
      out.push({
        x0: col.x0,
        x1: col.x1,
        startY: g.start,
        endY: g.end,
        offsetMm: h,
      })
    }
  }
  return out
}

function RemainingHeightDimLines({
  spans,
  innerFloorY,
  innerLeft,
  fontSize,
  cam,
  originZ = 0,
}: {
  spans: { x0: number; x1: number; startY: number; endY: number; offsetMm: number }[]
  innerFloorY: number
  innerLeft: number
  fontSize: number
  cam: ReturnType<typeof createDrawCam>
  originZ?: number
}) {
  const tick = Math.max(12, fontSize * 0.18)
  const sw = Math.max(5, Math.min(8, fontSize * 0.045))
  return (
    <>
      {spans.map((s, i) => {
        const x = innerLeft + (s.x0 + s.x1) / 2
        const a = cam.proj(x, innerFloorY - s.startY, originZ)
        const b = cam.proj(x, innerFloorY - s.endY, originZ)
        return (
          <g key={`open-h-${i}`} stroke={DRAW_DIM} fill={DRAW_DIM} strokeLinecap="butt">
            <line x1={a.x - tick} y1={a.y} x2={a.x + tick} y2={a.y} strokeWidth={sw} />
            <line x1={b.x - tick} y1={b.y} x2={b.x + tick} y2={b.y} strokeWidth={sw} />
            <DimLine x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={sw} />
            <DimText
              x={(a.x + b.x) / 2}
              y={(a.y + b.y) / 2}
              label={mm(s.offsetMm)}
              fontSize={fontSize}
              rotate={-90}
              fill={DRAW_DIM}
            />
          </g>
        )
      })}
    </>
  )
}

function PartitionDimLines({
  partitions,
  leftovers = [],
  cam,
  innerLeft,
  y,
  anchorY,
  z = 0,
  zAtX,
  leftoverZ,
  fontSize,
}: {
  partitions: InteriorLayout['partitions']
  leftovers?: { startX: number; endX: number; offsetMm: number }[]
  cam: ReturnType<typeof createDrawCam>
  innerLeft: number
  y: number
  /** Inner floor — extension lines drop to the measured faces here. */
  anchorY: number
  z?: number
  /** Depth of each measured face (set-back partition vs full-depth side). */
  zAtX?: (x: number) => number
  /** Leftover opening dims stay on one plane so the line is straight. */
  leftoverZ?: number
  fontSize: number
}) {
  const tick = Math.max(14, fontSize * 0.18)
  const stagger = Math.max(48, fontSize * 0.7)
  const sw = Math.max(5, Math.min(8, fontSize * 0.045))
  const leftoverDepth = leftoverZ ?? z
  const spans = [
    ...partitions
      .filter((p) => p.from !== 'middle')
      .map((p, i) => ({ startX: p.startX, endX: p.endX, offsetMm: p.offsetMm, row: i, flat: false })),
    ...leftovers.map((p) => ({ ...p, row: 0, flat: true })),
  ]
  const depth = (x: number) => zAtX?.(x) ?? z
  return (
    <>
      {spans.map((p, i) => {
        const yy = y - p.row * stagger
        const za = depth(p.startX)
        const zb = depth(p.endX)
        const a = p.flat
          ? {
              x: cam.proj(innerLeft + p.startX, yy, za).x,
              y: cam.proj(innerLeft + p.startX, yy, leftoverDepth).y,
            }
          : cam.proj(innerLeft + p.startX, yy, za)
        const b = p.flat
          ? {
              x: cam.proj(innerLeft + p.endX, yy, zb).x,
              y: cam.proj(innerLeft + p.endX, yy, leftoverDepth).y,
            }
          : cam.proj(innerLeft + p.endX, yy, zb)
        const footA = cam.proj(innerLeft + p.startX, anchorY, za)
        const footB = cam.proj(innerLeft + p.endX, anchorY, zb)
        const midX = (a.x + b.x) / 2
        const midY = (a.y + b.y) / 2 - fontSize * 0.62
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy) || 1
        const nx = (-dy / len) * tick
        const ny = (dx / len) * tick
        return (
          <g key={`part-dim-${i}`} stroke={DRAW_DIM} fill={DRAW_DIM} strokeLinecap="butt">
            <line x1={a.x} y1={a.y} x2={footA.x} y2={footA.y} strokeWidth={sw} />
            <line x1={b.x} y1={b.y} x2={footB.x} y2={footB.y} strokeWidth={sw} />
            <line x1={a.x - nx} y1={a.y - ny} x2={a.x + nx} y2={a.y + ny} strokeWidth={sw} />
            <line x1={b.x - nx} y1={b.y - ny} x2={b.x + nx} y2={b.y + ny} strokeWidth={sw} />
            <DimLine x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={sw} />
            <DimText x={midX} y={midY} label={mm(p.offsetMm)} fontSize={fontSize} fill={DRAW_DIM} />
          </g>
        )
      })}
    </>
  )
}

function PanelHoleMark({
  x,
  y,
  z,
  w,
  d,
  hole,
  cam,
}: {
  x: number
  y: number
  z: number
  w: number
  d: number
  hole: PanelHole
  cam: ReturnType<typeof createDrawCam>
}) {
  const cx = x + w / 2
  const cz = z + d / 2
  if (hole.kind === 'round') {
    const r = hole.diameter / 2
    const pts = Array.from({ length: 28 }, (_, i) => {
      const a = (i / 28) * Math.PI * 2
      return cam.proj(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r)
    })
    return (
      <polygon
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={DRAW_STROKE}
        strokeWidth={1.6}
      />
    )
  }
  const hw = hole.width / 2
  const hd = hole.height / 2
  const corners = [
    cam.proj(cx - hw, y, cz - hd),
    cam.proj(cx + hw, y, cz - hd),
    cam.proj(cx + hw, y, cz + hd),
    cam.proj(cx - hw, y, cz + hd),
  ]
  return (
    <polygon
      points={corners.map((p) => `${p.x},${p.y}`).join(' ')}
      fill="none"
      stroke={DRAW_STROKE}
      strokeWidth={1.6}
    />
  )
}

function ShelfPins({
  x,
  yTop,
  z,
  w,
  shelfT,
  d,
  cam,
  mark,
}: {
  x: number
  yTop: number
  z: number
  w: number
  shelfT: number
  d: number
  cam: ReturnType<typeof createDrawCam>
  mark: number
}) {
  const pinH = mark * 0.85
  const pinL = mark * 1.8
  const pinD = mark * 0.85
  const hangL = Math.min(mark * 0.55, w * 0.05)
  const hangR = Math.min(Math.max(mark * 5.2, pinL * 2.2), w * 0.18)
  const leftX = x + hangL
  const rightX = Math.max(leftX + pinL + pinL * 1.4, x + w - pinL - hangR)
  const y = yTop + shelfT
  const zFront = z + Math.min(6, d * 0.02)
  return (
    <>
      <Board
        x={leftX}
        y={y}
        z={zFront}
        w={pinL}
        h={pinH}
        d={pinD}
        color={SHELF_PIN_COLOR}
        cam={cam}
        faces={{ front: true, top: true, right: true }}
        strokeWidth={1.6}
      />
      <Board
        x={rightX}
        y={y}
        z={zFront}
        w={pinL}
        h={pinH}
        d={pinD}
        color={SHELF_PIN_COLOR}
        cam={cam}
        faces={{ front: true, top: true, left: true }}
        strokeWidth={1.6}
      />
    </>
  )
}

function ColumnFill({
  layout,
  colIndex,
  T,
  innerFloorY,
  cam,
  shelfColor,
  fixedZ = 0,
  fixedD,
  adjZ,
  adjD,
  clothesZ,
  shelfHole,
  pinMark = 10,
}: {
  layout: InteriorLayout
  colIndex: number
  T: number
  innerFloorY: number
  cam: ReturnType<typeof createDrawCam>
  shelfColor: string
  fixedZ?: number
  fixedD: number
  adjZ: number
  adjD: number
  clothesZ: number
  shelfHole?: PanelHole
  pinMark?: number
}) {
  const col = layout.columns[colIndex]
  if (!col || !(col.innerW > 0)) return null
  return (
    <>
      {shelvesForColumn(layout.shelves, colIndex).map((s, i) => (
        <g key={`fixed-${i}-c${colIndex}`}>
          <Board
            x={T + col.x0}
            y={innerFloorY - s.yTop}
            z={fixedZ}
            w={col.innerW}
            h={T}
            d={fixedD}
            color={shelfColor}
            cam={cam}
            faces={BETWEEN_FACES}
          />
          {shelfHole && (
            <PanelHoleMark
              x={T + col.x0}
              y={innerFloorY - s.yTop}
              z={fixedZ}
              w={col.innerW}
              d={fixedD}
              hole={shelfHole}
              cam={cam}
            />
          )}
        </g>
      ))}
      {layout.zones
        .filter((z) => z.colIndex === colIndex)
        .flatMap((z) =>
          z.movable.map((s, i) => (
            <g key={`shelf-${z.id}-${i}`}>
              <Board
                x={T + z.x0}
                y={innerFloorY - (z.y0 + s.yBottom) - T}
                z={adjZ}
                w={z.innerW}
                h={T}
                d={adjD}
                color={shelfColor}
                cam={cam}
                faces={BETWEEN_FACES}
              />
              <ShelfPins
                x={T + z.x0}
                yTop={innerFloorY - (z.y0 + s.yBottom) - T}
                z={adjZ}
                w={z.innerW}
                shelfT={T}
                d={adjD}
                cam={cam}
                mark={pinMark}
              />
              {shelfHole && (
                <PanelHoleMark
                  x={T + z.x0}
                  y={innerFloorY - (z.y0 + s.yBottom) - T}
                  z={adjZ}
                  w={z.innerW}
                  d={adjD}
                  hole={shelfHole}
                  cam={cam}
                />
              )}
            </g>
          )),
        )}
      {layout.zones
        .filter((z) => z.colIndex === colIndex && z.rails.length > 0)
        .flatMap((z) =>
          z.rails.map((r, i) => (
            <Board
              key={`rail-${z.id}-${i}`}
              x={T + z.x0}
              y={innerFloorY - r.yTop}
              z={clothesZ}
              w={z.innerW}
              h={22}
              d={22}
              color={CLOTHES_RAIL_COLOR}
              cam={cam}
              faces={BETWEEN_FACES}
            />
          )),
        )}
    </>
  )
}

function FrontsOnCabinet({
  layout,
  W,
  T,
  innerFloorY,
  carcassTopY,
  carcassBotY,
  z,
  d,
  cam,
  clearanceBottom = 0,
  insetFronts = false,
  fontScale = 1,
}: {
  layout: InteriorLayout
  W: number
  T: number
  innerFloorY: number
  carcassTopY: number
  carcassBotY: number
  z: number
  d: number
  cam: ReturnType<typeof createDrawCam>
  clearanceBottom?: number
  insetFronts?: boolean
  fontScale?: number
}) {
  const gap = DOOR_GAP_X
  const items: ReactNode[] = []
  const frontFaces = { front: true, top: true, right: true } as const

  const pushHeightLabel = (id: string, x: number, y: number, w: number, h: number) => {
    if (!(h > 24 && w > 40)) return
    const pt = cam.proj(x + w / 2, y + h / 2, z)
    const fontSize = scaledDimFont(Math.max(22, Math.min(h * 0.28, w * 0.14, 52)), fontScale)
    items.push(<DimText key={id} x={pt.x} y={pt.y} label={mm(h)} fontSize={fontSize} rotate={-90} />)
  }

  const pushDoors = (x: number, y: number, w: number, h: number, count: 1 | 2, key: string, label: boolean) => {
    if (!(h > 4)) return
    if (count === 1) {
      items.push(
        <Board
          key={key}
          x={x}
          y={y}
          z={z}
          w={w}
          h={h}
          d={d}
          color={FRONT_FILL}
          cam={cam}
          faces={frontFaces}
          opacity={0.92}
        />,
      )
      if (label) pushHeightLabel(`${key}-h`, x, y, w, h)
      return
    }
    const dw = (w - gap) / 2
    items.push(
      <Board
        key={`${key}-l`}
        x={x}
        y={y}
        z={z}
        w={dw}
        h={h}
        d={d}
        color={FRONT_FILL}
        cam={cam}
        faces={frontFaces}
        opacity={0.92}
      />,
      <Board
        key={`${key}-r`}
        x={x + dw + gap}
        y={y}
        z={z}
        w={dw}
        h={h}
        d={d}
        color={FRONT_FILL}
        cam={cam}
        faces={frontFaces}
        opacity={0.92}
      />,
    )
    if (label) {
      pushHeightLabel(`${key}-lh`, x, y, dw, h)
      pushHeightLabel(`${key}-rh`, x + dw + gap, y, dw, h)
    }
  }

  const pushStacked = (
    box: { x: number; y: number; w: number; h: number },
    doorCount: 0 | 1 | 2,
    drawerFrontHeights: number[],
    key: string,
    bottomGap: number,
  ) => {
    const stacked = stackFronts({
      frontHeight: box.h,
      doorCount,
      drawerFrontHeights,
      clearanceBottom: bottomGap,
    })
    const label = stacked.length >= 2
    for (const s of stacked) {
      const y = box.y + s.yFromFrontTop
      if (s.kind === 'drawer') {
        items.push(
          <Board
            key={`df-${key}-${s.index}`}
            x={box.x}
            y={y}
            z={z}
            w={box.w}
            h={s.height}
            d={d}
            color={FRONT_FILL}
            cam={cam}
            faces={frontFaces}
            opacity={0.92}
          />,
        )
        if (label) pushHeightLabel(`df-${key}-${s.index}-h`, box.x, y, box.w, s.height)
      } else if (s.doorCount === 1 || s.doorCount === 2) {
        pushDoors(box.x, y, box.w, s.height, s.doorCount, `door-${key}`, label)
      }
    }
  }

  if (layout.fullDoorCount > 0 || layout.fullDrawerFrontHeights.length > 0) {
    pushStacked(
      { x: 0, y: carcassTopY, w: W, h: carcassBotY - carcassTopY },
      layout.fullDoorCount,
      layout.fullDrawerFrontHeights,
      'full',
      clearanceBottom,
    )
  }

  for (const zone of layout.zones) {
    if (zone.doorCount === 0 && zone.drawerFrontHeights.length === 0) continue
    const box = zoneFrontBox(zone, { innerFloorY, carcassTopY, carcassBotY, thickness: T })
    const x =
      insetFronts || zone.frontWidth <= 0
        ? T + zone.x0
        : T + zone.frontX0
    const w =
      insetFronts || zone.frontWidth <= 0
        ? zone.innerW > 0
          ? zone.innerW
          : W
        : zone.frontWidth
    pushStacked(
      { x, y: box.y, w, h: box.h },
      zone.doorCount,
      zone.drawerFrontHeights,
      zone.id,
      zone.y0 <= 0.5 ? clearanceBottom : 0,
    )
  }

  return <>{items}</>
}

function ViewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-md border border-neutral-300 bg-white p-2">
      <p className="mb-1 text-center text-[11px] font-medium text-neutral-700">{title}</p>
      <div className="flex flex-1 items-center justify-center overflow-hidden bg-white">{children}</div>
    </div>
  )
}

/** iOS-style zoomable image viewer with double-tap and pinch-to-zoom */
function ZoomableView({ children }: { children: ReactNode }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [scale, setScale] = React.useState(1)
  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })
  const lastTapRef = React.useRef(0)
  const initialPinchDistanceRef = React.useRef<number | null>(null)
  const initialScaleRef = React.useRef(1)

  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const zoomTo = (newScale: number, centerX?: number, centerY?: number) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const cx = centerX ?? rect.width / 2
    const cy = centerY ?? rect.height / 2

    // Calculate the point under the cursor in the scaled coordinate system
    const pointX = (cx - position.x) / scale
    const pointY = (cy - position.y) / scale

    // Calculate new position to keep the point under the cursor
    const newX = cx - pointX * newScale
    const newY = cy - pointY * newScale

    setScale(newScale)
    setPosition({ x: newX, y: newY })
  }

  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now()
    const timeSinceLastTap = now - lastTapRef.current

    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Double tap detected
      e.preventDefault()
      
      const touch = 'touches' in e ? e.touches[0] : e
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top

      if (scale === 1) {
        zoomTo(2.5, x, y)
      } else {
        resetZoom()
      }
      
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      initialPinchDistanceRef.current = distance
      initialScaleRef.current = scale
    } else if (e.touches.length === 1) {
      handleDoubleTap(e)
      if (scale > 1) {
        setIsDragging(true)
        setDragStart({
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y
        })
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistanceRef.current) {
      // Pinch zoom
      e.preventDefault()
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const newScale = Math.max(1, Math.min(4, initialScaleRef.current * (distance / initialPinchDistanceRef.current)))
      
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const container = containerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        zoomTo(newScale, centerX - rect.left, centerY - rect.top)
      }
    } else if (isDragging && e.touches.length === 1) {
      // Pan
      e.preventDefault()
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      })
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    initialPinchDistanceRef.current = null
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    handleDoubleTap(e)
    if (scale > 1) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const delta = -e.deltaY / 500
      const newScale = Math.max(1, Math.min(4, scale * (1 + delta)))
      
      if (newScale === 1) {
        resetZoom()
      } else {
        zoomTo(newScale, x, y)
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden touch-none select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{ 
        cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      <div
        ref={contentRef}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          willChange: 'transform'
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** 3D front view with depth extending to the right (cavalier projection). Shows 2 front legs and how parts overlap. */
function Front3DView({
  p,
  m,
  layout,
  showDimLines,
  showOpeningDims,
  showFronts,
}: {
  p: KitchenBaseParams
  m: ReturnType<typeof measureCarcass>
  layout: InteriorLayout
  showDimLines: boolean
  showOpeningDims: boolean
  showFronts: boolean
}) {
  const T = m.thickness
  const W = m.outerW
  const H = m.outerH
  const D = m.outerD
  const L = p.legHeight
  const R = p.railWidth

  const cam = createDrawCam({ ox: 0, oy: 0 })
  const { x: dx, y: dy } = cam.depthDelta(D)

  const fontScale = p.dimFontScale
  const font = scaledDimFont(Math.max(72, Math.min(W, H) * 0.13), fontScale)
  const railFont = scaledDimFont(Math.max(48, Math.min(R * 0.5, m.railLength * 0.1)), fontScale)
  const legFont = scaledDimFont(Math.max(40, Math.max(72, Math.min(W, H) * 0.13) * 0.55), fontScale)
  const padL = font + 48
  const padT = font + Math.abs(dy) + 28
  const padR = 48
  const leftovers = leftoverPartitionSpans(layout.partitions, layout.columns)
  const openingWidths =
    p.topStyle === 'rails' ? [] : openingWidthSpans(layout.partitions, layout.columns)
  const innerClearH = kitchenClearInnerH(p.height, p.thickness, p.topStyle)
  const openingHeights = remainingHeightSpans(layout, innerClearH)
  const padB = 36

  const totalH = H + L
  const vbW = padL + W + dx + padR
  const vbH = padT + totalH + padB
  const ox = padL
  const floor = padT + totalH
  const topY = floor - L - H
  const botY = floor - L

  const view = createDrawCam({ ox, oy: 0 })

  const legW = Math.max(18, T * 1.2)
  const legInset = Math.max(28, W * 0.08)

  const depthLen = Math.hypot(dx, dy) || 1
  const nx = dy / depthLen
  const ny = -dx / depthLen
  const gap = font * 0.55
  const heightX = ox - gap
  const heightY = (topY + botY) / 2
  const depthMx = ox + dx / 2 + nx * gap
  const depthMy = topY + dy / 2 + ny * gap
  const depthRot = (Math.atan2(dy, dx) * 180) / Math.PI
  const backMx = ox + W / 2 + dx
  const backMy = topY + dy - font * 0.45
  const legLabelX = ox + legInset + legW / 2
  const legLabelY = floor - L / 2
  const sideLabelX = ox + W + dx / 2
  const sideLabelY = (topY + floor - L - T) / 2 + dy / 2

  const zRailFront = D - R
  const zBack = D
  const zShelfFront = DEFAULT_SHELF_FRONT_INSET
  const clothesZ = Math.max(40, D * 0.35)
  const shelfDepth = D - zShelfFront
  const innerFloorY = floor - L - T
  const adjShelfOffs = layout.zones.flatMap((z) => z.movable.map((s) => z.y0 + s.yBottom))
  const topShelfOff =
    layout.shelves.length > 0
      ? layout.shelves[layout.shelves.length - 1].yBottom
      : adjShelfOffs.length > 0
        ? adjShelfOffs[adjShelfOffs.length - 1]
        : 0
  const shelfLabelPt =
    layout.shelves.length > 0
      ? view.proj(W / 2, innerFloorY - layout.shelves[layout.shelves.length - 1].yTop, D / 2)
      : adjShelfOffs.length > 0
        ? view.proj(W / 2, innerFloorY - topShelfOff - T, zShelfFront + shelfDepth / 2)
        : null

  const wood = p.colors
  const sideH = H - T
  const sideY = topY

  return (
    <SketchSvg vbW={vbW} vbH={vbH} height={460} label="3D изглед отпред">
      <defs>
        <filter id="shadow">
          <feDropShadow dx="1" dy="1" stdDeviation="1.5" floodOpacity="0.3" />
        </filter>
      </defs>

      <g filter="url(#shadow)">
        <polygon
          points={`${ox + legInset},${floor - L} ${ox + legInset + legW},${floor - L} ${ox + legInset + legW},${floor} ${ox + legInset},${floor}`}
          fill={wood.leg}
          stroke="#1e293b"
          strokeWidth={1}
        />
      </g>
      <g filter="url(#shadow)">
        <polygon
          points={`${ox + W - legInset - legW},${floor - L} ${ox + W - legInset},${floor - L} ${ox + W - legInset},${floor} ${ox + W - legInset - legW},${floor}`}
          fill={wood.leg}
          stroke="#1e293b"
          strokeWidth={1}
        />
      </g>

      <Board x={0} y={floor - L - T} w={W} h={T} d={D} color={wood.bottom} cam={view} faces={BOX_FACES} />

      {p.hasBack && (
        <Board
          x={0}
          y={topY}
          z={zBack}
          w={W}
          h={H}
          d={1}
          color={DEFAULT_HARDBOARD_COLOR}
          cam={view}
          faces={{ front: true }}
          strokeWidth={0.8}
        />
      )}

      <Board x={0} y={sideY} w={T} h={sideH} d={D} color={wood.side} cam={view} faces={SIDE_LEFT_BODY} />

      {layout.columns.map((col, i) => (
        <g key={`bay-${i}`}>
          <ColumnFill
            layout={layout}
            colIndex={i}
            T={T}
            innerFloorY={innerFloorY}
            cam={view}
            shelfColor={wood.shelf}
            fixedD={D}
            adjZ={zShelfFront}
            adjD={shelfDepth}
            clothesZ={clothesZ}
            pinMark={shelfPinMark(vbH)}
          />
          {p.topStyle === 'rails' && (
            <>
              <Board
                x={T + col.x0}
                y={topY}
                w={col.innerW}
                h={T}
                d={R}
                color={wood.rail}
                cam={view}
                faces={BETWEEN_FACES}
              />
              <Board
                x={T + col.x0}
                y={topY}
                z={zRailFront}
                w={col.innerW}
                h={T}
                d={R}
                color={wood.rail}
                cam={view}
                faces={BETWEEN_FACES}
              />
            </>
          )}
          {layout.partitions[i] && (
            <Board
              x={T + layout.partitions[i].xLeft}
              y={innerFloorY - sideH}
              w={T}
              h={sideH}
              d={D}
              color={wood.side}
              cam={view}
              faces={SIDE_LEFT_BODY}
            />
          )}
        </g>
      ))}

      <Board x={0} y={sideY} w={T} h={sideH} d={D} color={wood.side} cam={view} faces={SIDE_LEFT_TOP} />

      <DrawerSlidesOnCabinet
        layout={layout}
        T={T}
        cam={view}
        z0={SLIDE_FRONT_INSET}
        width={p.width}
        thickness={p.thickness}
        slideLength={p.slideLength}
        slideKind={p.slideKind}
        innerFloorY={innerFloorY}
        carcassTopY={topY}
        carcassBotY={botY}
        fontScale={fontScale}
      />

      <Board x={W - T} y={sideY} w={T} h={sideH} d={D} color={wood.side} cam={view} faces={SIDE_RIGHT} />

      {p.topStyle === 'fascia' &&
        layout.columns.map((col, i) => (
          <Board
            key={`fascia-${i}`}
            x={T + col.x0}
            y={topY}
            z={FASCIA_SETBACK_MM}
            w={col.innerW}
            h={R}
            d={T}
            color={wood.rail}
            cam={view}
            faces={BETWEEN_FACES}
          />
        ))}

      {showFronts && (
        <FrontsOnCabinet
          layout={layout}
          W={W}
          T={T}
          innerFloorY={innerFloorY}
          carcassTopY={topY}
          carcassBotY={botY}
          z={0}
          d={T}
          cam={view}
          fontScale={fontScale}
        />
      )}

      <InteriorHeightDimLines
        layout={layout}
        innerFloorY={innerFloorY}
        T={T}
        fontSize={railFont}
        cam={view}
        shelfZ={zShelfFront}
        railZ={clothesZ}
      />
      {layout.partitions.length > 0 && (
        <PartitionDimLines
          partitions={layout.partitions}
          leftovers={spreadEqualOpeningSpans(
            showOpeningDims ? [...leftovers, ...openingWidths] : leftovers,
            layout.columns,
            crowdedDimColumns(layout),
          )}
          cam={view}
          innerLeft={T}
          y={innerFloorY - Math.max(44, railFont * 0.4)}
          anchorY={innerFloorY}
          fontSize={railFont}
        />
      )}
      {showOpeningDims && openingHeights.length > 0 && (
        <RemainingHeightDimLines
          spans={openingHeights}
          innerFloorY={innerFloorY}
          innerLeft={T}
          fontSize={railFont}
          cam={view}
        />
      )}

      <DimText x={heightX} y={heightY} label={mm(H)} fontSize={font} rotate={-90} />
      <DimText x={depthMx} y={depthMy} label={mm(D)} fontSize={font} rotate={depthRot} />
      <DimText x={backMx} y={backMy} label={mm(W)} fontSize={font} />
      {p.topStyle === 'rails' &&
        layout.columns.map((col, i) => {
        const pt = view.proj(T + col.x0 + col.innerW / 2, topY + T / 2, zRailFront + R / 2)
        return <DimText key={`rail-dim-${i}`} x={pt.x} y={pt.y} label={mm(col.innerW)} fontSize={railFont} />
      })}
      {p.topStyle === 'fascia' &&
        layout.columns.map((col, i) => {
          const pt = view.proj(T + col.x0 + col.innerW / 2, topY + R / 2, FASCIA_SETBACK_MM + T / 2)
          return <DimText key={`fascia-dim-${i}`} x={pt.x} y={pt.y} label={mm(R)} fontSize={railFont} />
        })}
      <DimText x={legLabelX} y={legLabelY} label={mm(L)} fontSize={legFont} rotate={-90} />
      <DimText x={sideLabelX} y={sideLabelY} label={mm(m.sideH)} fontSize={font} rotate={-90} />
      {shelfLabelPt && (
        <DimText
          x={shelfLabelPt.x}
          y={shelfLabelPt.y}
          label={mm(shelfDepth)}
          fontSize={railFont}
          rotate={depthRot}
        />
      )}

      {showDimLines && (
        <g>
          <DimLine x1={heightX + font * 0.22} y1={topY} x2={heightX + font * 0.22} y2={botY} />
          <DimLine x1={ox} y1={topY - 8} x2={ox + dx} y2={topY + dy - 8} />
          <DimLine x1={ox + dx} y1={topY + dy - font * 0.2} x2={ox + W + dx} y2={topY + dy - font * 0.2} />
        </g>
      )}
    </SketchSvg>
  )
}

function KitchenWallPreview({
  params,
  className,
  showDimLines,
  showOpeningDims,
  showFronts,
}: {
  params: Record<string, unknown>
  className?: string
  showDimLines: boolean
  showOpeningDims: boolean
  showFronts: boolean
}) {
  const p = parseKitchenWallParams(params)
  const m = measureCarcass(
    { width: p.width, height: p.height, depth: p.depth, thickness: p.thickness },
    KITCHEN_WALL_JOINERY,
  )
  const { colors } = p
  const layout = layoutInterior({
    innerH: m.innerH,
    innerW: m.innerW,
    thickness: p.thickness,
    fixedShelves: p.fixedShelves,
    partitions: p.partitions,
    doorSpan: p.doorSpan,
    doorCount: p.doorCount,
    shelfCount: p.shelfCount,
    movableShelves: p.movableShelves,
    drawerFrontHeights: p.drawerFrontHeights,
    cutFromOneBoard: p.cutFromOneBoard,
    hasClothesRail: p.hasClothesRail,
    clothesRails: p.clothesRails,
    zones: p.zones,
    overlayCovers: { top: true, bottom: true },
  })
  const drawerViews = uniqueDrawerViews({ ...p, drawerFrontHeights: allDrawerFrontHeights(layout) })
  const counts = layoutCounts(layout)
  const bottomHole = wallBottomHole(p, m.bottomW, m.bottomD)
  const shelfHole = wallShelfHole(p, m.innerW, Math.max(p.thickness, m.sideD - DEFAULT_SHELF_FRONT_INSET))

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ViewCard title="3D Изглед отпред">
        <ZoomableView>
          <WallFront3DView
            p={p}
            m={m}
            layout={layout}
            showDimLines={showDimLines}
            showOpeningDims={showOpeningDims}
            showFronts={showFronts}
            bottomHole={bottomHole}
            shelfHole={shelfHole}
          />
        </ZoomableView>
      </ViewCard>
      {drawerViews.map((view) => (
        <ViewCard
          key={view.frontHeight}
          title={
            drawerViews.length === 1
              ? view.count > 1
                ? `Чекмедже ×${view.count}`
                : 'Чекмедже'
              : view.count > 1
                ? `Чекмедже ${view.frontHeight} мм ×${view.count}`
                : `Чекмедже ${view.frontHeight} мм`
          }
        >
          <ZoomableView>
            <Drawer3DView p={p} box={view.box} />
          </ZoomableView>
        </ViewCard>
      ))}
      <p className="text-center text-[11px] text-[var(--color-muted-foreground)]">
        <span className="mr-3" style={{ color: colors.bottom }}>■ Дъно</span>
        <span className="mr-3" style={{ color: colors.side }}>■ Страници</span>
        <span className="mr-3" style={{ color: colors.rail }}>■ Плот</span>
        {(counts.shelfCount > 0 || layout.shelves.length > 0) && (
          <span className="mr-3" style={{ color: colors.shelf }}>■ Рафтове</span>
        )}
        {p.hasBack && (
          <span className="mr-3" style={{ color: DEFAULT_HARDBOARD_COLOR }}>■ Фазер</span>
        )}
        {p.hasHood && <span className="mr-3">○ Абсорбатор</span>}
        {' · '}
        страниците захлупват плота и дъното
      </p>
    </div>
  )
}

function WallFront3DView({
  p,
  m,
  layout,
  showDimLines,
  showOpeningDims,
  showFronts,
  bottomHole,
  shelfHole,
}: {
  p: KitchenWallParams
  m: ReturnType<typeof measureCarcass>
  layout: InteriorLayout
  showDimLines: boolean
  showOpeningDims: boolean
  showFronts: boolean
  bottomHole?: PanelHole
  shelfHole?: PanelHole
}) {
  const T = m.thickness
  const W = m.outerW
  const H = m.outerH
  const D = m.outerD

  const cam = createDrawCam({ ox: 0, oy: 0 })
  const { x: dx, y: dy } = cam.depthDelta(D)
  const fontScale = p.dimFontScale
  const font = scaledDimFont(Math.max(72, Math.min(W, H) * 0.13), fontScale)
  const small = scaledDimFont(Math.max(48, Math.max(72, Math.min(W, H) * 0.13) * 0.55), fontScale)
  const padL = font + 48
  const padT = font + Math.abs(dy) + 28
  const padR = 48
  const leftovers = leftoverPartitionSpans(layout.partitions, layout.columns)
  const openingWidths = openingWidthSpans(layout.partitions, layout.columns)
  const openingHeights = remainingHeightSpans(layout, m.innerH)
  const padB = 36
  const vbW = padL + W + dx + padR
  const vbH = padT + H + padB
  const ox = padL
  const floor = padT + H
  const topY = floor - H
  const view = createDrawCam({ ox, oy: 0 })
  const depthLen = Math.hypot(dx, dy) || 1
  const nx = dy / depthLen
  const ny = -dx / depthLen
  const gap = font * 0.55
  const heightX = ox - gap
  const heightY = (topY + floor) / 2
  const depthMx = ox + dx / 2 + nx * gap
  const depthMy = topY + dy / 2 + ny * gap
  const depthRot = (Math.atan2(dy, dx) * 180) / Math.PI
  const backMx = ox + W / 2 + dx
  const backMy = topY + dy - font * 0.45
  const zShelfFront = DEFAULT_SHELF_FRONT_INSET
  const clothesZ = Math.max(40, D * 0.35)
  const shelfDepth = D - zShelfFront
  const innerFloorY = floor - T
  const innerTopY = topY + T
  const wood = p.colors
  const sideH = H
  const partitionH = m.innerH
  const leftInnerY = topY
  const leftInnerH = H - T

  return (
    <SketchSvg vbW={vbW} vbH={vbH} height={460} label="3D изглед отпред">
      {p.hasBack && (
        <Board
          x={0}
          y={topY}
          z={D}
          w={W}
          h={H}
          d={1}
          color={DEFAULT_HARDBOARD_COLOR}
          cam={view}
          faces={{ front: true }}
          strokeWidth={0.8}
        />
      )}

      <Board
        x={0}
        y={leftInnerY}
        w={T}
        h={leftInnerH}
        d={D}
        color={wood.side}
        cam={view}
        faces={{ right: true }}
      />
      <Board x={0} y={topY} w={T} h={sideH} d={D} color={wood.side} cam={view} faces={{ front: true }} />
      <Board x={0} y={topY} w={T} h={T} d={D} color={wood.side} cam={view} faces={SIDE_LEFT_TOP} />

      <Board x={T} y={innerFloorY} w={m.bottomW} h={T} d={D} color={wood.bottom} cam={view} faces={BETWEEN_FACES} />
      {bottomHole && (
        <PanelHoleMark x={T} y={innerFloorY} z={0} w={m.bottomW} d={D} hole={bottomHole} cam={view} />
      )}

      {layout.columns.map((_, i) => (
        <g key={`bay-${i}`}>
          <ColumnFill
            layout={layout}
            colIndex={i}
            T={T}
            innerFloorY={innerFloorY}
            cam={view}
            shelfColor={wood.shelf}
            fixedD={D}
            adjZ={zShelfFront}
            adjD={shelfDepth}
            clothesZ={clothesZ}
            shelfHole={shelfHole}
            pinMark={shelfPinMark(vbH)}
          />
          {layout.partitions[i] && (
            <Board
              x={T + layout.partitions[i].xLeft}
              y={innerTopY}
              w={T}
              h={partitionH}
              d={D}
              color={wood.side}
              cam={view}
              faces={SIDE_LEFT_BODY}
            />
          )}
        </g>
      ))}

      <Board x={W - T} y={topY} w={T} h={sideH} d={D} color={wood.side} cam={view} faces={SIDE_RIGHT} />

      <Board
        x={T}
        y={topY}
        w={m.railLength}
        h={T}
        d={D}
        color={wood.rail}
        cam={view}
        faces={BETWEEN_FACES}
      />

      {showFronts && (
        <FrontsOnCabinet
          layout={layout}
          W={W}
          T={T}
          innerFloorY={innerFloorY}
          carcassTopY={topY}
          carcassBotY={floor}
          z={0}
          d={T}
          cam={view}
          fontScale={fontScale}
        />
      )}

      <InteriorHeightDimLines
        layout={layout}
        innerFloorY={innerFloorY}
        T={T}
        fontSize={small}
        cam={view}
        shelfZ={zShelfFront}
        railZ={clothesZ}
      />
      {layout.partitions.length > 0 && (
        <PartitionDimLines
          partitions={layout.partitions}
          leftovers={spreadEqualOpeningSpans(
            showOpeningDims ? [...leftovers, ...openingWidths] : leftovers,
            layout.columns,
            crowdedDimColumns(layout),
          )}
          cam={view}
          innerLeft={T}
          y={innerFloorY - Math.max(44, small * 0.4)}
          anchorY={innerFloorY}
          fontSize={small}
        />
      )}
      {showOpeningDims && openingHeights.length > 0 && (
        <RemainingHeightDimLines
          spans={openingHeights}
          innerFloorY={innerFloorY}
          innerLeft={T}
          fontSize={small}
          cam={view}
        />
      )}

      <DimText x={heightX} y={heightY} label={mm(H)} fontSize={font} rotate={-90} />
      <DimText x={depthMx} y={depthMy} label={mm(D)} fontSize={font} rotate={depthRot} />
      <DimText x={backMx} y={backMy} label={mm(W)} fontSize={font} />
      {bottomHole && (
        <DimText
          x={view.proj(T + m.bottomW / 2, innerFloorY, D / 2).x}
          y={view.proj(T + m.bottomW / 2, innerFloorY, D / 2).y}
          label={bottomHole.kind === 'round' ? `Ø${mm(bottomHole.diameter)}` : `${mm(bottomHole.width)}×${mm(bottomHole.height)}`}
          fontSize={small}
        />
      )}

      {showDimLines && (
        <g>
          <DimLine x1={heightX + font * 0.22} y1={topY} x2={heightX + font * 0.22} y2={floor} />
          <DimLine x1={ox} y1={topY - 8} x2={ox + dx} y2={topY + dy - 8} />
          <DimLine x1={ox + dx} y1={topY + dy - font * 0.2} x2={ox + W + dx} y2={topY + dy - font * 0.2} />
        </g>
      )}
    </SketchSvg>
  )
}

function Drawer3DView({
  p,
  box,
}: {
  p: { thickness: number; colors: { side: string }; dimFontScale?: number }
  box: DrawerBoxRails
}) {
  const T = p.thickness
  const Wd = box.drawerOuterW
  const Hd = box.outer.height
  const Dd = box.outer.width
  const Wi = box.inner.width
  const Hi = box.inner.height
  const innerY = Hd - Hi

  const hint = createDrawCam({ ox: 0, oy: 0 })
  const { x: dx, y: dy } = hint.depthDelta(Dd)

  const fontScale = p.dimFontScale ?? 1
  const font = scaledDimFont(Math.max(40, Math.min(Wd, Hd) * 0.18), fontScale)
  const small = scaledDimFont(Math.max(32, Math.max(40, Math.min(Wd, Hd) * 0.18) * 0.7), fontScale)
  const padL = font + 36
  const padT = font + Math.abs(dy) + 24
  const padR = font + 40
  const padB = font + 28

  const vbW = padL + Wd + dx + padR
  const vbH = padT + Hd + padB
  const cam = createDrawCam({ ox: padL, oy: padT })

  const wood = p.colors.side
  const innerFrontMid = cam.proj(T + Wi / 2, innerY + Hi / 2, T / 2)
  const boxW = cam.proj(Wd / 2, 4, Dd)
  const outerH = cam.proj(-10, Hd / 2, 0)
  const outerL = cam.proj(T / 2, 6, Dd / 2)

  return (
    <SketchSvg vbW={vbW} vbH={vbH} height={400} label="Чекмедже с царги">
      {/* Same order as the cabinet: left body → back between → left top → right → front between. */}
      <Board x={0} y={0} w={T} h={Hd} d={Dd} color={wood} cam={cam} faces={SIDE_LEFT_BODY} />
      <Board
        x={T}
        y={innerY}
        z={Dd - T}
        w={Wi}
        h={Hi}
        d={T}
        color={wood}
        cam={cam}
        faces={BETWEEN_FACES}
      />
      <Board x={0} y={0} w={T} h={Hd} d={Dd} color={wood} cam={cam} faces={SIDE_LEFT_TOP} />
      <Board x={Wd - T} y={0} w={T} h={Hd} d={Dd} color={wood} cam={cam} faces={SIDE_RIGHT} />
      <Board x={T} y={innerY} z={0} w={Wi} h={Hi} d={T} color={wood} cam={cam} faces={BETWEEN_FACES} />

      <DimText x={outerL.x} y={outerL.y} label={mm(Dd)} fontSize={small} />
      <DimText x={outerH.x} y={outerH.y} label={mm(Hd)} fontSize={small} rotate={-90} />
      <DimText
        x={innerFrontMid.x}
        y={innerFrontMid.y}
        label={Hi !== Hd ? `${mm(Wi)}×${mm(Hi)}` : mm(Wi)}
        fontSize={small}
      />
      <DimText x={boxW.x} y={boxW.y} label={mm(Wd)} fontSize={small} />
    </SketchSvg>
  )
}

function PlinthBoxPreview({
  typeId,
  params,
  className,
  showDimLines,
  showOpeningDims,
  showFronts,
}: {
  typeId: 'nightstand' | 'section' | 'wardrobe'
  params: Record<string, unknown>
  className?: string
  showDimLines: boolean
  showOpeningDims: boolean
  showFronts: boolean
}) {
  const topInner = typeId === 'section' || typeId === 'wardrobe'
  const p =
    typeId === 'wardrobe'
      ? parseWardrobeParams(params)
      : topInner
        ? parseSectionParams(params)
        : parseNightstandParams(params)
  const m = measureNightstand(p, topInner)
  const { colors } = p
  const sliding = p.doorStyle === 'sliding'
  const layout = layoutInterior({
    innerH: m.innerH,
    innerW: m.innerW,
    thickness: p.thickness,
    fixedShelves: p.fixedShelves,
    partitions: p.partitions,
    doorSpan: sliding ? 'full' : p.doorSpan,
    doorCount: sliding ? 0 : p.doorCount,
    shelfCount: p.shelfCount,
    movableShelves: p.movableShelves,
    drawerFrontHeights: p.drawerFrontHeights,
    cutFromOneBoard: p.cutFromOneBoard,
    hasClothesRail: p.hasClothesRail,
    clothesRails: p.clothesRails,
    zones: sliding
      ? Object.fromEntries(
          Object.entries(p.zones ?? {}).map(([id, z]) => [id, z ? { ...z, doorCount: 0 as const } : z]),
        )
      : p.zones,
    overlayCovers: sliding
      ? { top: false, bottom: false }
      : { top: m.frontCoversTop, bottom: m.frontCoversBottom },
  })
  const counts = layoutCounts(layout)
  const drawerViews = uniqueDrawerViews({ ...p, drawerFrontHeights: allDrawerFrontHeights(layout) })
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ViewCard title="3D Изглед отпред">
        <ZoomableView>
          <PlinthBoxFront3DView
            p={p}
            topInner={topInner}
            layout={layout}
            showDimLines={showDimLines}
            showOpeningDims={showOpeningDims}
            showFronts={showFronts}
          />
        </ZoomableView>
      </ViewCard>
      {drawerViews.map((view) => (
        <ViewCard
          key={view.frontHeight}
          title={
            drawerViews.length === 1
              ? view.count > 1
                ? `Чекмедже ×${view.count}`
                : 'Чекмедже'
              : view.count > 1
                ? `Чекмедже ${view.frontHeight} мм ×${view.count}`
                : `Чекмедже ${view.frontHeight} мм`
          }
        >
          <ZoomableView>
            <Drawer3DView p={p} box={view.box} />
          </ZoomableView>
        </ViewCard>
      ))}
      <p className="text-center text-[11px] text-[var(--color-muted-foreground)]">
        <span className="mr-3" style={{ color: colors.bottom }}>■ Дъно</span>
        <span className="mr-3" style={{ color: colors.side }}>■ Страници</span>
        {p.topStyle === 'panel' && (
          <span className="mr-3" style={{ color: colors.rail }}>■ Плот</span>
        )}
        {p.topStyle === 'fascia' && (
          <span className="mr-3" style={{ color: colors.rail }}>■ Бленда надолу</span>
        )}
        {counts.shelfCount > 0 || layout.shelves.length > 0 ? (
          <span className="mr-3" style={{ color: colors.shelf }}>■ Рафтове</span>
        ) : null}
        {p.hasBack && (
          <span className="mr-3" style={{ color: DEFAULT_HARDBOARD_COLOR }}>■ Фазер</span>
        )}
        {counts.clothesRailCount > 0 && (
          <span className="mr-3" style={{ color: CLOTHES_RAIL_COLOR }}>■ Лост</span>
        )}
        {drawerViews.length > 0 && (
          <span className="mr-3" style={{ color: SLIDE_STROKE_COLOR }}>■ Водачи</span>
        )}
        {p.useLegs ? (
          <span style={{ color: colors.leg }}>■ Крачета</span>
        ) : (
          <span style={{ color: colors.bottom }}>■ Цокъл</span>
        )}
        {showFronts && (counts.doorCount > 0 || counts.drawerCount > 0 || (sliding && p.doorCount === 2)) && (
          <span className="mr-3" style={{ color: FRONT_FILL }}> ■ Врати и чела</span>
        )}
        {!showFronts && (counts.doorCount > 0 || (sliding && p.doorCount === 2)) && (
          <>
            {' · '}
            {sliding && p.doorCount === 2
              ? '2 плъзгащи врати'
              : counts.doorCount === 1
                ? '1 врата'
                : `${counts.doorCount} врати`} (включи ги с отметката)
          </>
        )}
        {!showFronts && counts.drawerCount > 0 && (
          <>
            {' · '}
            {counts.drawerCount === 1 ? '1 чекмедже' : `${counts.drawerCount} чекмеджета`} (челата с отметката)
          </>
        )}
        {' · '}
        {topInner
          ? p.topStyle === 'panel'
            ? 'страниците външни на дъното и плота, плотът между тях'
            : p.topStyle === 'fascia'
              ? 'страниците външни на дъното, бленда надолу 3 мм навътре'
              : 'страниците външни на дъното, отворен корпус отгоре'
          : p.topStyle === 'panel'
            ? 'страниците външни на дъното, плотът външен върху страниците, ъгълчета отвътре'
            : p.topStyle === 'fascia'
              ? 'страниците външни на дъното, бленда надолу 3 мм навътре'
              : 'страниците външни на дъното, отворен корпус отгоре'}
      </p>
    </div>
  )
}

function PlinthBoxFront3DView({
  p,
  topInner,
  layout,
  showDimLines,
  showOpeningDims,
  showFronts,
}: {
  p: NightstandParams
  topInner: boolean
  layout: InteriorLayout
  showDimLines: boolean
  showOpeningDims: boolean
  showFronts: boolean
}) {
  const m = measureNightstand(p, topInner)
  const T = m.thickness
  const W = p.width
  const H = p.height
  const D = p.depth
  const zSide = m.frontOverhang

  const hint = createDrawCam({ ox: 0, oy: 0 })
  const { x: dx, y: dy } = hint.depthDelta(D)

  const fontScale = p.dimFontScale
  const fontBase = Math.max(72, Math.min(W, H) * 0.13)
  const font = scaledDimFont(fontBase, fontScale)
  const small = scaledDimFont(Math.max(40, fontBase * 0.55), fontScale)
  const tallCabinet = H >= 1800
  const supportFont = scaledDimFont(Math.max(30, Math.min(tallCabinet ? 46 : 48, Math.max(40, fontBase * 0.55) * 0.58)), fontScale)
  const supportGap = Math.max(34, supportFont * 0.75)
  const padL = font + 48
  const padT = font + Math.abs(dy) + 28
  const padR = 48
  const leftovers = leftoverPartitionSpans(layout.partitions, layout.columns)
  const openingWidths = openingWidthSpans(layout.partitions, layout.columns)
  const openingHeights = remainingHeightSpans(layout, m.innerH)
  const padB = Math.max(52, supportFont * 0.85)

  const vbW = padL + W + dx + padR
  const vbH = padT + H + padB
  const ox = padL
  const floor = padT + H
  const topY = floor - H
  const coveringTop = m.coveringTop
  const innerTopPanel = m.innerTopPanel
  const sideY = coveringTop ? topY + T : topY
  const supportH = m.supportH
  const bottomY = floor - supportH - T

  const view = createDrawCam({ ox, oy: 0 })

  const depthLen = Math.hypot(dx, dy) || 1
  const nx = dy / depthLen
  const ny = -dx / depthLen
  const gap = font * 0.55
  const heightX = ox - gap
  const heightY = (topY + floor) / 2
  const depthMx = ox + dx / 2 + nx * gap
  const depthMy = topY + dy / 2 + ny * gap
  const depthRot = (Math.atan2(dy, dx) * 180) / Math.PI
  const backMx = ox + W / 2 + dx
  const backMy = topY + dy - font * 0.45
  const sideDepthLabel = view.proj(W, sideY + m.sideH * 0.4, zSide + m.sideD / 2)
  const bottomFrontLabel = p.useLegs
    ? view.proj(W / 2, bottomY + T / 2, 0)
    : view.proj(T + m.bottomW / 2, bottomY + T / 2, zSide)
  const supportLineX = ox - supportGap
  const supportTick = Math.max(10, supportFont * 0.22)
  const supportLabelX = supportLineX - supportFont * 0.28
  const supportLift = tallCabinet ? Math.max(24, supportFont * 0.75) : 12
  const supportLabelY = floor - supportH / 2 - supportLift

  const wood = p.colors
  const legW = Math.max(18, T * 1.2)
  const legD = Math.max(legW, 42)
  const legInset = Math.max(28, W * 0.08)
  const legZ = Math.max(16, T)
  const plinthY = floor - p.plinthHeight
  const plinthFront = p.useLegs
    ? null
    : {
        topL: view.proj(T, plinthY, m.plinthZ),
        topR: view.proj(T + m.plinthLength, plinthY, m.plinthZ),
        botR: view.proj(T + m.plinthLength, floor, m.plinthZ),
        botL: view.proj(T, floor, m.plinthZ),
      }

  const zShelfFront = zSide + (m.sideD - m.shelfD)
  const clothesZ = zSide + Math.min(80, m.sideD * 0.4)
  const shelfDepth = m.shelfD
  const zPartition = zSide + (m.sideD - m.partitionD)
  const innerFloorY = bottomY
  const carcassBotY = floor - supportH
  const frontTopY = coveringTop ? topY + T : topY
  const frontBotY = m.frontCoversBottom ? carcassBotY : bottomY

  const leftInnerY = innerTopPanel ? topY + T : sideY
  const leftInnerH = Math.max(T, bottomY - leftInnerY)
  const partitionDepthDim = (() => {
    if (layout.partitions.length === 0) return null
    if (!(m.partitionD + 0.5 < m.sideD)) return null
    const part = layout.partitions[layout.partitions.length - 1]!
    const x = T + part.xRight
    const y = leftInnerY + Math.max(56, leftInnerH * 0.16)
    const a = view.proj(x, y, zPartition)
    const b = view.proj(x, y, zPartition + m.partitionD)
    const mid = view.proj(x, y, zPartition + m.partitionD / 2)
    return { a, b, mid }
  })()

  return (
    <SketchSvg vbW={vbW} vbH={vbH} height={460} label={topInner ? (p.doorStyle === 'sliding' ? 'Гардероб 3D' : 'Секция 3D') : 'Нощно шкафче 3D'}>
      <defs>
        <filter id="ns-shadow">
          <feDropShadow dx="1" dy="1" stdDeviation="1.5" floodOpacity="0.3" />
        </filter>
      </defs>

      {p.useLegs && (
        <>
          <Board
            x={legInset}
            y={floor - supportH}
            z={legZ}
            w={legW}
            h={supportH}
            d={legD}
            color={wood.leg}
            cam={view}
            faces={{ front: true, right: true, top: true }}
          />
          <Board
            x={W - legInset - legW}
            y={floor - supportH}
            z={legZ}
            w={legW}
            h={supportH}
            d={legD}
            color={wood.leg}
            cam={view}
            faces={{ front: true, right: true, top: true }}
          />
        </>
      )}

      {p.useLegs && (
        <Board
          x={0}
          y={bottomY}
          z={0}
          w={W}
          h={T}
          d={D}
          color={wood.bottom}
          cam={view}
          faces={BOX_FACES}
        />
      )}

      {p.hasBack && (
        <Board
          x={0}
          y={topY}
          z={zSide + m.sideD}
          w={W}
          h={p.useLegs ? H : H - p.plinthHeight}
          d={1}
          color={DEFAULT_HARDBOARD_COLOR}
          cam={view}
          faces={{ front: true }}
          strokeWidth={0.8}
        />
      )}

      <Board
        x={0}
        y={leftInnerY}
        z={zSide}
        w={T}
        h={leftInnerH}
        d={m.sideD}
        color={wood.side}
        cam={view}
        faces={{ right: true }}
      />
      {!p.useLegs && (
        <>
          <Board
            x={0}
            y={floor - p.plinthHeight}
            z={zSide}
            w={T}
            h={p.plinthHeight}
            d={m.plinthInset}
            color={wood.side}
            cam={view}
            faces={{ right: true }}
            strokeWidth={0}
          />
          <Board
            x={T}
            y={floor - p.plinthHeight}
            z={m.plinthZ}
            w={m.plinthLength}
            h={p.plinthHeight}
            d={T}
            color={wood.bottom}
            cam={view}
            faces={{ front: true, top: true }}
            strokeWidth={0}
          />
          {plinthFront && (
            <g stroke={DRAW_STROKE} strokeWidth={1.2} fill="none">
              <line x1={plinthFront.topL.x} y1={plinthFront.topL.y} x2={plinthFront.topR.x} y2={plinthFront.topR.y} />
              <line x1={plinthFront.topR.x} y1={plinthFront.topR.y} x2={plinthFront.botR.x} y2={plinthFront.botR.y} />
              <line x1={plinthFront.botR.x} y1={plinthFront.botR.y} x2={plinthFront.botL.x} y2={plinthFront.botL.y} />
            </g>
          )}
        </>
      )}
      <Board
        x={0}
        y={sideY}
        z={zSide}
        w={T}
        h={m.sideH}
        d={m.sideD}
        color={wood.side}
        cam={view}
        faces={{ front: true }}
      />
      {topInner && (
        <Board
          x={0}
          y={topY}
          z={zSide}
          w={T}
          h={T}
          d={m.sideD}
          color={wood.side}
          cam={view}
          faces={SIDE_LEFT_TOP}
        />
      )}

      {!p.useLegs && (
        <>
          <Board
            x={T}
            y={bottomY}
            z={zSide}
            w={m.bottomW}
            h={T}
            d={m.bottomD}
            color={wood.bottom}
            cam={view}
            faces={{ top: true }}
            strokeWidth={0}
          />
          <Board
            x={T}
            y={bottomY}
            z={zSide}
            w={m.bottomW}
            h={T}
            d={1}
            color={wood.bottom}
            cam={view}
            faces={{ front: true }}
          />
        </>
      )}

      {layout.columns.map((_, i) => (
        <g key={`ns-bay-${i}`}>
          <ColumnFill
            layout={layout}
            colIndex={i}
            T={T}
            innerFloorY={innerFloorY}
            cam={view}
            shelfColor={wood.shelf}
            fixedZ={m.sliding ? zShelfFront : zSide}
            fixedD={m.sliding ? m.shelfD : m.sideD}
            adjZ={zShelfFront}
            adjD={shelfDepth}
            clothesZ={clothesZ}
            pinMark={shelfPinMark(vbH)}
          />
          {layout.partitions[i] && (
            <Board
              x={T + layout.partitions[i].xLeft}
              y={leftInnerY}
              z={zPartition}
              w={T}
              h={leftInnerH}
              d={m.partitionD}
              color={wood.side}
              cam={view}
              faces={SIDE_LEFT_BODY}
            />
          )}
        </g>
      ))}

      <DrawerSlidesOnCabinet
        layout={layout}
        T={T}
        cam={view}
        z0={zSide + SLIDE_FRONT_INSET}
        partitionFrontZ={m.sliding ? zPartition : undefined}
        width={p.width}
        thickness={p.thickness}
        slideLength={p.slideLength}
        slideKind={p.slideKind}
        innerFloorY={innerFloorY}
        carcassTopY={frontTopY}
        carcassBotY={frontBotY}
        fontScale={fontScale}
      />

      <Board
        x={W - T}
        y={sideY}
        z={zSide}
        w={T}
        h={m.sideH}
        d={m.sideD}
        color={wood.side}
        cam={view}
        faces={topInner ? SIDE_RIGHT : SIDE_LEFT_BODY}
      />

      {p.topStyle === 'fascia' &&
        layout.columns.map((col, i) => (
          <Board
            key={`fascia-${i}`}
            x={T + col.x0}
            y={topY}
            z={zSide + FASCIA_SETBACK_MM}
            w={col.innerW}
            h={p.railWidth}
            d={T}
            color={wood.rail}
            cam={view}
            faces={BETWEEN_FACES}
          />
        ))}

      {innerTopPanel ? (
        <Board
          x={T}
          y={topY}
          z={zSide}
          w={m.topW}
          h={T}
          d={m.topD}
          color={wood.rail}
          cam={view}
          faces={BETWEEN_FACES}
        />
      ) : coveringTop ? (
        <Board
          x={0}
          y={topY}
          z={0}
          w={m.topW}
          h={T}
          d={m.topD}
          color={wood.rail}
          cam={view}
          faces={BOX_FACES}
        />
      ) : null}

      {m.sliding && (
        <Board
          x={T}
          y={bottomY - SLIDING_BOTTOM_TRACK_MM}
          z={0}
          w={m.innerW}
          h={SLIDING_BOTTOM_TRACK_MM}
          d={T}
          color="#8b7355"
          cam={view}
          faces={{ front: true, top: true, right: true }}
        />
      )}

      {showFronts && m.sliding && p.doorCount === 2 &&
        layoutSlidingDoors({
          innerW: m.innerW,
          innerH: m.innerH,
          thickness: T,
          partitions: layout.partitions,
          edges: p.slidingEdges,
        }).map((leaf, i) => (
          <Board
            key={`slide-door-${leaf.side}`}
            x={T + leaf.x}
            y={bottomY - leaf.gabaritH}
            z={i === 0 ? T + 8 : 0}
            w={leaf.gabaritW}
            h={leaf.gabaritH}
            d={T}
            color={FRONT_FILL}
            cam={view}
            faces={{ front: true, top: true, right: true }}
            opacity={0.88}
          />
        ))}

      {showFronts && (
        <FrontsOnCabinet
          layout={layout}
          W={W}
          T={T}
          innerFloorY={innerFloorY}
          carcassTopY={m.sliding ? leftInnerY : frontTopY}
          carcassBotY={m.sliding ? bottomY : frontBotY}
          z={0}
          d={T}
          cam={view}
          clearanceBottom={m.sliding ? SLIDING_DRAWER_FROM_BOTTOM_MM : 0}
          insetFronts={m.sliding}
          fontScale={fontScale}
        />
      )}

      <InteriorHeightDimLines
        layout={layout}
        innerFloorY={innerFloorY}
        T={T}
        fontSize={small}
        cam={view}
        originZ={m.sliding ? zShelfFront : zSide}
        shelfZ={m.sliding ? zShelfFront : zSide}
        railZ={clothesZ}
      />
      {layout.partitions.length > 0 && (
        <PartitionDimLines
          partitions={layout.partitions}
          leftovers={spreadEqualOpeningSpans(
            showOpeningDims ? [...leftovers, ...openingWidths] : leftovers,
            layout.columns,
            crowdedDimColumns(layout),
          )}
          cam={view}
          innerLeft={T}
          y={innerFloorY - (m.sliding ? SLIDING_BOTTOM_TRACK_MM : 0) - Math.max(44, small * 0.4)}
          anchorY={innerFloorY}
          z={zPartition}
          leftoverZ={zSide}
          zAtX={(x) =>
            layout.partitions.some((part) => x >= part.xLeft - 0.51 && x <= part.xRight + 0.51)
              ? zPartition
              : zSide
          }
          fontSize={small}
        />
      )}
      {showOpeningDims && openingHeights.length > 0 && (
        <RemainingHeightDimLines
          spans={openingHeights}
          innerFloorY={innerFloorY}
          innerLeft={T}
          fontSize={small}
          cam={view}
          originZ={zSide}
        />
      )}

      <DimText x={heightX} y={heightY} label={mm(H)} fontSize={font} rotate={-90} />
      <DimText x={depthMx} y={depthMy} label={mm(D)} fontSize={font} rotate={depthRot} />
      <DimText x={backMx} y={backMy} label={mm(W)} fontSize={font} />
      <DimText x={sideDepthLabel.x + 10} y={sideDepthLabel.y} label={mm(m.sideD)} fontSize={small} rotate={depthRot} />
      {partitionDepthDim && (
        <g stroke={DRAW_DIM} fill={DRAW_DIM}>
          <DimLine
            x1={partitionDepthDim.a.x}
            y1={partitionDepthDim.a.y}
            x2={partitionDepthDim.b.x}
            y2={partitionDepthDim.b.y}
          />
          <DimText
            x={partitionDepthDim.mid.x + 12}
            y={partitionDepthDim.mid.y}
            label={mm(m.partitionD)}
            fontSize={small}
            rotate={depthRot}
            fill={DRAW_DIM}
          />
        </g>
      )}
      <DimText x={bottomFrontLabel.x} y={bottomFrontLabel.y} label={mm(m.bottomW)} fontSize={small} />
      <g stroke={DRAW_DIM} fill={DRAW_DIM}>
        <line
          x1={supportLineX - supportTick}
          y1={floor - supportH}
          x2={supportLineX + supportTick}
          y2={floor - supportH}
          strokeWidth={2}
        />
        <line
          x1={supportLineX - supportTick}
          y1={floor}
          x2={supportLineX + supportTick}
          y2={floor}
          strokeWidth={2}
        />
        <DimLine x1={supportLineX} y1={floor - supportH} x2={supportLineX} y2={floor} />
        <DimText
          x={supportLabelX}
          y={supportLabelY}
          label={mm(supportH)}
          fontSize={supportFont}
          rotate={-90}
          fill={DRAW_DIM}
        />
      </g>

      {showDimLines && (
        <g>
          <DimLine x1={heightX + font * 0.22} y1={topY} x2={heightX + font * 0.22} y2={floor} />
          <DimLine x1={ox} y1={topY - 8} x2={ox + dx} y2={topY + dy - 8} />
          <DimLine x1={ox + dx} y1={topY + dy - font * 0.2} x2={ox + W + dx} y2={topY + dy - font * 0.2} />
        </g>
      )}
    </SketchSvg>
  )
}
