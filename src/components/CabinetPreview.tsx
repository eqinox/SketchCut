import React, { type ReactNode } from 'react'
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
  return `${Math.round(n)}`
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

/** Single 3D front view with depth extending to the right. */
export function CabinetPreview({
  typeId = 'kitchen-base',
  params,
  className,
  showDimLines = false,
  showFronts = false,
}: CabinetPreviewProps) {
  if (typeId === 'kitchen-wall') {
    return (
      <KitchenWallPreview
        params={params}
        className={className}
        showDimLines={showDimLines}
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
          <Front3DView p={p} m={m} layout={layout} showDimLines={showDimLines} showFronts={showFronts} />
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

/** Always-on height for a fixed shelf: from the chosen carcass face to the chosen shelf face. */
function FixedShelfDimLines({
  shelves,
  columns,
  innerFloorY,
  worldX0,
  fontSize,
  cam,
  originZ = 0,
  shelfZ = 0,
}: {
  shelves: InteriorLayout['shelves']
  columns: InteriorLayout['columns']
  innerFloorY: number
  worldX0: number
  fontSize: number
  cam: ReturnType<typeof createDrawCam>
  originZ?: number
  shelfZ?: number
}) {
  const tick = Math.max(12, fontSize * 0.22)
  const stack = new Map<string, number>()
  return (
    <>
      {shelves.map((s, i) => {
        const key = s.columnIndex == null ? 'full' : String(s.columnIndex)
        const n = stack.get(key) ?? 0
        stack.set(key, n + 1)
        const colX = s.columnIndex != null ? (columns[s.columnIndex]?.x0 ?? 0) : 0
        const worldX = worldX0 + colX + n * Math.max(36, fontSize * 0.5)
        const a = cam.proj(worldX, innerFloorY - s.startY, originZ)
        const b = cam.proj(worldX, innerFloorY - shelfMeasureEndY(s), shelfZ)
        return (
          <g key={`fixed-dim-${i}`} stroke={DRAW_DIM} fill={DRAW_DIM}>
            <line x1={a.x - tick} y1={a.y} x2={a.x + tick} y2={a.y} strokeWidth={2} />
            <line x1={b.x - tick} y1={b.y} x2={b.x + tick} y2={b.y} strokeWidth={2} />
            <DimLine x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
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

/** Always-on height for a pin shelf: from the chosen carcass/zone face to the chosen shelf face. */
function MovableShelfDimLines({
  zones,
  innerFloorY,
  worldX0,
  fontSize,
  cam,
  originZ = 0,
  shelfZ = 0,
}: {
  zones: InteriorLayout['zones']
  innerFloorY: number
  worldX0: number
  fontSize: number
  cam: ReturnType<typeof createDrawCam>
  originZ?: number
  shelfZ?: number
}) {
  const tick = Math.max(12, fontSize * 0.22)
  const stack = new Map<string, number>()
  return (
    <>
      {zones.flatMap((z) => {
        if ((z.movableShelves?.length ?? 0) === 0) return []
        return z.movable.flatMap((s, i) => {
          if (s.from === 'middle') return []
          const key = String(z.colIndex)
          const n = stack.get(key) ?? 0
          stack.set(key, n + 1)
          const worldX = worldX0 + z.x0 + n * Math.max(36, fontSize * 0.5)
          const a = cam.proj(worldX, innerFloorY - (z.y0 + s.startY), originZ)
          const b = cam.proj(worldX, innerFloorY - (z.y0 + shelfMeasureEndY(s)), shelfZ)
          return (
            <g key={`mov-dim-${z.id}-${i}`} stroke={DRAW_DIM} fill={DRAW_DIM}>
              <line x1={a.x - tick} y1={a.y} x2={a.x + tick} y2={a.y} strokeWidth={2} />
              <line x1={b.x - tick} y1={b.y} x2={b.x + tick} y2={b.y} strokeWidth={2} />
              <DimLine x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
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
        })
      })}
    </>
  )
}

/** Height of a clothes rail: from the chosen opening face to the top of the rod. */
function ClothesRailDimLines({
  zones,
  innerFloorY,
  worldX0,
  fontSize,
  cam,
  originZ = 0,
  railZ = 0,
}: {
  zones: InteriorLayout['zones']
  innerFloorY: number
  worldX0: number
  fontSize: number
  cam: ReturnType<typeof createDrawCam>
  originZ?: number
  railZ?: number
}) {
  const tick = Math.max(12, fontSize * 0.22)
  const stack = new Map<string, number>()
  return (
    <>
      {zones.flatMap((z) =>
        z.rails.flatMap((r, i) => {
          if (r.from === 'middle') return []
          const key = String(z.colIndex)
          const n = stack.get(key) ?? 0
          stack.set(key, n + 1)
          const worldX = worldX0 + z.x0 + n * Math.max(36, fontSize * 0.5)
          const originY = r.from === 'top' ? z.y1 : z.y0
          const a = cam.proj(worldX, innerFloorY - originY, originZ)
          const b = cam.proj(worldX, innerFloorY - r.yTop, railZ)
          return (
            <g key={`rail-dim-${z.id}-${i}`} stroke={DRAW_DIM} fill={DRAW_DIM}>
              <line x1={a.x - tick} y1={a.y} x2={a.x + tick} y2={a.y} strokeWidth={2} />
              <line x1={b.x - tick} y1={b.y} x2={b.x + tick} y2={b.y} strokeWidth={2} />
              <DimLine x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              <DimText
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2}
                label={mm(r.offsetMm)}
                fontSize={fontSize}
                rotate={-90}
                fill={DRAW_DIM}
              />
            </g>
          )
        }),
      )}
    </>
  )
}

/** Clear openings that the user did not already measure (the leftover on the other side). */
function leftoverPartitionSpans(
  partitions: InteriorLayout['partitions'],
  columns: InteriorLayout['columns'],
): { startX: number; endX: number; offsetMm: number }[] {
  if (partitions.length === 0) return []
  const measured = partitions.map((p) => {
    const a = Math.min(p.startX, p.endX)
    const b = Math.max(p.startX, p.endX)
    return { a, b }
  })
  const alreadyMeasured = (x0: number, x1: number) => {
    const opening = x1 - x0
    if (opening <= 0) return true
    return measured.some((m) => {
      const overlap = Math.min(m.b, x1) - Math.max(m.a, x0)
      return overlap >= opening * 0.8
    })
  }
  return columns
    .filter((col) => col.innerW > 0.5 && !alreadyMeasured(col.x0, col.x1))
    .map((col) => ({ startX: col.x0, endX: col.x1, offsetMm: Math.round(col.innerW) }))
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
  fontSize: number
}) {
  const tick = Math.max(14, fontSize * 0.18)
  const stagger = Math.max(48, fontSize * 0.7)
  const sw = Math.max(5, Math.min(8, fontSize * 0.045))
  const spans = [
    ...partitions.map((p, i) => ({ startX: p.startX, endX: p.endX, offsetMm: p.offsetMm, row: i })),
    ...leftovers.map((p) => ({ ...p, row: 0 })),
  ]
  const depth = (x: number) => zAtX?.(x) ?? z
  return (
    <>
      {spans.map((p, i) => {
        const yy = y - p.row * stagger
        const za = depth(p.startX)
        const zb = depth(p.endX)
        const a = cam.proj(innerLeft + p.startX, yy, za)
        const b = cam.proj(innerLeft + p.endX, yy, zb)
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
}) {
  const gap = DOOR_GAP_X
  const items: ReactNode[] = []
  const frontFaces = { front: true, top: true, right: true } as const

  const pushHeightLabel = (id: string, x: number, y: number, w: number, h: number) => {
    if (!(h > 24 && w > 40)) return
    const pt = cam.proj(x + w / 2, y + h / 2, z)
    const fontSize = Math.max(22, Math.min(h * 0.28, w * 0.14, 52))
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
    const x = zone.frontWidth > 0 ? T + zone.frontX0 : 0
    const w = zone.frontWidth > 0 ? zone.frontWidth : W
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
  showFronts,
}: {
  p: KitchenBaseParams
  m: ReturnType<typeof measureCarcass>
  layout: InteriorLayout
  showDimLines: boolean
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

  const font = Math.max(72, Math.min(W, H) * 0.13)
  const railFont = Math.max(48, Math.min(R * 0.5, m.railLength * 0.1))
  const legFont = Math.max(40, font * 0.55)
  const padL = font + 48
  const padT = font + Math.abs(dy) + 28
  const padR = 48
  const leftovers = leftoverPartitionSpans(layout.partitions, layout.columns)
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

      {drawerSlideStacks(layout, {
        innerFloorY,
        carcassTopY: topY,
        carcassBotY: botY,
        thickness: T,
      }).flatMap((src) =>
        src.heights.map((frontH, i) => {
          const rails = drawerBoxRails(
            p.width,
            p.thickness,
            frontH,
            p.slideLength,
            isSoftCloseSlide(p.slideKind),
          )
          if (!rails) return null
          const z0 = SLIDE_FRONT_INSET
          const z1 = z0 + p.slideLength
          const yBot = drawerFrontTopY(src.box, src.doorCount, src.heights, i) + rails.outer.height
          const yTopS = yBot - SLIDE_PROFILE_H
          const a0 = view.proj(T, yTopS, z0)
          const a1 = view.proj(T, yTopS, z1)
          const b0 = view.proj(T, yBot, z0)
          const b1 = view.proj(T, yBot, z1)
          const mid = view.proj(T, yTopS, z0 + p.slideLength / 2)
          const slideFont = Math.max(32, Math.min(p.slideLength * 0.1, 56))
          return (
            <g key={`slide-${src.id}-${i}`}>
              <g stroke={SLIDE_STROKE_COLOR} fill="none" strokeWidth={SLIDE_STROKE} strokeLinecap="butt">
                <line x1={a0.x} y1={a0.y} x2={a1.x} y2={a1.y} />
                <line x1={b0.x} y1={b0.y} x2={b1.x} y2={b1.y} />
              </g>
              {i === 0 && (
                <DimText x={mid.x + 18} y={mid.y - 8} label={mm(p.slideLength)} fontSize={slideFont} fill={SLIDE_STROKE_COLOR} />
              )}
            </g>
          )
        }),
      )}

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
        />
      )}

      {layout.shelves.length > 0 && (
        <FixedShelfDimLines
          shelves={layout.shelves}
          columns={layout.columns}
          innerFloorY={innerFloorY}
          worldX0={T + Math.max(28, font * 0.32)}
          fontSize={railFont}
          cam={view}
        />
      )}
      <MovableShelfDimLines
        zones={layout.zones}
        innerFloorY={innerFloorY}
        worldX0={T + Math.max(28, font * 0.32)}
        fontSize={railFont}
        cam={view}
        shelfZ={zShelfFront}
      />
      <ClothesRailDimLines
        zones={layout.zones}
        innerFloorY={innerFloorY}
        worldX0={T + Math.max(28, font * 0.32)}
        fontSize={railFont}
        cam={view}
        railZ={clothesZ}
      />
      {layout.partitions.length > 0 && (
        <PartitionDimLines
          partitions={layout.partitions}
          leftovers={leftovers}
          cam={view}
          innerLeft={T}
          y={innerFloorY - Math.max(44, railFont * 0.4)}
          anchorY={innerFloorY}
          fontSize={railFont}
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
  showFronts,
}: {
  params: Record<string, unknown>
  className?: string
  showDimLines: boolean
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
  showFronts,
  bottomHole,
  shelfHole,
}: {
  p: KitchenWallParams
  m: ReturnType<typeof measureCarcass>
  layout: InteriorLayout
  showDimLines: boolean
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
  const font = Math.max(72, Math.min(W, H) * 0.13)
  const small = Math.max(48, font * 0.55)
  const padL = font + 48
  const padT = font + Math.abs(dy) + 28
  const padR = 48
  const leftovers = leftoverPartitionSpans(layout.partitions, layout.columns)
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
        />
      )}

      {layout.shelves.length > 0 && (
        <FixedShelfDimLines
          shelves={layout.shelves}
          columns={layout.columns}
          innerFloorY={innerFloorY}
          worldX0={T + Math.max(28, font * 0.32)}
          fontSize={small}
          cam={view}
        />
      )}
      <MovableShelfDimLines
        zones={layout.zones}
        innerFloorY={innerFloorY}
        worldX0={T + Math.max(28, font * 0.32)}
        fontSize={small}
        cam={view}
        shelfZ={zShelfFront}
      />
      <ClothesRailDimLines
        zones={layout.zones}
        innerFloorY={innerFloorY}
        worldX0={T + Math.max(28, font * 0.32)}
        fontSize={small}
        cam={view}
        railZ={clothesZ}
      />
      {layout.partitions.length > 0 && (
        <PartitionDimLines
          partitions={layout.partitions}
          leftovers={leftovers}
          cam={view}
          innerLeft={T}
          y={innerFloorY - Math.max(44, small * 0.4)}
          anchorY={innerFloorY}
          fontSize={small}
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

function Drawer3DView({ p, box }: { p: { thickness: number; colors: { side: string } }; box: DrawerBoxRails }) {
  const T = p.thickness
  const Wd = box.drawerOuterW
  const Hd = box.outer.height
  const Dd = box.outer.width
  const Wi = box.inner.width
  const Hi = box.inner.height
  const innerY = Hd - Hi

  const hint = createDrawCam({ ox: 0, oy: 0 })
  const { x: dx, y: dy } = hint.depthDelta(Dd)

  const font = Math.max(40, Math.min(Wd, Hd) * 0.18)
  const small = Math.max(32, font * 0.7)
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
  showFronts,
}: {
  typeId: 'nightstand' | 'section' | 'wardrobe'
  params: Record<string, unknown>
  className?: string
  showDimLines: boolean
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
          <PlinthBoxFront3DView p={p} topInner={topInner} layout={layout} showDimLines={showDimLines} showFronts={showFronts} />
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
  showFronts,
}: {
  p: NightstandParams
  topInner: boolean
  layout: InteriorLayout
  showDimLines: boolean
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

  const font = Math.max(72, Math.min(W, H) * 0.13)
  const small = Math.max(40, font * 0.55)
  const tallCabinet = H >= 1800
  const supportFont = Math.max(30, Math.min(tallCabinet ? 46 : 48, small * 0.58))
  const supportGap = Math.max(34, supportFont * 0.75)
  const padL = font + 48
  const padT = font + Math.abs(dy) + 28
  const padR = 48
  const leftovers = leftoverPartitionSpans(layout.partitions, layout.columns)
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

      {drawerSlideStacks(layout, {
        innerFloorY,
        carcassTopY: frontTopY,
        carcassBotY: frontBotY,
        thickness: T,
      }).flatMap((src) =>
        src.heights.map((frontH, i) => {
          const rails = drawerBoxRails(
            p.width,
            p.thickness,
            frontH,
            p.slideLength,
            isSoftCloseSlide(p.slideKind),
          )
          if (!rails) return null
          const z0 = zSide + SLIDE_FRONT_INSET
          const z1 = z0 + p.slideLength
          const yBot = drawerFrontTopY(src.box, src.doorCount, src.heights, i) + rails.outer.height
          const yTopS = yBot - SLIDE_PROFILE_H
          const a0 = view.proj(T, yTopS, z0)
          const a1 = view.proj(T, yTopS, z1)
          const b0 = view.proj(T, yBot, z0)
          const b1 = view.proj(T, yBot, z1)
          const mid = view.proj(T, yTopS, z0 + p.slideLength / 2)
          const slideFont = Math.max(32, Math.min(p.slideLength * 0.1, 56))
          return (
            <g key={`slide-${src.id}-${i}`}>
              <g stroke={SLIDE_STROKE_COLOR} fill="none" strokeWidth={SLIDE_STROKE} strokeLinecap="butt">
                <line x1={a0.x} y1={a0.y} x2={a1.x} y2={a1.y} />
                <line x1={b0.x} y1={b0.y} x2={b1.x} y2={b1.y} />
              </g>
              {i === 0 && (
                <DimText x={mid.x + 18} y={mid.y - 8} label={mm(p.slideLength)} fontSize={slideFont} fill={SLIDE_STROKE_COLOR} />
              )}
            </g>
          )
        }),
      )}

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
        />
      )}

      {layout.shelves.length > 0 && (
        <FixedShelfDimLines
          shelves={layout.shelves}
          columns={layout.columns}
          innerFloorY={innerFloorY}
          worldX0={T + Math.max(28, font * 0.32)}
          fontSize={small}
          cam={view}
          originZ={m.sliding ? zShelfFront : zSide}
          shelfZ={m.sliding ? zShelfFront : zSide}
        />
      )}
      <MovableShelfDimLines
        zones={layout.zones}
        innerFloorY={innerFloorY}
        worldX0={T + Math.max(28, font * 0.32)}
        fontSize={small}
        cam={view}
        originZ={zSide}
        shelfZ={zShelfFront}
      />
      <ClothesRailDimLines
        zones={layout.zones}
        innerFloorY={innerFloorY}
        worldX0={T + Math.max(28, font * 0.32)}
        fontSize={small}
        cam={view}
        originZ={zSide}
        railZ={clothesZ}
      />
      {layout.partitions.length > 0 && (
        <PartitionDimLines
          partitions={layout.partitions}
          leftovers={leftovers}
          cam={view}
          innerLeft={T}
          y={innerFloorY - (m.sliding ? SLIDING_BOTTOM_TRACK_MM : 0) - Math.max(44, small * 0.4)}
          anchorY={innerFloorY}
          z={zPartition}
          zAtX={(x) =>
            layout.partitions.some((part) => x >= part.xLeft - 0.51 && x <= part.xRight + 0.51)
              ? zPartition
              : zSide
          }
          fontSize={small}
        />
      )}

      <DimText x={heightX} y={heightY} label={mm(H)} fontSize={font} rotate={-90} />
      <DimText x={depthMx} y={depthMy} label={mm(D)} fontSize={font} rotate={depthRot} />
      <DimText x={backMx} y={backMy} label={mm(W)} fontSize={font} />
      <DimText x={sideDepthLabel.x + 10} y={sideDepthLabel.y} label={mm(m.sideD)} fontSize={small} rotate={depthRot} />
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
