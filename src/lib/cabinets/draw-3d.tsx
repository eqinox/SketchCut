import type { ReactNode } from 'react'
import { partFaces } from './colors'

/** Outline of every board — same as the kitchen-base 3D view. */
export const DRAW_STROKE = '#1e293b'
export const DRAW_DEPTH_SCALE = 0.5
export const DRAW_DEPTH_ANGLE = 30
export const DRAW_DIM = '#60a5fa'

/** Parts that sit between the sides (бленди, вътрешни царги): face + top, no end kant. */
export const BETWEEN_FACES = { front: true, top: true } as const
/** Left side body before the top is drawn — front + inner wall. */
export const SIDE_LEFT_BODY = { front: true, right: true } as const
export const SIDE_LEFT_TOP = { top: true } as const
/** Right side — front, outer wall, top. */
export const SIDE_RIGHT = { front: true, top: true, right: true } as const
/** Bottom / full box — front, top, right. */
export const BOX_FACES = { front: true, top: true, right: true } as const

export type DrawPt = { x: number; y: number }

export type DrawFaces = {
  front?: boolean
  top?: boolean
  right?: boolean
  left?: boolean
  back?: boolean
}

export type DrawCam = {
  ox: number
  oy: number
  depthScale: number
  depthAngle: number
  proj: (x: number, y: number, z: number) => DrawPt
  /** Screen offset for a depth of `d` (same as cabinet dx/dy). */
  depthDelta: (d: number) => DrawPt
}

export function createDrawCam(opts: {
  ox: number
  oy: number
  depthScale?: number
  depthAngle?: number
}): DrawCam {
  const depthScale = opts.depthScale ?? DRAW_DEPTH_SCALE
  const depthAngle = opts.depthAngle ?? DRAW_DEPTH_ANGLE
  const ang = (depthAngle * Math.PI) / 180
  const kz = depthScale * Math.cos(ang)
  const ky = depthScale * Math.sin(ang)
  return {
    ox: opts.ox,
    oy: opts.oy,
    depthScale,
    depthAngle,
    proj: (x, y, z) => ({
      x: opts.ox + x + z * kz,
      y: opts.oy + y - z * ky,
    }),
    depthDelta: (d) => ({ x: d * kz, y: -d * ky }),
  }
}

function polyPts(...pts: DrawPt[]) {
  return pts.map((pt) => `${pt.x},${pt.y}`).join(' ')
}

function Face({
  pts,
  fill,
  strokeWidth,
}: {
  pts: DrawPt[]
  fill: string
  strokeWidth: number
}) {
  return (
    <polygon
      points={polyPts(...pts)}
      fill={fill}
      stroke={DRAW_STROKE}
      strokeWidth={strokeWidth}
    />
  )
}

/**
 * One rectangular board in the same cavalier view as the kitchen-base drawing.
 * `(x, y, z)` is the front-top-left corner; `y` grows downward.
 */
export function Board({
  x,
  y,
  z = 0,
  w,
  h,
  d,
  color,
  cam,
  faces = BOX_FACES,
  strokeWidth = 1.2,
}: {
  x: number
  y: number
  z?: number
  w: number
  h: number
  d: number
  color: string
  cam: DrawCam
  faces?: DrawFaces
  strokeWidth?: number
}) {
  const c = partFaces(color)
  const { proj } = cam
  const yb = y + h
  const x2 = x + w
  const z2 = z + d
  const sw = strokeWidth
  const topSw = Math.max(sw, 1.5)
  return (
    <g>
      {faces.back && (
        <Face
          pts={[proj(x, y, z2), proj(x2, y, z2), proj(x2, yb, z2), proj(x, yb, z2)]}
          fill={c.side}
          strokeWidth={sw}
        />
      )}
      {faces.left && (
        <Face
          pts={[proj(x, y, z), proj(x, y, z2), proj(x, yb, z2), proj(x, yb, z)]}
          fill={c.side}
          strokeWidth={sw}
        />
      )}
      {faces.front && (
        <Face
          pts={[proj(x, y, z), proj(x2, y, z), proj(x2, yb, z), proj(x, yb, z)]}
          fill={c.front}
          strokeWidth={sw}
        />
      )}
      {faces.top && (
        <Face
          pts={[proj(x, y, z), proj(x2, y, z), proj(x2, y, z2), proj(x, y, z2)]}
          fill={c.top}
          strokeWidth={topSw}
        />
      )}
      {faces.right && (
        <Face
          pts={[proj(x2, y, z), proj(x2, y, z2), proj(x2, yb, z2), proj(x2, yb, z)]}
          fill={c.side}
          strokeWidth={sw}
        />
      )}
    </g>
  )
}

export function DimText({
  x,
  y,
  label,
  fontSize,
  rotate = 0,
  fill = DRAW_DIM,
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

export function DimLine({
  x1,
  y1,
  x2,
  y2,
  color = DRAW_DIM,
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

export function SketchSvg({
  vbW,
  vbH,
  height,
  label,
  children,
}: {
  vbW: number
  vbH: number
  height: number
  label: string
  children: ReactNode
}) {
  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="w-full select-none"
      style={{ height: `${height}px` }}
      role="img"
      aria-label={label}
    >
      {children}
    </svg>
  )
}
