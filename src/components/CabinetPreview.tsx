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

/** Front + side orthographic views with dimensions, plus isometric carcass. */
export function CabinetPreview({ params, className }: CabinetPreviewProps) {
  const p = parseKitchenBaseParams(params)
  const m = measureCarcass(
    { width: p.width, height: p.height, depth: p.depth, thickness: p.thickness },
    KITCHEN_BASE_JOINERY,
  )

  return (
    <div className={cn('grid gap-3 sm:grid-cols-3', className)}>
      <ViewCard title="Отпред">
        <FrontView p={p} m={m} />
      </ViewCard>
      <ViewCard title="Отстрани">
        <SideView p={p} m={m} />
      </ViewCard>
      <ViewCard title="3D">
        <IsoView p={p} m={m} />
      </ViewCard>
      <p className="text-center text-[11px] text-[var(--color-muted-foreground)] sm:col-span-3">
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

function FrontView({ p, m }: { p: KitchenBaseParams; m: ReturnType<typeof measureCarcass> }) {
  const T = p.thickness
  const W = p.width
  const H = p.height
  const L = p.legHeight
  const pad = 56
  const totalH = H + L
  const vbW = W + pad * 2
  const vbH = totalH + pad * 1.4
  const ox = pad
  const floor = pad * 0.55 + totalH

  const legW = Math.max(18, T * 1.2)
  const legInset = Math.max(28, W * 0.08)

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className="h-44 w-full" role="img" aria-label="Изглед отпред">
      <line x1={ox} y1={floor} x2={ox + W} y2={floor} stroke={INK} strokeWidth={1} />

      {/* legs */}
      <rect x={ox + legInset} y={floor - L} width={legW} height={L} fill={LEG} rx={2} />
      <rect x={ox + W - legInset - legW} y={floor - L} width={legW} height={L} fill={LEG} rx={2} />

      {/* bottom — full width, sides sit on it */}
      <rect x={ox} y={floor - L - T} width={W} height={T} fill={WOOD_DARK} stroke="#1e293b" strokeWidth={1} />

      {/* sides on top of bottom */}
      <rect
        x={ox}
        y={floor - L - H}
        width={T}
        height={m.sideH}
        fill={WOOD}
        stroke="#1e293b"
        strokeWidth={1}
      />
      <rect
        x={ox + W - T}
        y={floor - L - H}
        width={T}
        height={m.sideH}
        fill={WOOD}
        stroke="#1e293b"
        strokeWidth={1}
      />

      {/* front rail between sides, 18 mm edge facing us */}
      <rect
        x={ox + T}
        y={floor - L - H}
        width={m.railLength}
        height={T}
        fill={RAIL}
        stroke="#1e293b"
        strokeWidth={1}
      />

      {/* screws from below into the sides */}
      <circle cx={ox + T / 2} cy={floor - L - T / 2} r={2.2} fill="#1e293b" />
      <circle cx={ox + W - T / 2} cy={floor - L - T / 2} r={2.2} fill="#1e293b" />

      {/* width dim */}
      <DimH x1={ox} x2={ox + W} y={12} label={mm(W)} />
      {/* carcass height */}
      <DimV x={14} y1={floor - L - H} y2={floor - L} label={mm(H)} />
      {/* legs */}
      <DimV x={vbW - 14} y1={floor - L} y2={floor} label={mm(L)} />
    </svg>
  )
}

function SideView({ p, m }: { p: KitchenBaseParams; m: ReturnType<typeof measureCarcass> }) {
  const T = p.thickness
  const D = p.depth
  const H = p.height
  const L = p.legHeight
  const R = p.railWidth
  const pad = 56
  const totalH = H + L
  const vbW = D + pad * 2
  const vbH = totalH + pad * 1.4
  const ox = pad
  const floor = pad * 0.55 + totalH
  const top = floor - L - H

  const legW = Math.max(18, T * 1.2)
  const legInset = Math.max(28, D * 0.1)

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className="h-44 w-full" role="img" aria-label="Изглед отстрани">
      <line x1={ox} y1={floor} x2={ox + D} y2={floor} stroke={INK} strokeWidth={1} />

      <rect x={ox + legInset} y={floor - L} width={legW} height={L} fill={LEG} rx={2} />
      <rect x={ox + D - legInset - legW} y={floor - L} width={legW} height={L} fill={LEG} rx={2} />

      {/* bottom full depth */}
      <rect x={ox} y={floor - L - T} width={D} height={T} fill={WOOD_DARK} stroke="#1e293b" strokeWidth={1} />

      {/* side panel sitting on bottom */}
      <rect x={ox} y={top} width={D} height={m.sideH} fill={WOOD} stroke="#1e293b" strokeWidth={1} opacity={0.92} />

      {/* front rail — 10 cm from front, lying flat */}
      <rect x={ox} y={top} width={R} height={T} fill={RAIL} stroke="#1e293b" strokeWidth={1} />
      {/* back rail */}
      <rect x={ox + D - R} y={top} width={R} height={T} fill={RAIL} stroke="#1e293b" strokeWidth={1} />

      <DimH x1={ox} x2={ox + D} y={12} label={mm(D)} />
      <DimH x1={ox} x2={ox + R} y={28} label={mm(R)} color={RAIL_DARK} />
      <DimV x={14} y1={top} y2={floor - L} label={mm(H)} />
      <DimV x={vbW - 14} y1={floor - L} y2={floor} label={mm(L)} />
    </svg>
  )
}

function iso(x: number, y: number, z: number) {
  return {
    x: (x - z) * 0.866,
    y: -y + (x + z) * 0.5,
  }
}

function path(pts: { x: number; y: number }[]) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z'
}

function boxFaces(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  fill: string,
  fillSide: string,
  fillTop: string,
) {
  const P = (px: number, py: number, pz: number) => iso(px, py, pz)
  const front = [P(x, y, z), P(x + w, y, z), P(x + w, y + h, z), P(x, y + h, z)]
  const right = [P(x + w, y, z), P(x + w, y, z + d), P(x + w, y + h, z + d), P(x + w, y + h, z)]
  const top = [P(x, y + h, z), P(x + w, y + h, z), P(x + w, y + h, z + d), P(x, y + h, z + d)]
  return { front, right, top, fill, fillSide, fillTop }
}

function Face({
  pts,
  fill,
}: {
  pts: { x: number; y: number }[]
  fill: string
}) {
  return <path d={path(pts)} fill={fill} stroke="#1e293b" strokeWidth={0.8} strokeLinejoin="round" />
}

function IsoView({ p, m }: { p: KitchenBaseParams; m: ReturnType<typeof measureCarcass> }) {
  const T = p.thickness
  const W = p.width
  const H = p.height
  const D = p.depth
  const L = p.legHeight
  const R = p.railWidth

  const boxes: ReturnType<typeof boxFaces>[] = []

  const inset = Math.max(36, Math.min(W, D) * 0.08)
  const legS = Math.max(22, T * 1.3)

  const addLeg = (lx: number, lz: number) =>
    boxes.push(boxFaces(lx, -L, lz, legS, L, legS, '#1e293b', '#0f172a', '#334155'))

  addLeg(inset, D - inset - 24)
  addLeg(W - inset - 24, D - inset - 24)
  boxes.push(boxFaces(T, H - T, D - R, m.railLength, T, R, RAIL, RAIL_DARK, '#b7d7b7'))
  boxes.push(boxFaces(0, T, 0, T, m.sideH, m.sideD, WOOD, WOOD_DARK, WOOD_TOP))
  boxes.push(boxFaces(0, 0, 0, m.bottomW, T, m.bottomD, WOOD_DARK, '#8a6a3e', WOOD))
  boxes.push(boxFaces(W - T, T, 0, T, m.sideH, m.sideD, WOOD, WOOD_DARK, WOOD_TOP))
  addLeg(inset, inset)
  addLeg(W - inset - 24, inset)
  boxes.push(boxFaces(T, H - T, 0, m.railLength, T, R, RAIL, RAIL_DARK, '#b7d7b7'))

  const allPts = boxes.flatMap((b) => [...b.front, ...b.right, ...b.top])
  const minX = Math.min(...allPts.map((pt) => pt.x))
  const maxX = Math.max(...allPts.map((pt) => pt.x))
  const minY = Math.min(...allPts.map((pt) => pt.y))
  const maxY = Math.max(...allPts.map((pt) => pt.y))
  const pad = 16

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      className="h-44 w-full"
      role="img"
      aria-label="Изометричен изглед"
    >
      {boxes.map((b, i) => (
        <g key={i}>
          <Face pts={b.right} fill={b.fillSide} />
          <Face pts={b.front} fill={b.fill} />
          <Face pts={b.top} fill={b.fillTop} />
        </g>
      ))}
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
