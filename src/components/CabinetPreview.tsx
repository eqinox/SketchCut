import React, { type ReactNode } from 'react'
import { evenShelfBottoms, KITCHEN_BASE_JOINERY, measureCarcass } from '@/lib/cabinets/joinery'
import {
  parseKitchenBaseParams,
  parseNightstandParams,
  parseSectionParams,
  measureNightstand,
  DEFAULT_SHELF_FRONT_INSET,
  DEFAULT_HARDBOARD_COLOR,
  drawerBoxRails,
  isSoftCloseSlide,
  DOOR_GAP_X,
  layoutInterior,
  layoutCounts,
  allDrawerFrontHeights,
  zoneFrontBox,
  stackFronts,
  type KitchenBaseParams,
  type NightstandParams,
  type DrawerBoxRails,
  type InteriorLayout,
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
  if (typeId === 'nightstand' || typeId === 'section') {
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
    innerH: m.innerH,
    thickness: p.thickness,
    fixedShelves: p.fixedShelves,
    doorSpan: p.doorSpan,
    doorCount: p.doorCount,
    shelfCount: p.shelfCount,
    drawerFrontHeights: p.drawerFrontHeights,
    cutFromOneBoard: p.cutFromOneBoard,
    hasClothesRail: p.hasClothesRail,
    zones: p.zones,
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
        <span className="mr-3" style={{ color: colors.rail }}>■ Бленди</span>
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

/** Always-on height for a fixed shelf: from the chosen carcass face to the chosen shelf face. */
function FixedShelfDimLines({
  shelves,
  innerFloorY,
  dimX,
  fontSize,
}: {
  shelves: InteriorLayout['shelves']
  innerFloorY: number
  dimX: number
  fontSize: number
}) {
  const tick = Math.max(12, fontSize * 0.22)
  return (
    <>
      {shelves.map((s, i) => {
        const y1 = innerFloorY - s.startY
        const y2 = innerFloorY - s.endY
        const x = dimX + i * Math.max(36, fontSize * 0.5)
        const midY = (y1 + y2) / 2
        return (
          <g key={`fixed-dim-${i}`} stroke={DRAW_DIM} fill={DRAW_DIM}>
            <line x1={x - tick} y1={y1} x2={x + tick} y2={y1} strokeWidth={2} />
            <line x1={x - tick} y1={y2} x2={x + tick} y2={y2} strokeWidth={2} />
            <DimLine x1={x} y1={y1} x2={x} y2={y2} />
            <DimText x={x} y={midY} label={mm(s.offsetMm)} fontSize={fontSize} rotate={-90} fill={DRAW_DIM} />
          </g>
        )
      })}
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

  const pushDoors = (y: number, h: number, count: 1 | 2, key: string, label: boolean) => {
    if (!(h > 4)) return
    if (count === 1) {
      items.push(
        <Board
          key={key}
          x={0}
          y={y}
          z={z}
          w={W}
          h={h}
          d={d}
          color={FRONT_FILL}
          cam={cam}
          faces={frontFaces}
          opacity={0.92}
        />,
      )
      if (label) pushHeightLabel(`${key}-h`, 0, y, W, h)
      return
    }
    const dw = (W - gap) / 2
    items.push(
      <Board
        key={`${key}-l`}
        x={0}
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
        x={dw + gap}
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
      pushHeightLabel(`${key}-lh`, 0, y, dw, h)
      pushHeightLabel(`${key}-rh`, dw + gap, y, dw, h)
    }
  }

  const pushStacked = (
    box: { y: number; h: number },
    doorCount: 0 | 1 | 2,
    drawerFrontHeights: number[],
    key: string,
  ) => {
    const stacked = stackFronts({
      frontHeight: box.h,
      doorCount,
      drawerFrontHeights,
    })
    const label = stacked.length >= 2
    for (const s of stacked) {
      const y = box.y + s.yFromFrontTop
      if (s.kind === 'drawer') {
        items.push(
          <Board
            key={`df-${key}-${s.index}`}
            x={0}
            y={y}
            z={z}
            w={W}
            h={s.height}
            d={d}
            color={FRONT_FILL}
            cam={cam}
            faces={frontFaces}
            opacity={0.92}
          />,
        )
        if (label) pushHeightLabel(`df-${key}-${s.index}-h`, 0, y, W, s.height)
      } else if (s.doorCount === 1 || s.doorCount === 2) {
        pushDoors(y, s.height, s.doorCount, `door-${key}`, label)
      }
    }
  }

  if (layout.fullDoorCount > 0 || layout.fullDrawerFrontHeights.length > 0) {
    pushStacked(
      { y: carcassTopY, h: carcassBotY - carcassTopY },
      layout.fullDoorCount,
      layout.fullDrawerFrontHeights,
      'full',
    )
  }

  for (const zone of layout.zones) {
    if (zone.doorCount === 0 && zone.drawerFrontHeights.length === 0) continue
    const box = zoneFrontBox(zone, { innerFloorY, carcassTopY, carcassBotY, thickness: T })
    pushStacked(box, zone.doorCount, zone.drawerFrontHeights, zone.id)
  }

  return <>{items}</>
}

function ViewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-2">
      <p className="mb-1 text-center text-[11px] font-medium text-[var(--color-muted-foreground)]">{title}</p>
      <div className="flex flex-1 items-center justify-center overflow-hidden">{children}</div>
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
  const { x: dxR, y: dyR } = cam.depthDelta(R)

  const font = Math.max(72, Math.min(W, H) * 0.13)
  const railFont = Math.max(48, Math.min(R * 0.5, m.railLength * 0.1))
  const legFont = Math.max(40, font * 0.55)
  const padL = font + 48
  const padT = font + Math.abs(dy) + 28
  const padR = 48
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
  const railX = ox + T + m.railLength / 2 + dxR / 2
  const railY = topY + dyR / 2 + T * 0.15
  const legLabelX = ox + legInset + legW / 2
  const legLabelY = floor - L / 2
  const sideLabelX = ox + W + dx / 2
  const sideLabelY = (topY + floor - L - T) / 2 + dy / 2

  const xInnerL = T
  const zRailFront = D - R
  const zBack = D
  const zShelfFront = DEFAULT_SHELF_FRONT_INSET
  const shelfDepth = D - zShelfFront
  const innerFloorY = floor - L - T
  const adjShelfOffs = layout.zones.flatMap((z) =>
    evenShelfBottoms(z.innerH, z.shelfCount, T).map((off) => z.y0 + off),
  )
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

      {layout.shelves.map((s, i) => (
        <Board
          key={`fixed-${i}`}
          x={xInnerL}
          y={innerFloorY - s.yTop}
          z={0}
          w={m.innerW}
          h={T}
          d={D}
          color={wood.shelf}
          cam={view}
          faces={BETWEEN_FACES}
        />
      ))}

      {layout.zones.flatMap((z) =>
        evenShelfBottoms(z.innerH, z.shelfCount, T).map((off, i) => (
          <Board
            key={`shelf-${z.id}-${i}`}
            x={xInnerL}
            y={innerFloorY - (z.y0 + off) - T}
            z={zShelfFront}
            w={m.innerW}
            h={T}
            d={shelfDepth}
            color={wood.shelf}
            cam={view}
            faces={BETWEEN_FACES}
          />
        )),
      )}

      {layout.zones.map(
        (z) =>
          z.hasClothesRail && (
            <Board
              key={`rail-${z.id}`}
              x={xInnerL}
              y={innerFloorY - z.y1 + 48}
              z={Math.max(40, D * 0.35)}
              w={m.innerW}
              h={22}
              d={22}
              color={CLOTHES_RAIL_COLOR}
              cam={view}
              faces={BETWEEN_FACES}
            />
          ),
      )}

      <Board
        x={xInnerL}
        y={topY}
        z={zRailFront}
        w={m.railLength}
        h={T}
        d={R}
        color={wood.rail}
        cam={view}
        faces={BETWEEN_FACES}
      />

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

      <Board
        x={T}
        y={topY}
        w={m.railLength}
        h={T}
        d={R}
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
          carcassBotY={botY}
          z={0}
          d={T}
          cam={view}
        />
      )}

      {layout.shelves.length > 0 && (
        <FixedShelfDimLines
          shelves={layout.shelves}
          innerFloorY={innerFloorY}
          dimX={ox + T + Math.max(28, font * 0.32)}
          fontSize={railFont}
        />
      )}

      <DimText x={heightX} y={heightY} label={mm(H)} fontSize={font} rotate={-90} />
      <DimText x={depthMx} y={depthMy} label={mm(D)} fontSize={font} rotate={depthRot} />
      <DimText x={backMx} y={backMy} label={mm(W)} fontSize={font} />
      <DimText x={railX} y={railY} label={mm(m.railLength)} fontSize={railFont} />
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
  typeId: 'nightstand' | 'section'
  params: Record<string, unknown>
  className?: string
  showDimLines: boolean
  showFronts: boolean
}) {
  const topInner = typeId === 'section'
  const p = topInner ? parseSectionParams(params) : parseNightstandParams(params)
  const m = measureNightstand(p, topInner)
  const { colors } = p
  const layout = layoutInterior({
    innerH: m.innerH,
    thickness: p.thickness,
    fixedShelves: p.fixedShelves,
    doorSpan: p.doorSpan,
    doorCount: p.doorCount,
    shelfCount: p.shelfCount,
    drawerFrontHeights: p.drawerFrontHeights,
    cutFromOneBoard: p.cutFromOneBoard,
    hasClothesRail: p.hasClothesRail,
    zones: p.zones,
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
        <span className="mr-3" style={{ color: colors.rail }}>■ Плот</span>
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
        {showFronts && (counts.doorCount > 0 || counts.drawerCount > 0) && (
          <span className="mr-3" style={{ color: FRONT_FILL }}> ■ Врати и чела</span>
        )}
        {!showFronts && counts.doorCount > 0 && (
          <>
            {' · '}
            {counts.doorCount === 1 ? '1 врата' : `${counts.doorCount} врати`} (включи ги с отметката)
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
          ? 'страниците външни на дъното и плота, плотът между тях'
          : 'страниците външни на дъното, плотът външен върху страниците, ъгълчета отвътре'}
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
  const padL = font + 48
  const padT = font + Math.abs(dy) + 28
  const padR = 48
  const padB = 36

  const vbW = padL + W + dx + padR
  const vbH = padT + H + padB
  const ox = padL
  const floor = padT + H
  const topY = floor - H
  const sideY = topInner ? topY : topY + T
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
  const supportLabelX = ox + T + 36
  const supportLabelY = floor - supportH / 2

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

  const zShelfFront = zSide + DEFAULT_SHELF_FRONT_INSET
  const shelfDepth = m.sideD - DEFAULT_SHELF_FRONT_INSET
  const innerFloorY = bottomY
  const carcassBotY = floor - supportH

  const leftInnerH = Math.max(T, bottomY - (topInner ? topY + T : sideY))
  const leftInnerY = topInner ? topY + T : sideY

  return (
    <SketchSvg vbW={vbW} vbH={vbH} height={460} label={topInner ? 'Секция 3D' : 'Нощно шкафче 3D'}>
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
      {topInner && (
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

      {layout.shelves.map((s, i) => (
        <Board
          key={`fixed-${i}`}
          x={T}
          y={innerFloorY - s.yTop}
          z={zSide}
          w={m.innerW}
          h={T}
          d={m.sideD}
          color={wood.shelf}
          cam={view}
          faces={BETWEEN_FACES}
        />
      ))}

      {layout.zones.flatMap((z) =>
        evenShelfBottoms(z.innerH, z.shelfCount, T).map((off, i) => (
          <Board
            key={`shelf-${z.id}-${i}`}
            x={T}
            y={innerFloorY - (z.y0 + off) - T}
            z={zShelfFront}
            w={m.innerW}
            h={T}
            d={shelfDepth}
            color={wood.shelf}
            cam={view}
            faces={BETWEEN_FACES}
          />
        )),
      )}

      {layout.zones.map(
        (z) =>
          z.hasClothesRail && (
            <Board
              key={`rail-${z.id}`}
              x={T}
              y={innerFloorY - z.y1 + 50}
              z={zSide + Math.min(80, m.sideD * 0.4)}
              w={m.innerW}
              h={22}
              d={22}
              color={CLOTHES_RAIL_COLOR}
              cam={view}
              faces={BETWEEN_FACES}
            />
          ),
      )}

      {drawerSlideStacks(layout, {
        innerFloorY,
        carcassTopY: topY,
        carcassBotY,
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
        faces={SIDE_RIGHT}
      />

      {!topInner && (
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
      )}

      {showFronts && (
        <FrontsOnCabinet
          layout={layout}
          W={W}
          T={T}
          innerFloorY={innerFloorY}
          carcassTopY={topY}
          carcassBotY={carcassBotY}
          z={0}
          d={T}
          cam={view}
        />
      )}

      {layout.shelves.length > 0 && (
        <FixedShelfDimLines
          shelves={layout.shelves}
          innerFloorY={innerFloorY}
          dimX={ox + T + Math.max(28, font * 0.32)}
          fontSize={small}
        />
      )}

      <DimText x={heightX} y={heightY} label={mm(H)} fontSize={font} rotate={-90} />
      <DimText x={depthMx} y={depthMy} label={mm(D)} fontSize={font} rotate={depthRot} />
      <DimText x={backMx} y={backMy} label={mm(W)} fontSize={font} />
      <DimText x={sideDepthLabel.x + 10} y={sideDepthLabel.y} label={mm(m.sideD)} fontSize={small} rotate={depthRot} />
      <DimText x={bottomFrontLabel.x} y={bottomFrontLabel.y} label={mm(m.bottomW)} fontSize={small} />
      <DimText x={supportLabelX} y={supportLabelY} label={mm(supportH)} fontSize={small} rotate={-90} />

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
