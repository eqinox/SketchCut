import { partFaces } from '@/lib/cabinets/colors'
import {
  BETWEEN_FACES,
  Board,
  BOX_FACES,
  DRAW_STROKE,
  DimText,
  WorldDim,
  SIDE_LEFT_BODY,
  SIDE_RIGHT,
  SketchSvg,
  createDrawCam,
  usePiecePaint,
  type DrawCam,
} from '@/lib/cabinets/draw-3d'
import { BED_FRAME_HEIGHT_MM, measureBed, type BedParams } from '@/lib/cabinets/bed'
import { STEEL, useCaptureSolid, type SceneSolid } from '@/lib/cabinets/scene-solids'
import { formatMm } from '@/lib/utils'

type ScreenPt = { x: number; y: number }

/** Keep the part of a face that sits above the bottom panel's top edge. Screen y grows downward. */
function clipAbove(pts: ScreenPt[], limitY: number): ScreenPt[] {
  const out: ScreenPt[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const aIn = a.y <= limitY
    const bIn = b.y <= limitY
    if (aIn && bIn) out.push(b)
    else if (aIn !== bIn) {
      const t = (limitY - a.y) / (b.y - a.y)
      const hit = { x: a.x + (b.x - a.x) * t, y: limitY }
      out.push(hit)
      if (bIn) out.push(b)
    }
  }
  return out
}

/** Front run of the middle page. From this side its edge stops at the bottom panel's top edge. Not a second board. */
function MiddleToBottom({
  view,
  x,
  y,
  z,
  w,
  h,
  d,
  color,
  coverY,
}: {
  view: DrawCam
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  color: string
  coverY: number
}) {
  const paint = usePiecePaint('middle', color)
  const tone = partFaces(paint.color)
  const chosen = paint.chosen
  const yb = y + h
  const x2 = x + w
  const z2 = z + d
  const limitY = view.proj(0, coverY, 0).y
  const at = (px: number, py: number, pz: number) => view.proj(px, py, pz)
  const edge = {
    stroke: chosen ? '#1d4ed8' : DRAW_STROKE,
    strokeWidth: chosen ? 2.8 : 1.5,
    strokeLinejoin: 'round' as const,
  }
  const face = (corners: [number, number, number][], fill: string) => {
    const clipped = clipAbove(corners.map(([px, py, pz]) => at(px, py, pz)), limitY)
    if (clipped.length < 3) return null
    return <polygon points={clipped.map((p) => `${p.x},${p.y}`).join(' ')} fill={fill} {...edge} />
  }
  return (
    <g
      style={paint.onClick ? { cursor: 'pointer' } : undefined}
      onClick={paint.onClick}
    >
      {face([[x, y, z], [x2, y, z], [x2, y, z2], [x, y, z2]], tone.top)}
      {face([[x2, y, z], [x2, y, z2], [x2, yb, z2], [x2, yb, z]], tone.side)}
    </g>
  )
}

type FramePart = Extract<SceneSolid, { kind: 'lift' }>['parts'][number]

const FRAME_RAIL = '#b88a55'
const FRAME_SLAT = '#d9b77e'
/** How far the foot end of the frame comes up on the lift mechanism. */
const LIFT_OPEN_DEG = 42

/**
 * The bought slat frame: a wooden rim, a middle rail on wide beds, and slats across it.
 * It lies on the inner sides, inside the outer ones.
 */
function slatFrameParts(x0: number, w: number, z0: number, d: number, top: number): FramePart[] {
  const H = BED_FRAME_HEIGHT_MM
  const rail = 50
  const parts: FramePart[] = [
    { x: x0, y: top, z: z0, w: rail, h: H, d, color: FRAME_RAIL },
    { x: x0 + w - rail, y: top, z: z0, w: rail, h: H, d, color: FRAME_RAIL },
    { x: x0 + rail, y: top, z: z0, w: w - 2 * rail, h: H, d: rail, color: FRAME_RAIL },
    { x: x0 + rail, y: top, z: z0 + d - rail, w: w - 2 * rail, h: H, d: rail, color: FRAME_RAIL },
  ]
  if (w > 1200) {
    parts.push({ x: x0 + w / 2 - rail / 2, y: top + 8, z: z0 + rail, w: rail, h: H - 8, d: d - 2 * rail, color: FRAME_RAIL })
  }
  const slat = 53
  const run = d - 2 * rail
  const count = Math.max(1, Math.floor(run / (slat + 35)))
  const pitch = run / count
  for (let i = 0; i < count; i++) {
    parts.push({
      x: x0 + rail,
      y: top,
      z: z0 + rail + i * pitch + (pitch - slat) / 2,
      w: w - 2 * rail,
      h: 8,
      d: slat,
      color: FRAME_SLAT,
    })
  }
  return parts
}

/** In 3D the frame on a lift mechanism is one piece that rises at the foot end. */
function LiftingFrame({ solid }: { solid: Extract<SceneSolid, { kind: 'lift' }> }) {
  useCaptureSolid(solid)
  return null
}

/** A little higher than the cabinet view, so the long bed reads from above. */
const BED_DEPTH_ANGLE = 58

/** Front-right view. The 780 panels stand in the opening and start at the inner side, not the outer one. */
/** `showFrame`: the slat frame is drawn only in 3D; the drawing leaves it out (it is bought, not cut). */
export function BedPreview({ params, showDims, showFrame = true }: { params: BedParams; showDims: boolean; showFrame?: boolean }) {
  const m = measureBed(params)
  const T = m.thickness
  const hint = createDrawCam({ ox: 0, oy: 0, depthAngle: BED_DEPTH_ANGLE })
  const { x: dx, y: dy } = hint.depthDelta(m.length)
  const font = 52
  const padL = showDims ? font + 36 : 28
  const padT = (showDims ? font : 16) + Math.abs(dy) + 24
  const padR = showDims ? 56 : 24
  const rise = Math.max(m.sideHeight, params.headboard ? m.headboardHeight : m.sideHeight)
  const vbW = padL + m.width + dx + padR
  const vbH = padT + rise + T + (showDims ? 72 : 28)
  const view = createDrawCam({ ox: padL, oy: 0, depthAngle: BED_DEPTH_ANGLE })
  const bottomTop = padT + rise
  const zSide = T
  const sideD = m.sideLength
  const wood = params.colors
  const half = m.supportWidth
  const leftRailX = T
  const leftSupportX = 2 * T
  const midX = m.width / 2 - T / 2
  const rightSupportX = midX + T
  const rightRailX = m.width - 2 * T
  const zCross = zSide + sideD / 2 - T / 2
  const zCrossEnd = zCross + T
  const zEnd = zSide + sideD
  const innerY = bottomTop - m.innerHeight
  const rearRun = zEnd - zCrossEnd

  const widthPt = view.proj(m.width / 2, bottomTop + T + font * 0.7, 0)
  const lengthA = view.proj(m.width, bottomTop - m.sideHeight * 0.35, 0)
  const lengthB = view.proj(m.width, bottomTop - m.sideHeight * 0.35, m.length)
  const lengthPt = { x: (lengthA.x + lengthB.x) / 2, y: (lengthA.y + lengthB.y) / 2 - font * 0.85 }

  const liftD = Math.min(m.liftLength, Math.max(0, rearRun - 2 * T))
  const liftZ = zEnd - T - liftD
  const frameTop = innerY - BED_FRAME_HEIGHT_MM
  const frame = slatFrameParts(T, m.topWidth, zSide, sideD, frameTop)
  const lifts = params.liftMechanism && liftD > 40
  // The bought lift mechanism, one on each side, like the usual black steel kit:
  // a base bar screwed to the mechanism panel, a top bar screwed under the frame, a short arm
  // by the head, a long diagonal arm in the middle, and the gas spring toward the foot.
  const panelFoot = zEnd - T - liftD
  const panelHead = zEnd - T
  const baseY = innerY + m.innerHeight * 0.6
  const topY = innerY + 14
  const pin = (x: number, y: number, z: number) => [x, y, z] as [number, number, number]
  const mechanism = (x: number) => {
    const base = { x: x - 2.5, y: baseY - 15, z: panelFoot + 20, w: 5, h: 30, d: liftD - 40, color: STEEL }
    const topBar = { x: x - 2.5, y: innerY + 2, z: panelFoot - 60, w: 5, h: 26, d: liftD + 40, color: STEEL }
    const arms = [
      // Short arm by the head.
      { a: pin(x, baseY, panelHead - 40), b: pin(x, topY, panelHead - 20) },
      // Long diagonal arm.
      { a: pin(x, baseY, panelFoot + liftD * 0.62), b: pin(x, topY, panelFoot + liftD * 0.3) },
    ]
    const strut = { a: pin(x, baseY, panelFoot + 45), b: pin(x, topY, panelFoot - 35) }
    return { base, topBar, arms, strut }
  }
  const sides = [mechanism(3 * T + 4), mechanism(m.width - 3 * T - 4)]
  const liftSolid: Extract<SceneSolid, { kind: 'lift' }> | null = lifts
    ? {
        kind: 'lift',
        key: 'bed-frame',
        pivotY: innerY,
        pivotZ: zEnd,
        openDeg: LIFT_OPEN_DEG,
        parts: [...frame, ...sides.map((side) => side.topBar)],
        base: sides.map((side) => side.base),
        arms: sides.flatMap((side) => side.arms),
        struts: params.liftDampers ? sides.map((side) => side.strut) : [],
      }
    : null

  return (
    <SketchSvg vbW={vbW} vbH={vbH} height={460} label="Легло, вътрешните страници на кръст">
      {params.headboard && (
        <Board
          x={0}
          y={bottomTop - m.headboardHeight}
          z={m.length - T}
          w={m.width}
          h={m.headboardHeight}
          d={T}
          color={wood.side} pick="headboard"
          cam={view}
          faces={{ front: true, right: true }}
        />
      )}
      <Board
        x={0}
        y={bottomTop - m.sideHeight}
        z={zSide}
        w={T}
        h={m.sideHeight}
        d={sideD}
        color={wood.side} pick="side-left"
        cam={view}
        faces={SIDE_LEFT_BODY}
      />
      <Board x={leftRailX} y={innerY} z={zSide} w={T} h={m.innerHeight} d={sideD} color={wood.shelf} pick="inner-left" cam={view} faces={{ front: true, top: true, right: true }} />
      {params.liftMechanism && liftD > 40 && (
        <Board
          x={leftSupportX}
          y={innerY}
          z={liftZ}
          w={T}
          h={m.innerHeight}
          d={liftD}
          color={wood.rail} pick="lift-left"
          cam={view}
          faces={SIDE_LEFT_BODY}
        />
      )}
      <Board x={rightRailX} y={innerY} z={zSide} w={T} h={m.innerHeight} d={sideD} color={wood.shelf} pick="inner-right" cam={view} faces={{ front: true, top: true }} />
      {params.liftMechanism && liftD > 40 && (
        <Board
          x={m.width - 3 * T}
          y={innerY}
          z={liftZ}
          w={T}
          h={m.innerHeight}
          d={liftD}
          color={wood.rail} pick="lift-right"
          cam={view}
          faces={{ front: true, left: true }}
        />
      )}

      <Board
        x={T}
        y={bottomTop - m.sideHeight}
        z={zEnd - T}
        w={m.topWidth}
        h={m.sideHeight}
        d={T}
        color={wood.rail} pick="top"
        cam={view}
        faces={{ front: true }}
      />
      <Board
        x={midX}
        y={innerY}
        z={zSide}
        w={T}
        h={m.innerHeight}
        d={sideD}
        color={wood.side} pick="middle"
        cam={view}
        faces={{ front: true, top: true, right: true }}
      />
      <Board x={leftSupportX} y={innerY} z={zCross} w={half} h={m.innerHeight} d={T} color={wood.shelf} pick="support-left" cam={view} faces={BETWEEN_FACES} />
      <Board x={rightSupportX} y={innerY} z={zCross} w={half} h={m.innerHeight} d={T} color={wood.shelf} pick="support-right" cam={view} faces={BETWEEN_FACES} />
      {/* The slat frame. With a lift mechanism the 3D picture builds it as one piece that rises. */}
      {showFrame && frame.map((part, i) => (
        <Board
          key={`frame-${i}`}
          x={part.x}
          y={part.y}
          z={part.z}
          w={part.w}
          h={part.h}
          d={part.d}
          color={part.color}
          cam={view}
          faces={{ top: true, front: true }}
          strokeWidth={0.8}
          capture={!lifts}
        />
      ))}
      {showFrame && liftSolid && <LiftingFrame solid={liftSolid} />}
      <Board
        x={m.width - T}
        y={bottomTop - m.sideHeight}
        z={zSide}
        w={T}
        h={m.sideHeight}
        d={sideD}
        color={wood.side} pick="side-right"
        cam={view}
        faces={SIDE_RIGHT}
      />
      <Board
        x={0}
        y={bottomTop - m.sideHeight}
        z={0}
        w={m.width}
        h={m.sideHeight}
        d={T}
        color={wood.bottom} pick="bottom"
        cam={view}
        faces={BOX_FACES}
      />
      <MiddleToBottom
        view={view}
        x={midX}
        y={innerY}
        z={zSide}
        w={T}
        h={m.innerHeight}
        d={zCross - zSide}
        color={wood.side}
        coverY={bottomTop - m.sideHeight}
      />

      {showDims && (
        <>
          <DimText x={widthPt.x} y={widthPt.y} label={formatMm(m.width)} fontSize={font} />
          <WorldDim label={formatMm(m.width)} x0={0} y0={bottomTop + T + 24} z0={0} x1={m.width} y1={bottomTop + T + 24} z1={0} />
          <DimText x={lengthPt.x} y={lengthPt.y} label={formatMm(m.length)} fontSize={font} />
          <WorldDim
            label={formatMm(m.length)}
            x0={m.width + 28}
            y0={bottomTop - m.sideHeight * 0.35}
            z0={0}
            x1={m.width + 28}
            y1={bottomTop - m.sideHeight * 0.35}
            z1={m.length}
          />
          <DimText
            x={padL - font * 0.85}
            y={bottomTop - m.sideHeight / 2}
            label={formatMm(m.sideHeight)}
            fontSize={font * 0.72}
            rotate={-90}
          />
          <WorldDim
            label={formatMm(m.sideHeight)}
            x0={-28}
            y0={bottomTop - m.sideHeight}
            z0={0}
            x1={-28}
            y1={bottomTop}
            z1={0}
          />
          <DimText
            x={view.proj(m.width / 2, bottomTop - m.sideHeight * 0.55, zSide + 30).x}
            y={view.proj(m.width / 2, bottomTop - m.sideHeight * 0.55, zSide + 30).y}
            label={`матрак ${formatMm(params.mattressLength)}×${formatMm(params.mattressWidth)}`}
            fontSize={font * 0.4}
          />
          <DimText
            x={view.proj(leftSupportX + half / 2, innerY + m.innerHeight / 2, zCross).x}
            y={view.proj(leftSupportX + half / 2, innerY + m.innerHeight / 2, zCross).y}
            label={formatMm(Math.round(half))}
            fontSize={font * 0.46}
          />
        </>
      )}
      <title>{`Плоскостите от ${formatMm(Math.round(half))} мм тръгват от вътрешната страница до средната.`}</title>
    </SketchSvg>
  )
}
