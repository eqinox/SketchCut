import React, { type ReactNode } from 'react'
import { evenShelfBottoms, KITCHEN_BASE_JOINERY, measureCarcass } from '@/lib/cabinets/joinery'
import { parseKitchenBaseParams, partFaces, DEFAULT_SHELF_FRONT_INSET, DEFAULT_HARDBOARD_COLOR, type KitchenBaseParams } from '@/lib/cabinets'
import { cn } from '@/lib/utils'

interface CabinetPreviewProps {
  params: Record<string, unknown>
  className?: string
  /** Extension lines and arrows. Off by default — sizes sit next to the panels. */
  showDimLines?: boolean
}

const DIM = '#60a5fa'

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

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ViewCard title="3D Изглед отпред">
        <ZoomableView>
          <Front3DView p={p} m={m} showDimLines={showDimLines} />
        </ZoomableView>
      </ViewCard>
      <p className="text-center text-[11px] text-[var(--color-muted-foreground)]">
        <span className="mr-3" style={{ color: colors.bottom }}>■ Дъно</span>
        <span className="mr-3" style={{ color: colors.side }}>■ Страници</span>
        <span className="mr-3" style={{ color: colors.rail }}>■ Царги</span>
        {p.shelfCount > 0 && (
          <span className="mr-3" style={{ color: colors.shelf }}>■ Рафтове</span>
        )}
        {p.hasBack && (
          <span className="mr-3" style={{ color: DEFAULT_HARDBOARD_COLOR }}>■ Фазер</span>
        )}
        <span style={{ color: colors.leg }}>■ Крачета</span>
        {p.doorCount > 0 && (
          <>
            {' · '}
            {p.doorCount === 1 ? '1 врата' : '2 врати'} (не са на чертежа)
          </>
        )}
        {' · '}страниците сядат върху дъното, винтове отдолу
      </p>
    </div>
  )
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

  const depthScale = 0.5
  const depthAngle = 30
  const dx = D * depthScale * Math.cos((depthAngle * Math.PI) / 180)
  const dy = -D * depthScale * Math.sin((depthAngle * Math.PI) / 180)

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

  const legW = Math.max(18, T * 1.2)
  const legInset = Math.max(28, W * 0.08)

  const dxR = R * depthScale * Math.cos((depthAngle * Math.PI) / 180)
  const dyR = -R * depthScale * Math.sin((depthAngle * Math.PI) / 180)

  const topY = floor - L - H
  const botY = floor - L
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

  const ang = (depthAngle * Math.PI) / 180
  const proj = (x: number, y: number, z: number) => ({
    x: ox + x + z * depthScale * Math.cos(ang),
    y: y + z * depthScale * -Math.sin(ang),
  })
  const poly = (...p: { x: number; y: number }[]) => p.map((pt) => `${pt.x},${pt.y}`).join(' ')

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
      ? proj(W / 2, floor - L - T - topShelfOff - T, zShelfFront + shelfDepth / 2)
      : null

  const bottomC = partFaces(p.colors.bottom)
  const sideC = partFaces(p.colors.side)
  const railC = partFaces(p.colors.rail)
  const shelfC = partFaces(p.colors.shelf)
  const legC = p.colors.leg

  return (
    <svg 
      viewBox={`0 0 ${vbW} ${vbH}`} 
      className="w-full select-none" 
      style={{
        height: '460px',
      }} 
      role="img" 
      aria-label="3D изглед отпред"
    >
      <defs>
        <filter id="shadow">
          <feDropShadow dx="1" dy="1" stdDeviation="1.5" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* === LEGS (only 2 front ones) === */}
      {/* Left front leg */}
      <g filter="url(#shadow)">
        <polygon
          points={`${ox + legInset},${floor - L} ${ox + legInset + legW},${floor - L} ${ox + legInset + legW},${floor} ${ox + legInset},${floor}`}
          fill={legC}
          stroke="#1e293b"
          strokeWidth={1}
        />
      </g>
      {/* Right front leg */}
      <g filter="url(#shadow)">
        <polygon
          points={`${ox + W - legInset - legW},${floor - L} ${ox + W - legInset},${floor - L} ${ox + W - legInset},${floor} ${ox + W - legInset - legW},${floor}`}
          fill={legC}
          stroke="#1e293b"
          strokeWidth={1}
        />
      </g>

      {/* === BOTTOM (full width, full depth - sides will sit on it) === */}
      <polygon
        points={`${ox},${floor - L - T} ${ox + W},${floor - L - T} ${ox + W},${floor - L} ${ox},${floor - L}`}
        fill={bottomC.front}
        stroke="#1e293b"
        strokeWidth={1.2}
      />
      <polygon
        points={`${ox},${floor - L - T} ${ox + dx},${floor - L - T + dy} ${ox + W + dx},${floor - L - T + dy} ${ox + W},${floor - L - T}`}
        fill={bottomC.top}
        stroke="#1e293b"
        strokeWidth={1}
      />
      <polygon
        points={`${ox + W},${floor - L - T} ${ox + W + dx},${floor - L - T + dy} ${ox + W + dx},${floor - L + dy} ${ox + W},${floor - L}`}
        fill={bottomC.side}
        stroke="#1e293b"
        strokeWidth={1}
      />

      {p.hasBack && (
        <polygon
          points={poly(
            proj(xInnerL, topY, zBack),
            proj(xInnerR, topY, zBack),
            proj(xInnerR, floor - L - T, zBack),
            proj(xInnerL, floor - L - T, zBack),
          )}
          fill={partFaces(DEFAULT_HARDBOARD_COLOR).front}
          stroke="#1e293b"
          strokeWidth={0.8}
        />
      )}

      {/* === LEFT SIDE (sits on bottom) === */}
      <polygon
        points={`${ox},${floor - L - H} ${ox + T},${floor - L - H} ${ox + T},${floor - L - T} ${ox},${floor - L - T}`}
        fill={sideC.front}
        stroke="#1e293b"
        strokeWidth={1.2}
      />
      <polygon
        points={`${ox + T},${floor - L - H} ${ox + T + dx},${floor - L - H + dy} ${ox + T + dx},${floor - L - T + dy} ${ox + T},${floor - L - T}`}
        fill={sideC.side}
        stroke="#1e293b"
        strokeWidth={1}
      />

      {shelfOffs.map((off, i) => {
        const yBot = floor - L - T - off
        const yTop = yBot - T
        return (
          <g key={`shelf-${i}`}>
            <polygon
              points={poly(
                proj(xInnerL, yTop, zShelfFront),
                proj(xInnerR, yTop, zShelfFront),
                proj(xInnerR, yBot, zShelfFront),
                proj(xInnerL, yBot, zShelfFront),
              )}
              fill={shelfC.front}
              stroke="#1e293b"
              strokeWidth={1}
            />
            <polygon
              points={poly(
                proj(xInnerL, yTop, zShelfFront),
                proj(xInnerR, yTop, zShelfFront),
                proj(xInnerR, yTop, zBack),
                proj(xInnerL, yTop, zBack),
              )}
              fill={shelfC.top}
              stroke="#1e293b"
              strokeWidth={1}
            />
          </g>
        )
      })}

      {/* === BACK RAIL — between the sides, 10 cm at the back, does not cover side kants === */}
      <polygon
        points={poly(
          proj(xInnerL, topY, zRailFront),
          proj(xInnerR, topY, zRailFront),
          proj(xInnerR, topY + T, zRailFront),
          proj(xInnerL, topY + T, zRailFront),
        )}
        fill={railC.front}
        stroke="#1e293b"
        strokeWidth={1}
      />
      <polygon
        points={poly(
          proj(xInnerL, topY, zRailFront),
          proj(xInnerR, topY, zRailFront),
          proj(xInnerR, topY, zBack),
          proj(xInnerL, topY, zBack),
        )}
        fill={railC.top}
        stroke="#1e293b"
        strokeWidth={1}
      />

      <polygon
        points={`${ox},${floor - L - H} ${ox + dx},${floor - L - H + dy} ${ox + T + dx},${floor - L - H + dy} ${ox + T},${floor - L - H}`}
        fill={sideC.top}
        stroke="#1e293b"
        strokeWidth={1.5}
      />

      {/* === RIGHT SIDE (sits on bottom) === */}
      <polygon
        points={`${ox + W - T},${floor - L - H} ${ox + W},${floor - L - H} ${ox + W},${floor - L - T} ${ox + W - T},${floor - L - T}`}
        fill={sideC.front}
        stroke="#1e293b"
        strokeWidth={1.2}
      />
      <polygon
        points={`${ox + W},${floor - L - H} ${ox + W + dx},${floor - L - H + dy} ${ox + W + dx},${floor - L - T + dy} ${ox + W},${floor - L - T}`}
        fill={sideC.side}
        stroke="#1e293b"
        strokeWidth={1.2}
      />
      <polygon
        points={`${ox + W - T},${floor - L - H} ${ox + W - T + dx},${floor - L - H + dy} ${ox + W + dx},${floor - L - H + dy} ${ox + W},${floor - L - H}`}
        fill={sideC.top}
        stroke="#1e293b"
        strokeWidth={1.5}
      />

      {/* === FRONT RAIL (inside between sides at top) === */}
      <polygon
        points={`${ox + T},${floor - L - H} ${ox + W - T},${floor - L - H} ${ox + W - T},${floor - L - H + T} ${ox + T},${floor - L - H + T}`}
        fill={railC.front}
        stroke="#1e293b"
        strokeWidth={1.2}
      />
      <polygon
        points={`${ox + T},${floor - L - H} ${ox + T + dxR},${floor - L - H + dyR} ${ox + W - T + dxR},${floor - L - H + dyR} ${ox + W - T},${floor - L - H}`}
        fill={railC.top}
        stroke="#1e293b"
        strokeWidth={1}
      />

      {/* === SIZES (no lines unless asked) === */}
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
    </svg>
  )
}

function DimText({
  x,
  y,
  label,
  fontSize,
  rotate = 0,
  fill = DIM,
}: {
  x: number
  y: number
  label: string
  fontSize: number
  rotate?: number
  fill?: string
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={fontSize}
      fontWeight="800"
      fill={fill}
      stroke="#0f172a"
      strokeWidth={Math.max(4, fontSize * 0.06)}
      paintOrder="stroke"
      strokeLinejoin="round"
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
    >
      {label}
    </text>
  )
}

function DimLine({
  x1,
  y1,
  x2,
  y2,
  color = DIM,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  color?: string
}) {
  const arrow = Math.min(14, Math.hypot(x2 - x1, y2 - y1) * 0.08)
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const ax = Math.cos(ang)
  const ay = Math.sin(ang)
  const px = -ay
  const py = ax
  return (
    <g stroke={color} fill={color}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={2.5} />
      <polygon
        points={`${x1},${y1} ${x1 + ax * arrow + px * arrow * 0.4},${y1 + ay * arrow + py * arrow * 0.4} ${x1 + ax * arrow - px * arrow * 0.4},${y1 + ay * arrow - py * arrow * 0.4}`}
      />
      <polygon
        points={`${x2},${y2} ${x2 - ax * arrow + px * arrow * 0.4},${y2 - ay * arrow + py * arrow * 0.4} ${x2 - ax * arrow - px * arrow * 0.4},${y2 - ay * arrow - py * arrow * 0.4}`}
      />
    </g>
  )
}
