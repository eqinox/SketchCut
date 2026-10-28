import { createContext, useContext, useEffect, useId, useState, type ReactNode } from 'react'
import { decorSheetFor, type DecorSheet } from '@/lib/finish-photo'
import { useCaptureSolid } from '@/lib/cabinets/scene-solids'
import { partFaces, shade } from './colors'
import type { RuleSection } from './rule-text'

/** Outline of every board — same as the kitchen-base 3D view. */
export const DRAW_STROKE = '#111111'
export const DRAW_DEPTH_SCALE = 0.5
export const DRAW_DEPTH_ANGLE = 30
/** Just short of a 110° hinge stop, so the door is open and still on its hinges. */
export const HINGE_OPEN_DEG = 100
export const DRAW_DIM = '#111111'
export const DRAW_PAPER = '#ffffff'

/** Parts between the sides, seen from the right: front + top. No end grain. */
export const BETWEEN_FACES = { front: true, top: true } as const

export function drawingRuleSection(): RuleSection {
  return {
    id: 'drawing',
    title: 'Чертеж',
    blocks: [
      {
        title: '3D изглед',
        lines: [
          `Кавалерна проекция, поглед отпред-дясно, дълбочина ${DRAW_DEPTH_SCALE} при ${DRAW_DEPTH_ANGLE}°. Чертае се само лицето, което се вижда отдясно.`,
          'Хоризонтално парче (рафт, дъно, бленда, плот): предно и горно лице.',
          'Вертикално парче (страница, разделител): предно лице и дясната стена към нас.',
          'Редът е отляво надясно: лява колона, нейният разделител, следваща колона, дясната външна страница, плотът най-накрая.',
          'Всичко в една страна — рафт, фиксиран рафт, чекмедже, лост — се чертае преди разделителната страница отдясно. Кантът на страницата остава отпред.',
          'Фиксиран рафт през съседни страни (1.1 и 1.2 е едно парче) също се чертае преди страницата отдясно му. Кантът на тази дясна страница остава пред рафта.',
          'Разделителна страница, която стига само до рафт, се чертае след нещата до нея и преди рафта, до който стига. Почва от лицето на този рафт назад. Кантът на рафта и кантът на страницата остават отпред.',
          'Рафт през съседни страни е едно парче. Разделителите между тях се чертаят само до рафта.',
          'Лостът стига от лицето на лявата опора до лицето на дясната — страница или разделител.',
        ],
      },
      {
        title: 'Размери по чертежа',
        lines: [
          'Ако две линии или две числа се застъпват, едната се мести.',
          'Вертикални размери в една колона, които се срещат по височина, отиват на различни места по широчина.',
          'Всяка страна си има размера, и когато числото е еднакво с друга. Който се събира, си остава на място. Само който не се събира, първо се смалява с по 10, и чак тогава се вдига. Извън шкафа излиза накрая.',
          'Широчините на вратите се пишат при останалите размери, само когато са показани вратите и челата. Ако размерът не е цяло число, се пише със запетая и не се закръгля до цяло.',
        ],
      },
    ],
  }
}
/** Left/inner vertical board from the right: front + inner (right) wall. */
export const SIDE_LEFT_BODY = { front: true, right: true } as const
export const SIDE_LEFT_TOP = { top: true } as const
/** Right side — front, outer wall, top. */
export const SIDE_RIGHT = { front: true, top: true, right: true } as const
/** Inner divider — looks like a side: both walls, top and front. */
export const PARTITION_FACES = { front: true, top: true, right: true, left: true } as const
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

export const DecorSheetContext = createContext<ReadonlyMap<string, DecorSheet>>(new Map())

export function DecorTextureProvider({
  entries,
  children,
}: {
  entries: { color: string; image: string }[]
  children: ReactNode
}) {
  const key = entries.map((entry) => `${entry.color}\n${entry.image}`).join('|')
  const [sheets, setSheets] = useState<ReadonlyMap<string, DecorSheet>>(new Map())
  useEffect(() => {
    let cancel = false
    const unique = new Map<string, string>()
    for (const entry of entries) {
      if (!entry.color || !entry.image) continue
      unique.set(entry.color.toLowerCase(), entry.image)
    }
    if (unique.size === 0) {
      setSheets(new Map())
      return
    }
    void Promise.all(
      [...unique.entries()].map(async ([color, image]) => [color, await decorSheetFor(image)] as const),
    )
      .then((pairs) => {
        if (!cancel) setSheets(new Map(pairs))
      })
      .catch(() => {
        if (!cancel) setSheets(new Map())
      })
    return () => {
      cancel = true
    }
    // `key` already carries the colour and the photo, so a new array does not rebuild the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return <DecorSheetContext.Provider value={sheets}>{children}</DecorSheetContext.Provider>
}

function polyPts(...pts: DrawPt[]) {
  return pts.map((pt) => `${pt.x},${pt.y}`).join(' ')
}

type Grain = 'height' | 'width' | 'depth'
type BoardFace = 'front' | 'back' | 'left' | 'right' | 'top'

function grainOf(w: number, h: number, d: number): Grain {
  if (h >= w && h >= d) return 'height'
  if (w >= d) return 'width'
  return 'depth'
}

/** Along the grain is `v`. A side runs it up the height; a shelf runs it along the width. */
function faceUV(grain: Grain, face: BoardFace, x: number, y: number, z: number): { u: number; v: number } {
  if (grain === 'height') {
    if (face === 'left' || face === 'right') return { u: z, v: y }
    if (face === 'top') return { u: z, v: x }
    return { u: x, v: y }
  }
  if (grain === 'width') {
    if (face === 'left' || face === 'right') return { u: y, v: z }
    if (face === 'top') return { u: z, v: x }
    return { u: y, v: x }
  }
  if (face === 'top') return { u: x, v: z }
  if (face === 'left' || face === 'right') return { u: y, v: z }
  return { u: x, v: y }
}

function textureMatrix(
  p0: DrawPt,
  u0: number,
  v0: number,
  pU: DrawPt,
  uU: number,
  vU: number,
  pV: DrawPt,
  uV: number,
  vV: number,
  sheetW: number,
  sheetH: number,
): string | null {
  const shiftU = Math.floor(Math.min(u0, uU, uV) / sheetW) * sheetW
  const shiftV = Math.floor(Math.min(v0, vU, vV) / sheetH) * sheetH
  const a0 = u0 - shiftU
  const b0 = v0 - shiftV
  const duU = uU - shiftU - a0
  const dvU = vU - shiftV - b0
  const duV = uV - shiftU - a0
  const dvV = vV - shiftV - b0
  const det = duU * dvV - dvU * duV
  if (Math.abs(det) < 1e-4) return null
  const dxU = pU.x - p0.x
  const dyU = pU.y - p0.y
  const dxV = pV.x - p0.x
  const dyV = pV.y - p0.y
  const a = (dxU * dvV - dxV * dvU) / det
  const c = (duU * dxV - duV * dxU) / det
  const b = (dyU * dvV - dyV * dvU) / det
  const d = (duU * dyV - duV * dyU) / det
  const e = p0.x - a * a0 - c * b0
  const f = p0.y - b * a0 - d * b0
  const n = (v: number) => Math.round(v * 1000) / 1000
  return `matrix(${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(e)} ${n(f)})`
}

const FACE_VEIL: Record<BoardFace, string | undefined> = {
  front: undefined,
  back: 'rgba(0,0,0,0.1)',
  left: 'rgba(0,0,0,0.16)',
  right: 'rgba(0,0,0,0.16)',
  top: 'rgba(255,255,255,0.2)',
}

function GrainFace({
  pts,
  p0,
  pU,
  pV,
  u0,
  v0,
  uU,
  vU,
  uV,
  vV,
  sheet,
  veil,
  strokeWidth,
}: {
  pts: DrawPt[]
  p0: DrawPt
  pU: DrawPt
  pV: DrawPt
  u0: number
  v0: number
  uU: number
  vU: number
  uV: number
  vV: number
  sheet: DecorSheet
  veil?: string
  strokeWidth: number
}) {
  const id = useId().replace(/:/g, '')
  const matrix = textureMatrix(p0, u0, v0, pU, uU, vU, pV, uV, vV, sheet.acrossMm, sheet.alongMm)
  if (!matrix) return <Face pts={pts} fill={veil ?? '#c4a574'} strokeWidth={strokeWidth} />
  const points = polyPts(...pts)
  return (
    <>
      <clipPath id={id}>
        <polygon points={points} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <image
          href={sheet.url}
          width={sheet.acrossMm}
          height={sheet.alongMm}
          preserveAspectRatio="none"
          transform={matrix}
        />
      </g>
      <polygon
        points={points}
        fill={veil ?? 'none'}
        stroke={strokeWidth > 0 ? DRAW_STROKE : 'none'}
        strokeWidth={strokeWidth}
      />
    </>
  )
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
      stroke={strokeWidth > 0 ? DRAW_STROKE : 'none'}
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
  opacity,
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
  opacity?: number
}) {
  useCaptureSolid(
    w > 0.4 && h > 0.4 && d > 0.2 ? { kind: 'box', x, y, z, w, h, d, color } : null,
  )
  const c = partFaces(color)
  const sheet = useContext(DecorSheetContext).get(color.toLowerCase())
  const { proj } = cam
  const yb = y + h
  const x2 = x + w
  const z2 = z + d
  const sw = strokeWidth
  const topSw = sw === 0 ? 0 : Math.max(sw, 1.5)
  const grain = grainOf(w, h, d)
  const paint = (
    face: BoardFace,
    corners: [number, number, number][],
    fill: string,
    line: number,
  ) => {
    const [a, b, , d] = corners
    const pts = corners.map(([cx, cy, cz]) => proj(cx, cy, cz))
    if (!sheet) return <Face pts={pts} fill={fill} strokeWidth={line} />
    const uv = (p: [number, number, number]) => faceUV(grain, face, p[0], p[1], p[2])
    const o = uv(a)
    const u = uv(b)
    const v = uv(d)
    return (
      <GrainFace
        pts={pts}
        p0={pts[0]}
        pU={pts[1]}
        pV={pts[3]}
        u0={o.u}
        v0={o.v}
        uU={u.u}
        vU={u.v}
        uV={v.u}
        vV={v.v}
        sheet={sheet}
        veil={fill === c.front ? FACE_VEIL.front : face === 'top' ? FACE_VEIL.top : FACE_VEIL[face]}
        strokeWidth={line}
      />
    )
  }
  return (
    <g opacity={opacity}>
      {faces.back &&
        paint('back', [[x, y, z2], [x2, y, z2], [x2, yb, z2], [x, yb, z2]], c.side, sw)}
      {faces.left &&
        paint('left', [[x, y, z], [x, y, z2], [x, yb, z2], [x, yb, z]], c.side, sw)}
      {faces.front &&
        paint('front', [[x, y, z], [x2, y, z], [x2, yb, z], [x, yb, z]], c.front, sw)}
      {faces.top &&
        paint('top', [[x, y, z], [x2, y, z], [x2, y, z2], [x, y, z2]], c.top, topSw)}
      {faces.right &&
        paint('right', [[x2, y, z], [x2, y, z2], [x2, yb, z2], [x2, yb, z]], c.side, sw)}
    </g>
  )
}

type XYZ = [number, number, number]

const HINGE_METAL = '#c5cad3'

/** Room the swung door needs. It pivots toward the viewer, not off to the side. */
export function hingeSwingPad(leaf: number, pair: boolean): { left: number; right: number; bottom: number } {
  const rad = (HINGE_OPEN_DEG * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const kz = DRAW_DEPTH_SCALE * Math.cos((DRAW_DEPTH_ANGLE * Math.PI) / 180)
  const ky = DRAW_DEPTH_SCALE * Math.sin((DRAW_DEPTH_ANGLE * Math.PI) / 180)
  const leftReach = -(leaf * c + -leaf * s * kz)
  return {
    left: Math.max(48, leftReach + 56),
    right: pair ? 80 : 44,
    bottom: leaf * s * ky + 52,
  }
}

function seesFrontRight(outward: XYZ): boolean {
  return outward[0] * 1 + outward[1] * -0.55 + outward[2] * -1 > 0.02
}

function DoorFace({
  corners,
  cam,
  fill,
  sheet,
  across,
  along,
  veil,
  show,
}: {
  corners: XYZ[]
  cam: DrawCam
  fill: string
  sheet?: DecorSheet
  across: number
  along: number
  veil?: string
  show: boolean
}) {
  const pts = corners.map(([x, y, z]) => cam.proj(x, y, z))
  if (!show) return null
  if (!sheet) return <Face pts={pts} fill={fill} strokeWidth={1.1} />
  return (
    <GrainFace
      pts={pts}
      p0={pts[0]!}
      pU={pts[1]!}
      pV={pts[3]!}
      u0={0}
      v0={0}
      uU={across}
      vU={0}
      uV={0}
      vV={along}
      sheet={sheet}
      veil={veil}
      strokeWidth={1.1}
    />
  )
}

/**
 * A hinged door swung to just short of the opening stop.
 * The left door shows its inside, the right door its outside — that is the front-right view.
 */
export function HingedDoor({
  hingeX,
  y,
  z = 0,
  width,
  height,
  thickness,
  side,
  color,
  cam,
}: {
  hingeX: number
  y: number
  z?: number
  width: number
  height: number
  thickness: number
  side: 'left' | 'right'
  color: string
  cam: DrawCam
}) {
  useCaptureSolid({
    kind: 'door',
    hingeX,
    y,
    z,
    width,
    height,
    thickness,
    side,
    openDeg: HINGE_OPEN_DEG,
    color,
  })
  const rad = (HINGE_OPEN_DEG * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const sheet = useContext(DecorSheetContext).get(color.toLowerCase())
  const yb = y + height
  const map = (along: number, thick: number, yy: number): XYZ =>
    side === 'left'
      ? [hingeX + along * c + thick * s, yy, z - along * s + thick * c]
      : [hingeX - along * c - thick * s, yy, z - along * s + thick * c]
  const widthDir: XYZ = side === 'left' ? [c, 0, -s] : [-c, 0, -s]
  const thickDir: XYZ = side === 'left' ? [s, 0, c] : [-s, 0, c]
  const face = (t: number): XYZ[] => [map(0, t, y), map(width, t, y), map(width, t, yb), map(0, t, yb)]
  const outer = face(0)
  const inner = face(thickness)
  const top: XYZ[] = [map(0, 0, y), map(width, 0, y), map(width, thickness, y), map(0, thickness, y)]
  const free: XYZ[] = [map(width, thickness, y), map(width, 0, y), map(width, 0, yb), map(width, thickness, yb)]
  const hingeInset = Math.min(100, Math.max(28, height * 0.16))
  const hingeH = Math.min(52, height * 0.2)
  const hingeTops =
    height < 180 ? [y + height / 2 - hingeH / 2] : [y + hingeInset, y + height - hingeInset - hingeH]
  return (
    <g>
      <DoorFace
        corners={outer}
        cam={cam}
        fill={shade(color, 0.97)}
        sheet={sheet}
        across={width}
        along={height}
        veil="rgba(255,255,255,0.14)"
        show={seesFrontRight([-thickDir[0], 0, -thickDir[2]])}
      />
      <DoorFace
        corners={inner}
        cam={cam}
        fill={shade(color, 0.88)}
        sheet={sheet}
        across={width}
        along={height}
        veil="rgba(0,0,0,0.2)"
        show={seesFrontRight(thickDir)}
      />
      <DoorFace
        corners={top}
        cam={cam}
        fill={shade(color, 1.1)}
        across={width}
        along={thickness}
        show={seesFrontRight([0, -1, 0])}
      />
      <DoorFace
        corners={free}
        cam={cam}
        fill={shade(color, 0.74)}
        across={thickness}
        along={height}
        show={seesFrontRight(widthDir)}
      />
      {hingeTops.map((hy) => (
        <Board
          key={hy}
          x={hingeX - 8}
          y={hy}
          z={z - 18}
          w={16}
          h={hingeH}
          d={22}
          color={HINGE_METAL}
          cam={cam}
          faces={BOX_FACES}
          strokeWidth={0.8}
        />
      ))}
    </g>
  )
}

/**
 * Clothes rail from the left support to the right one.
 * Each end sits on that panel's front face, so the bar starts and finishes
 * where the side or divider is drawn.
 */
export function ClothesRailBar({
  x,
  y,
  w,
  h,
  d,
  z0,
  z1,
  color,
  cam,
  strokeWidth = 1.2,
}: {
  x: number
  y: number
  w: number
  h: number
  d: number
  z0: number
  z1: number
  color: string
  cam: DrawCam
  strokeWidth?: number
}) {
  useCaptureSolid(
    w > 1 && h > 1 ? { kind: 'rail', x, y, w, h, d, z0, z1, color } : null,
  )
  const c = partFaces(color)
  const { proj } = cam
  const yb = y + h
  const x2 = x + w
  const sw = strokeWidth
  return (
    <g>
      <Face
        pts={[proj(x, y, z0), proj(x2, y, z1), proj(x2, yb, z1), proj(x, yb, z0)]}
        fill={c.front}
        strokeWidth={sw}
      />
      <Face
        pts={[proj(x, y, z0), proj(x2, y, z1), proj(x2, y, z1 + d), proj(x, y, z0 + d)]}
        fill={c.top}
        strokeWidth={Math.max(sw, 1.5)}
      />
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
      stroke={DRAW_PAPER}
      strokeWidth={Math.max(1.25, fontSize * 0.022)}
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
  strokeWidth = 3,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  color?: string
  strokeWidth?: number
}) {
  const arrow = Math.min(11, Math.max(7, Math.hypot(x2 - x1, y2 - y1) * 0.022))
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const ax = Math.cos(ang)
  const ay = Math.sin(ang)
  const px = -ay
  const py = ax
  const head = arrow
  return (
    <g stroke={color} fill={color} strokeLinecap="butt">
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={strokeWidth} />
      <polygon
        points={`${x1},${y1} ${x1 + ax * head + px * head * 0.4},${y1 + ay * head + py * head * 0.4} ${x1 + ax * head - px * head * 0.4},${y1 + ay * head - py * head * 0.4}`}
      />
      <polygon
        points={`${x2},${y2} ${x2 - ax * head + px * head * 0.4},${y2 - ay * head + py * head * 0.4} ${x2 - ax * head - px * head * 0.4},${y2 - ay * head - py * head * 0.4}`}
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
      style={{ height: `${height}px`, background: DRAW_PAPER }}
      role="img"
      aria-label={label}
    >
      <rect width={vbW} height={vbH} fill={DRAW_PAPER} />
      {children}
    </svg>
  )
}
