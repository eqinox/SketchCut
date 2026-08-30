import React, { type ReactNode } from 'react'
import { KITCHEN_BASE_JOINERY, measureCarcass } from '@/lib/cabinets/joinery'
import { parseKitchenBaseParams, type KitchenBaseParams } from '@/lib/cabinets'
import { cn } from '@/lib/utils'

interface CabinetPreviewProps {
  params: Record<string, unknown>
  className?: string
}

const WOOD = '#c4a574'
const WOOD_DARK = '#a68554'
const WOOD_TOP = '#d4bc8e'
const RAIL = '#8fbc8f'
const LEG = '#334155'
const INK = '#94a3b8'
const DIM = '#60a5fa'

function mm(n: number) {
  return `${Math.round(n)}`
}

/** Single 3D front view with depth extending to the right. */
export function CabinetPreview({ params, className }: CabinetPreviewProps) {
  const p = parseKitchenBaseParams(params)
  const m = measureCarcass(
    { width: p.width, height: p.height, depth: p.depth, thickness: p.thickness },
    KITCHEN_BASE_JOINERY,
  )

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ViewCard title="3D Изглед отпред">
        <ZoomableView>
          <Front3DView p={p} m={m} />
        </ZoomableView>
      </ViewCard>
      <p className="text-center text-[11px] text-[var(--color-muted-foreground)]">
        <span className="mr-3" style={{ color: WOOD_DARK }}>■ Дъно</span>
        <span className="mr-3" style={{ color: WOOD }}>■ Страници</span>
        <span style={{ color: RAIL }}>■ Царги 10 см</span>
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
function Front3DView({ p, m }: { p: KitchenBaseParams; m: ReturnType<typeof measureCarcass> }) {
  const T = m.thickness
  const W = m.outerW
  const H = m.outerH
  const D = m.outerD
  const L = p.legHeight
  const R = p.railWidth

  const pad = 60
  const depthScale = 0.5
  const depthAngle = 30
  const dx = D * depthScale * Math.cos((depthAngle * Math.PI) / 180)
  const dy = -D * depthScale * Math.sin((depthAngle * Math.PI) / 180)

  const totalH = H + L
  const vbW = W + dx + pad * 2
  const vbH = totalH + Math.abs(dy) + pad * 2
  const ox = pad
  const floor = pad + totalH

  const legW = Math.max(18, T * 1.2)
  const legInset = Math.max(28, W * 0.08)

  const dxR = R * depthScale * Math.cos((depthAngle * Math.PI) / 180)
  const dyR = -R * depthScale * Math.sin((depthAngle * Math.PI) / 180)

  return (
    <svg 
      viewBox={`0 0 ${vbW} ${vbH}`} 
      className="w-full select-none" 
      style={{ 
        height: '400px'
      }} 
      role="img" 
      aria-label="3D изглед отпред"
    >
      <defs>
        <filter id="shadow">
          <feDropShadow dx="1" dy="1" stdDeviation="1.5" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Floor reference line */}
      <line x1={ox} y1={floor} x2={ox + W + dx} y2={floor + dy} stroke={INK} strokeWidth={1} strokeDasharray="3,3" />

      {/* === LEGS (only 2 front ones) === */}
      {/* Left front leg */}
      <g filter="url(#shadow)">
        <polygon
          points={`${ox + legInset},${floor - L} ${ox + legInset + legW},${floor - L} ${ox + legInset + legW},${floor} ${ox + legInset},${floor}`}
          fill={LEG}
          stroke="#1e293b"
          strokeWidth={1}
        />
      </g>
      {/* Right front leg */}
      <g filter="url(#shadow)">
        <polygon
          points={`${ox + W - legInset - legW},${floor - L} ${ox + W - legInset},${floor - L} ${ox + W - legInset},${floor} ${ox + W - legInset - legW},${floor}`}
          fill={LEG}
          stroke="#1e293b"
          strokeWidth={1}
        />
      </g>

      {/* === BOTTOM (full width, full depth - sides will sit on it) === */}
      {/* Bottom - front face */}
      <polygon
        points={`${ox},${floor - L - T} ${ox + W},${floor - L - T} ${ox + W},${floor - L} ${ox},${floor - L}`}
        fill={WOOD_DARK}
        stroke="#1e293b"
        strokeWidth={1.2}
      />
      {/* Bottom - top surface (visible depth) */}
      <polygon
        points={`${ox},${floor - L - T} ${ox + dx},${floor - L - T + dy} ${ox + W + dx},${floor - L - T + dy} ${ox + W},${floor - L - T}`}
        fill="#8a6a3e"
        stroke="#1e293b"
        strokeWidth={1}
      />
      {/* Bottom - right edge */}
      <polygon
        points={`${ox + W},${floor - L - T} ${ox + W + dx},${floor - L - T + dy} ${ox + W + dx},${floor - L + dy} ${ox + W},${floor - L}`}
        fill="#9a7a4e"
        stroke="#1e293b"
        strokeWidth={1}
      />


      {/* === LEFT SIDE (sits on bottom) === */}
      {/* Left side - front face */}
      <polygon
        points={`${ox},${floor - L - H} ${ox + T},${floor - L - H} ${ox + T},${floor - L - T} ${ox},${floor - L - T}`}
        fill={WOOD}
        stroke="#1e293b"
        strokeWidth={1.2}
      />
      {/* Left side - right edge (depth) showing the inner surface */}
      <polygon
        points={`${ox + T},${floor - L - H} ${ox + T + dx},${floor - L - H + dy} ${ox + T + dx},${floor - L - T + dy} ${ox + T},${floor - L - T}`}
        fill={WOOD_DARK}
        stroke="#1e293b"
        strokeWidth={1}
      />
      {/* Left side - top edge kant (continuous from front to back) */}
      <polygon
        points={`${ox},${floor - L - H} ${ox + dx},${floor - L - H + dy} ${ox + T + dx},${floor - L - H + dy} ${ox + T},${floor - L - H}`}
        fill={WOOD_TOP}
        stroke="#1e293b"
        strokeWidth={1.5}
      />

      {/* === RIGHT SIDE (sits on bottom) === */}
      {/* Right side - front face */}
      <polygon
        points={`${ox + W - T},${floor - L - H} ${ox + W},${floor - L - H} ${ox + W},${floor - L - T} ${ox + W - T},${floor - L - T}`}
        fill={WOOD}
        stroke="#1e293b"
        strokeWidth={1.2}
      />
      {/* Right side - right edge (outer surface visible) showing full depth */}
      <polygon
        points={`${ox + W},${floor - L - H} ${ox + W + dx},${floor - L - H + dy} ${ox + W + dx},${floor - L - T + dy} ${ox + W},${floor - L - T}`}
        fill={WOOD_DARK}
        stroke="#1e293b"
        strokeWidth={1.2}
      />
      {/* Right side - top edge kant (continuous from front to back, covering full depth) */}
      <polygon
        points={`${ox + W - T},${floor - L - H} ${ox + W - T + dx},${floor - L - H + dy} ${ox + W + dx},${floor - L - H + dy} ${ox + W},${floor - L - H}`}
        fill={WOOD_TOP}
        stroke="#1e293b"
        strokeWidth={1.5}
      />

      {/* === BACK RAIL (inside between sides) === */}
      {/* Back rail - front edge (18mm thickness facing forward) */}
      <polygon
        points={`${ox + T + dx - dxR},${floor - L - H + dy - dyR} ${ox + W - T + dx - dxR},${floor - L - H + dy - dyR} ${ox + W - T + dx - dxR},${floor - L - H + T + dy - dyR} ${ox + T + dx - dxR},${floor - L - H + T + dy - dyR}`}
        fill={RAIL}
        stroke="#1e293b"
        strokeWidth={1.2}
      />
      {/* Back rail - top surface visible */}
      <polygon
        points={`${ox + T + dx - dxR},${floor - L - H + dy - dyR} ${ox + W - T + dx - dxR},${floor - L - H + dy - dyR} ${ox + W - T + dx},${floor - L - H + dy} ${ox + T + dx},${floor - L - H + dy}`}
        fill="#c7e7c7"
        stroke="#1e293b"
        strokeWidth={1}
      />

      {/* === FRONT RAIL (inside between sides at top) === */}
      {/* Front rail - front face (18mm edge visible) */}
      <polygon
        points={`${ox + T},${floor - L - H} ${ox + W - T},${floor - L - H} ${ox + W - T},${floor - L - H + T} ${ox + T},${floor - L - H + T}`}
        fill={RAIL}
        stroke="#1e293b"
        strokeWidth={1.2}
      />
      {/* Front rail - top surface (goes back but doesn't extend past the side) */}
      <polygon
        points={`${ox + T},${floor - L - H} ${ox + T + dxR},${floor - L - H + dyR} ${ox + W - T + dxR},${floor - L - H + dyR} ${ox + W - T},${floor - L - H}`}
        fill="#b7d7b7"
        stroke="#1e293b"
        strokeWidth={1}
      />

      {/* === DIMENSIONS === */}
      <DimH x1={ox} x2={ox + W} y={18} label={mm(W)} />
      <DimH x1={ox + W + 8} x2={ox + W + 8 + dx} y={floor - L - H / 2} label={mm(D)} />
      <DimV x={12} y1={floor - L - H} y2={floor - L} label={mm(H)} />
      <DimV x={vbW - 12} y1={floor - L} y2={floor} label={mm(L)} />
    </svg>
  )
}

function DimH({
  x1,
  x2,
  y,
  label,
  color = DIM,
}: {
  x1: number
  x2: number
  y: number
  label: string
  color?: string
}) {
  return (
    <g stroke={color} fill={color}>
      <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth={2} />
      <line x1={x1} y1={y - 6} x2={x1} y2={y + 6} strokeWidth={2} />
      <line x1={x2} y1={y - 6} x2={x2} y2={y + 6} strokeWidth={2} />
      <text x={(x1 + x2) / 2} y={y - 10} textAnchor="middle" fontSize={20} fontWeight="700" stroke="none" fill={color}>
        {label}
      </text>
    </g>
  )
}

function DimV({
  x,
  y1,
  y2,
  label,
}: {
  x: number
  y1: number
  y2: number
  label: string
}) {
  return (
    <g stroke={DIM} fill={DIM}>
      <line x1={x} y1={y1} x2={x} y2={y2} strokeWidth={2} />
      <line x1={x - 6} y1={y1} x2={x + 6} y2={y1} strokeWidth={2} />
      <line x1={x - 6} y1={y2} x2={x + 6} y2={y2} strokeWidth={2} />
      <text
        x={x}
        y={(y1 + y2) / 2}
        textAnchor="middle"
        fontSize={20}
        fontWeight="700"
        stroke="none"
        fill={DIM}
        transform={`rotate(-90 ${x} ${(y1 + y2) / 2})`}
      >
        {label}
      </text>
    </g>
  )
}
