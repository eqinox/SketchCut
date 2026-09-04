import React, { type ReactNode } from 'react'
import { evenShelfBottoms, KITCHEN_BASE_JOINERY, measureCarcass } from '@/lib/cabinets/joinery'
import {
  parseKitchenBaseParams,
  DEFAULT_SHELF_FRONT_INSET,
  DEFAULT_HARDBOARD_COLOR,
  drawerBoxRails,
  isSoftCloseSlide,
  DRAWER_DOOR_GAP,
  type KitchenBaseParams,
  type DrawerBoxRails,
} from '@/lib/cabinets'
import {
  BETWEEN_FACES,
  Board,
  BOX_FACES,
  DimLine,
  DimText,
  DRAW_STROKE,
  SIDE_LEFT_BODY,
  SIDE_LEFT_TOP,
  SIDE_RIGHT,
  SketchSvg,
  createDrawCam,
} from '@/lib/cabinets/draw-3d'
import { cn } from '@/lib/utils'

interface CabinetPreviewProps {
  params: Record<string, unknown>
  className?: string
  /** Extension lines and arrows. Off by default — sizes sit next to the panels. */
  showDimLines?: boolean
}

const SLIDE_STROKE_COLOR = DRAW_STROKE
const SLIDE_PROFILE_H = 18
const SLIDE_FRONT_INSET = 28
const SLIDE_STROKE = 10

function mm(n: number) {
  return `${Math.round(n)}`
}

/** Single 3D front view with depth extending to the right. */
export function CabinetPreview({ params, className, showDimLines = false }: CabinetPreviewProps) {
  const p = parseKitchenBaseParams(params)
  const m = measureCarcass(
    { width: p.width, height: p.height, depth: p.depth, thickness: p.thickness },
    KITCHEN_BASE_JOINERY,
  )
  const { colors } = p
  const drawerViews = uniqueDrawerViews(p)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ViewCard title="3D Изглед отпред">
        <ZoomableView>
          <Front3DView p={p} m={m} showDimLines={showDimLines} />
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
        {p.shelfCount > 0 && (
          <span className="mr-3" style={{ color: colors.shelf }}>■ Рафтове</span>
        )}
        {p.hasBack && (
          <span className="mr-3" style={{ color: DEFAULT_HARDBOARD_COLOR }}>■ Фазер</span>
        )}
        {drawerViews.length > 0 && (
          <span className="mr-3" style={{ color: SLIDE_STROKE_COLOR }}>■ Водачи</span>
        )}
        <span style={{ color: colors.leg }}>■ Крачета</span>
        {p.doorCount > 0 && (
          <>
            {' · '}
            {p.doorCount === 1 ? '1 врата' : '2 врати'} (не са на чертежа)
          </>
        )}
        {p.drawerFrontHeights.length > 0 && (
          <>
            {' · '}
            {p.drawerFrontHeights.length === 1
              ? '1 чекмедже'
              : `${p.drawerFrontHeights.length} чекмеджета`}{' '}
            (челата не са на чертежа)
          </>
        )}
        {' · '}страниците сядат върху дъното, винтове отдолу
      </p>
    </div>
  )
}

function uniqueDrawerViews(p: KitchenBaseParams): { frontHeight: number; box: DrawerBoxRails; count: number }[] {
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
  showDimLines,
}: {
  p: KitchenBaseParams
  m: ReturnType<typeof measureCarcass>
  showDimLines: boolean
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
  const xInnerR = W - T
  const zRailFront = D - R
  const zBack = D
  const zShelfFront = DEFAULT_SHELF_FRONT_INSET
  const shelfDepth = D - zShelfFront
  const shelfOffs = evenShelfBottoms(m.innerH, p.shelfCount, T)
  const topShelfOff = shelfOffs.length > 0 ? shelfOffs[shelfOffs.length - 1] : 0
  const shelfLabelPt =
    shelfOffs.length > 0
      ? view.proj(W / 2, floor - L - T - topShelfOff - T, zShelfFront + shelfDepth / 2)
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
          x={xInnerL}
          y={topY}
          z={zBack}
          w={xInnerR - xInnerL}
          h={sideH}
          d={1}
          color={DEFAULT_HARDBOARD_COLOR}
          cam={view}
          faces={{ front: true }}
          strokeWidth={0.8}
        />
      )}

      <Board x={0} y={sideY} w={T} h={sideH} d={D} color={wood.side} cam={view} faces={SIDE_LEFT_BODY} />

      {shelfOffs.map((off, i) => {
        const yBot = floor - L - T - off
        const yTop = yBot - T
        return (
          <Board
            key={`shelf-${i}`}
            x={xInnerL}
            y={yTop}
            z={zShelfFront}
            w={m.innerW}
            h={T}
            d={shelfDepth}
            color={wood.shelf}
            cam={view}
            faces={BETWEEN_FACES}
          />
        )
      })}

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

      {p.drawerFrontHeights.map((frontH, i) => {
          const box = drawerBoxRails(
            p.width,
            p.thickness,
            frontH,
            p.slideLength,
            isSoftCloseSlide(p.slideKind),
          )
          if (!box) return null
          let offset = 0
          for (let j = 0; j < i; j++) offset += p.drawerFrontHeights[j] + DRAWER_DOOR_GAP
          const z0 = SLIDE_FRONT_INSET
          const z1 = z0 + p.slideLength
          const yBot = topY + T + offset + box.outer.height
          const yTopS = yBot - SLIDE_PROFILE_H
          const a0 = view.proj(T, yTopS, z0)
          const a1 = view.proj(T, yTopS, z1)
          const b0 = view.proj(T, yBot, z0)
          const b1 = view.proj(T, yBot, z1)
          const mid = view.proj(T, yTopS, z0 + p.slideLength / 2)
          const slideFont = Math.max(32, Math.min(p.slideLength * 0.1, 56))
          return (
            <g key={`slide-${i}`}>
              <g stroke={SLIDE_STROKE_COLOR} fill="none" strokeWidth={SLIDE_STROKE} strokeLinecap="butt">
                <line x1={a0.x} y1={a0.y} x2={a1.x} y2={a1.y} />
                <line x1={b0.x} y1={b0.y} x2={b1.x} y2={b1.y} />
              </g>
              {i === 0 && (
                <DimText x={mid.x + 18} y={mid.y - 8} label={mm(p.slideLength)} fontSize={slideFont} fill={SLIDE_STROKE_COLOR} />
              )}
            </g>
          )
        })}

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

function Drawer3DView({ p, box }: { p: KitchenBaseParams; box: DrawerBoxRails }) {
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
