import { partFaces } from '@/lib/cabinets/colors'
import {
  BETWEEN_FACES,
  Board,
  BOX_FACES,
  DRAW_STROKE,
  DimText,
  SIDE_LEFT_BODY,
  SIDE_RIGHT,
  SketchSvg,
  createDrawCam,
  type DrawCam,
} from '@/lib/cabinets/draw-3d'
import { BED_INNER_DROP_MM, measureBed, type BedParams } from '@/lib/cabinets/bed'
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
  const tone = partFaces(color)
  const yb = y + h
  const x2 = x + w
  const z2 = z + d
  const limitY = view.proj(0, coverY, 0).y
  const at = (px: number, py: number, pz: number) => view.proj(px, py, pz)
  const edge = { stroke: DRAW_STROKE, strokeWidth: 1.5, strokeLinejoin: 'round' as const }
  const face = (corners: [number, number, number][], fill: string) => {
    const clipped = clipAbove(corners.map(([px, py, pz]) => at(px, py, pz)), limitY)
    if (clipped.length < 3) return null
    return <polygon points={clipped.map((p) => `${p.x},${p.y}`).join(' ')} fill={fill} {...edge} />
  }
  return (
    <g>
      {face([[x, y, z], [x2, y, z], [x2, y, z2], [x, y, z2]], tone.top)}
      {face([[x2, y, z], [x2, y, z2], [x2, yb, z2], [x2, yb, z]], tone.side)}
    </g>
  )
}

/** A little higher than the cabinet view, so the long bed reads from above. */
const BED_DEPTH_ANGLE = 58

/** Front-right view. The 780 panels stand in the opening and start at the inner side, not the outer one. */
export function BedPreview({ params, showDims }: { params: BedParams; showDims: boolean }) {
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
          color={wood.side}
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
        color={wood.side}
        cam={view}
        faces={SIDE_LEFT_BODY}
      />
      <Board x={leftRailX} y={innerY} z={zSide} w={T} h={m.innerHeight} d={sideD} color={wood.shelf} cam={view} faces={{ front: true, top: true, right: true }} />
      {params.liftMechanism && liftD > 40 && (
        <Board
          x={leftSupportX}
          y={innerY}
          z={liftZ}
          w={T}
          h={m.innerHeight}
          d={liftD}
          color={wood.rail}
          cam={view}
          faces={SIDE_LEFT_BODY}
        />
      )}
      <Board x={rightRailX} y={innerY} z={zSide} w={T} h={m.innerHeight} d={sideD} color={wood.shelf} cam={view} faces={{ front: true, top: true }} />
      {params.liftMechanism && liftD > 40 && (
        <Board
          x={m.width - 3 * T}
          y={innerY}
          z={liftZ}
          w={T}
          h={m.innerHeight}
          d={liftD}
          color={wood.rail}
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
        color={wood.rail}
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
        color={wood.side}
        cam={view}
        faces={{ front: true, top: true, right: true }}
      />
      <Board x={leftSupportX} y={innerY} z={zCross} w={half} h={m.innerHeight} d={T} color={wood.shelf} cam={view} faces={BETWEEN_FACES} />
      <Board x={rightSupportX} y={innerY} z={zCross} w={half} h={m.innerHeight} d={T} color={wood.shelf} cam={view} faces={BETWEEN_FACES} />
      <Board
        x={m.width - T}
        y={bottomTop - m.sideHeight}
        z={zSide}
        w={T}
        h={m.sideHeight}
        d={sideD}
        color={wood.side}
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
        color={wood.bottom}
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
          <DimText x={lengthPt.x} y={lengthPt.y} label={formatMm(m.length)} fontSize={font} />
          <DimText
            x={padL - font * 0.85}
            y={bottomTop - m.sideHeight / 2}
            label={formatMm(m.sideHeight)}
            fontSize={font * 0.72}
            rotate={-90}
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
