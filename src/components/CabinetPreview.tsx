import type { ReactNode } from 'react'
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
const RAIL_DARK = '#6a9a6a'
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
        <Front3DView p={p} m={m} />
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
      <div className="flex flex-1 items-center justify-center">{children}</div>
    </div>
  )
}

/** 3D front view with depth extending to the right (cavalier projection). Shows 2 front legs and how parts overlap. */
function Front3DView({ p, m }: { p: KitchenBaseParams; m: ReturnType<typeof measureCarcass> }) {
  const T = p.thickness
  const W = p.width
  const H = p.height
  const D = p.depth
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

  const dxT = T * depthScale * Math.cos((depthAngle * Math.PI) / 180)
  const dyT = -T * depthScale * Math.sin((depthAngle * Math.PI) / 180)
  const dxR = R * depthScale * Math.cos((depthAngle * Math.PI) / 180)
  const dyR = -R * depthScale * Math.sin((depthAngle * Math.PI) / 180)

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full" style={{ height: '400px' }} role="img" aria-label="3D изглед отпред">
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

      {/* Screws from below into sides */}
      <circle cx={ox + T / 2} cy={floor - L - T / 2} r={2.5} fill="#0f172a" />
      <circle cx={ox + W - T / 2} cy={floor - L - T / 2} r={2.5} fill="#0f172a" />

      {/* === LEFT SIDE (sits on bottom) === */}
      {/* Left side - front face */}
      <polygon
        points={`${ox},${floor - L - H} ${ox + T},${floor - L - H} ${ox + T},${floor - L - T} ${ox},${floor - L - T}`}
        fill={WOOD}
        stroke="#1e293b"
        strokeWidth={1.2}
      />
      {/* Left side - right edge (depth) */}
      <polygon
        points={`${ox + T},${floor - L - H} ${ox + T + dx},${floor - L - H + dy} ${ox + T + dx},${floor - L - T + dy} ${ox + T},${floor - L - T}`}
        fill={WOOD_DARK}
        stroke="#1e293b"
        strokeWidth={1}
      />
      {/* Left side - top edge */}
      <polygon
        points={`${ox},${floor - L - H} ${ox + dxT},${floor - L - H + dyT} ${ox + T + dxT},${floor - L - H + dyT} ${ox + T},${floor - L - H}`}
        fill={WOOD_TOP}
        stroke="#1e293b"
        strokeWidth={1}
      />

      {/* === RIGHT SIDE (sits on bottom) === */}
      {/* Right side - front face */}
      <polygon
        points={`${ox + W - T},${floor - L - H} ${ox + W},${floor - L - H} ${ox + W},${floor - L - T} ${ox + W - T},${floor - L - T}`}
        fill={WOOD}
        stroke="#1e293b"
        strokeWidth={1.2}
      />
      {/* Right side - right edge (depth) */}
      <polygon
        points={`${ox + W},${floor - L - H} ${ox + W + dx},${floor - L - H + dy} ${ox + W + dx},${floor - L - T + dy} ${ox + W},${floor - L - T}`}
        fill={WOOD_DARK}
        stroke="#1e293b"
        strokeWidth={1}
      />
      {/* Right side - top edge */}
      <polygon
        points={`${ox + W - T},${floor - L - H} ${ox + W - T + dxT},${floor - L - H + dyT} ${ox + W + dxT},${floor - L - H + dyT} ${ox + W},${floor - L - H}`}
        fill={WOOD_TOP}
        stroke="#1e293b"
        strokeWidth={1}
      />

      {/* === FRONT RAIL (fits between sides at top) === */}
      {/* Front rail - front face (18mm edge visible) */}
      <polygon
        points={`${ox + T},${floor - L - H} ${ox + W - T},${floor - L - H} ${ox + W - T},${floor - L - H + T} ${ox + T},${floor - L - H + T}`}
        fill={RAIL}
        stroke="#1e293b"
        strokeWidth={1.2}
      />
      {/* Front rail - top surface */}
      <polygon
        points={`${ox + T},${floor - L - H} ${ox + T + dxR},${floor - L - H + dyR} ${ox + W - T + dxR},${floor - L - H + dyR} ${ox + W - T},${floor - L - H}`}
        fill="#b7d7b7"
        stroke="#1e293b"
        strokeWidth={1}
      />
      {/* Front rail - right edge */}
      <polygon
        points={`${ox + W - T},${floor - L - H} ${ox + W - T + dxR},${floor - L - H + dyR} ${ox + W - T + dxR},${floor - L - H + T + dyR} ${ox + W - T},${floor - L - H + T}`}
        fill={RAIL_DARK}
        stroke="#1e293b"
        strokeWidth={1}
      />

      {/* === BACK RAIL (not visible from front but show depth indicator) === */}
      {/* Back rail - top surface (only the back edge visible) */}
      <line
        x1={ox + T + dx}
        y1={floor - L - H + dy}
        x2={ox + W - T + dx}
        y2={floor - L - H + dy}
        stroke="#6a9a6a"
        strokeWidth={2}
      />
      <line
        x1={ox + T + dxR + dx - dxR}
        y1={floor - L - H + dyR + dy - dyR}
        x2={ox + W - T + dxR + dx - dxR}
        y2={floor - L - H + dyR + dy - dyR}
        stroke="#8fbc8f"
        strokeWidth={1.5}
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
      <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth={1} />
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} strokeWidth={1} />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} strokeWidth={1} />
      <text x={(x1 + x2) / 2} y={y - 5} textAnchor="middle" fontSize={11} stroke="none" fill={color}>
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
      <line x1={x} y1={y1} x2={x} y2={y2} strokeWidth={1} />
      <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} strokeWidth={1} />
      <line x1={x - 4} y1={y2} x2={x + 4} y2={y2} strokeWidth={1} />
      <text
        x={x}
        y={(y1 + y2) / 2}
        textAnchor="middle"
        fontSize={11}
        stroke="none"
        fill={DIM}
        transform={`rotate(-90 ${x} ${(y1 + y2) / 2})`}
      >
        {label}
      </text>
    </g>
  )
}
