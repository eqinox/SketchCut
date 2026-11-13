import { useCallback, useState, type CSSProperties, type ReactNode } from 'react'
import { CabinetPreview, DrawFrameContext, FRONT_FILL, GroupedPreviewContext } from '@/components/CabinetPreview'
import { CapturedModel } from '@/components/CabinetModel'
import {
  arrangeMany,
  attachmentTouchesHost,
  cabinetOuterSize,
  spanDoorCountOf,
  spanFrontBox,
  stageBoxes,
  type CabinetPlace,
  type DrawFrame,
  type GroupSpot,
} from '@/lib/cabinets/compose'
import { Board, createDrawCam, DecorTextureProvider, DimLine, DimText, DRAW_DIM, DRAW_PAPER, HingedDoor, SketchGroupContext } from '@/lib/cabinets/draw-3d'
import { parsePartColors } from '@/lib/cabinets/colors'
import { formatMm } from '@/lib/utils'
import type { BoardFinish } from '@/lib/board-finishes'
import { DrawPlaceContext } from '@/lib/cabinets/scene-solids'

interface PieceProps {
  typeId: string
  params: Record<string, unknown>
}

interface GroupGuest extends PieceProps {
  place: CabinetPlace
  spanDoor: boolean
  spanDoorCount?: number
}

interface CabinetGroupViewProps {
  host: PieceProps
  guests: GroupGuest[]
  showDimLines?: boolean
  showOpeningDims?: boolean
  showFronts?: boolean
  drawStyle?: 'line' | 'color' | 'model'
  doorView?: 'hidden' | 'closed' | 'open'
  carcassColor?: string
  frontColor?: string
  carcassImage?: string
  frontImage?: string
  backColor?: string
  backImage?: string
  finishes?: BoardFinish[]
}

interface SpanDoor {
  x: number
  y: number
  w: number
  h: number
}

interface Member {
  key: string
  piece: PieceProps
  at: GroupSpot
  hideDoors: boolean
  frame: DrawFrame | null
  report: (frame: DrawFrame) => void
}

function sameFrame(a: DrawFrame | null, b: DrawFrame): boolean {
  return (
    !!a &&
    a.ox === b.ox &&
    a.top === b.top &&
    a.w === b.w &&
    a.h === b.h &&
    a.feet === b.feet &&
    a.vbW === b.vbW &&
    a.vbH === b.vbH
  )
}

function Piece({
  at,
  onFrame,
  children,
}: {
  at: GroupSpot
  onFrame: (frame: DrawFrame) => void
  children: ReactNode
}) {
  return (
    <DrawPlaceContext.Provider value={{ x: at.x, y: at.y, localLeft: 0, localTop: 0 }}>
      <DrawFrameContext.Provider value={onFrame}>{children}</DrawFrameContext.Provider>
    </DrawPlaceContext.Provider>
  )
}

function SpanLeaf({
  x,
  y,
  w,
  h,
  open,
  color,
  ox,
  oy,
}: {
  x: number
  y: number
  w: number
  h: number
  open: boolean
  color: string
  ox: number
  oy: number
}) {
  const cam = createDrawCam({ ox, oy })
  if (open) {
    return (
      <HingedDoor
        hingeX={x}
        y={y}
        z={0}
        width={w}
        height={h}
        thickness={18}
        side="left"
        color={color}
        cam={cam}
      />
    )
  }
  return <Board x={x} y={y} z={0} w={w} h={h} d={18} color={color} cam={cam} faces={{ front: true, top: true, right: true }} />
}

export function CabinetGroupView({
  host,
  guests,
  showDimLines = false,
  showOpeningDims = false,
  showFronts = false,
  drawStyle = 'line',
  doorView = 'closed',
  carcassColor,
  frontColor,
  carcassImage,
  frontImage,
  backColor,
  backImage,
  finishes,
}: CabinetGroupViewProps) {
  const [hostFrame, setHostFrame] = useState<DrawFrame | null>(null)
  const [guestFrames, setGuestFrames] = useState<(DrawFrame | null)[]>([])
  const onHost = useCallback((frame: DrawFrame) => {
    setHostFrame((prev) => (sameFrame(prev, frame) ? prev : frame))
  }, [])
  const onGuest = useCallback((index: number, frame: DrawFrame) => {
    setGuestFrames((prev) => {
      if (sameFrame(prev[index] ?? null, frame)) return prev
      const next = prev.slice()
      next[index] = frame
      return next
    })
  }, [])

  const hostSize = cabinetOuterSize(host.typeId, host.params)
  const guestSizes = guests.map((guest) => cabinetOuterSize(guest.typeId, guest.params))
  const laid = arrangeMany(
    hostSize,
    guests.map((guest, index) => ({ size: guestSizes[index]!, place: guest.place })),
  )
  const model = drawStyle === 'model'
  const look = {
    showDimLines,
    showOpeningDims,
    showFronts,
    drawStyle,
    doorView,
    carcassColor,
    frontColor,
    carcassImage,
    frontImage,
    backColor,
    backImage,
    finishes,
    part: 'main' as const,
  }
  const pictured = drawStyle === 'color' || drawStyle === 'model'
  const doorColor = pictured ? frontColor || parsePartColors(host.params.colors).side : FRONT_FILL
  const doorDecor =
    (drawStyle === 'color' || drawStyle === 'model') && frontColor && frontImage
      ? [{ color: frontColor, image: frontImage }]
      : []
  const spans: SpanDoor[] = []
  guests.forEach((guest, index) => {
    const spot = laid.guests[index]!
    const size = guestSizes[index]!
    const leaves = spanDoorCountOf(guest)
    if (leaves < 1 || !attachmentTouchesHost(guests, index) || !showFronts) return
    const box = spanFrontBox(hostSize, size, guest.place, laid.host, spot)
    const leafW = box.w / leaves
    for (let leaf = 0; leaf < leaves; leaf++) {
      spans.push({ x: box.x + leaf * leafW, y: box.y, w: leafW, h: box.h })
    }
  })
  const hostHidesDoors = spans.length > 0

  const members: Member[] = [
    ...guests.map((guest, index) => ({
      key: `g${index}`,
      piece: guest,
      at: laid.guests[index]!,
      hideDoors: spanDoorCountOf(guest) > 0 && attachmentTouchesHost(guests, index) && showFronts,
      frame: guestFrames[index] ?? null,
      report: (frame: DrawFrame) => onGuest(index, frame),
    })),
    {
      key: 'host',
      piece: host,
      at: laid.host,
      hideDoors: hostHidesDoors,
      frame: hostFrame,
      report: onHost,
    },
  ].sort((a, b) => a.at.x - b.at.x || b.at.y - a.at.y)

  const placed = [
    { key: 'host', at: laid.host, size: hostSize, place: 'host' as const },
    ...guests.map((guest, index) => ({
      key: `g${index}`,
      at: laid.guests[index]!,
      size: guestSizes[index]!,
      place: guest.place,
    })),
  ]
  const heights = drawStyle === 'line' ? verticalChain(placed) : null
  const widths = drawStyle === 'line' ? horizontalChain(placed) : null
  const heightKeys = new Set(heights?.keys ?? [])
  const widthKeys = new Set(widths?.keys ?? [])
  const coveredKeys = new Set(placed.filter((piece) => topIsCovered(piece, placed)).map((piece) => piece.key))
  const chainFont = 56
  const padL = heights ? chainPad(chainFont).left : 0
  const padB = widths ? chainPad(chainFont).bottom : 0

  const preview = (member: Member) => (
    <Piece at={member.at} onFrame={member.report}>
      <CabinetPreview
        typeId={member.piece.typeId}
        params={member.piece.params}
        {...look}
        hideFeet={member.at.hideFeet}
        hideDoors={member.hideDoors}
        suppressOuterHeight={heightKeys.has(member.key)}
        suppressOuterWidth={widthKeys.has(member.key)}
        coveredTop={coveredKeys.has(member.key)}
      />
    </Piece>
  )

  const pictures = (
    <>
      {members.map((member) => (
        <span key={member.key}>{preview(member)}</span>
      ))}
      {model && (
        <DecorTextureProvider entries={doorDecor}>
          {spans.map((door) => (
            <SpanLeaf
              key={`${door.x}-${door.y}-${door.h}`}
              x={door.x}
              y={door.y}
              w={door.w}
              h={door.h}
              open={doorView === 'open'}
              color={doorColor}
              ox={0}
              oy={0}
            />
          ))}
        </DecorTextureProvider>
      )}
    </>
  )

  const framesReady = members.every((member) => member.frame != null)
  const stage = framesReady
    ? stageBoxes(members.map((member) => ({ x: member.at.x, y: member.at.y, frame: member.frame! })))
    : null

  return (
    <GroupedPreviewContext.Provider value={true}>
      <SketchGroupContext.Provider value={true}>
        {model ? (
          <CapturedModel>{pictures}</CapturedModel>
        ) : (
          <div
            className="relative w-full"
            style={
              stage
                ? { aspectRatio: `${stage.width + padL} / ${stage.height + padB}`, background: DRAW_PAPER }
                : { minHeight: 280 }
            }
          >
            {stage ? (
              <>
                {members.map((member, order) => (
                  <PlacedBox
                    key={member.key}
                    frame={member.frame!}
                    box={{ left: stage.boxes[order]!.left + padL, top: stage.boxes[order]!.top }}
                    width={stage.width + padL}
                    height={stage.height + padB}
                  >
                    {preview(member)}
                  </PlacedBox>
                ))}
                {(spans.length > 0 || heights || widths) && (
                  <svg
                    viewBox={`0 0 ${stage.width + padL} ${stage.height + padB}`}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  >
                    <DecorTextureProvider entries={doorDecor}>
                      {spans.map((door) => (
                        <SpanLeaf
                          key={`${door.x}-${door.y}-${door.h}`}
                          x={door.x}
                          y={door.y}
                          w={door.w}
                          h={door.h}
                          open={doorView === 'open'}
                          color={doorColor}
                          ox={stage.originX + padL}
                          oy={stage.originY}
                        />
                      ))}
                    </DecorTextureProvider>
                    <GroupDimChain
                      heights={heights}
                      widths={widths}
                      originX={stage.originX + padL}
                      originY={stage.originY}
                      stageHeight={stage.height}
                      font={chainFont}
                      padL={padL}
                      padB={padB}
                    />
                  </svg>
                )}
              </>
            ) : (
              <div className="invisible absolute">{pictures}</div>
            )}
          </div>
        )}
      </SketchGroupContext.Provider>
    </GroupedPreviewContext.Provider>
  )
}

interface ChainPiece {
  key: string
  at: GroupSpot
  size: { h: number; w: number; feet: number }
  place: CabinetPlace | 'host'
}

interface DimSpan {
  a: number
  b: number
  mm: number
}

interface DimChain {
  parts: DimSpan[]
  total: DimSpan
  keys: string[]
  /** World coordinate of the cabinet edge the lines measure from. */
  edge: number
}

function topIsCovered(piece: ChainPiece, pieces: ChainPiece[]) {
  return pieces.some(
    (other) =>
      other.key !== piece.key &&
      Math.abs(other.at.x - piece.at.x) < 2 &&
      other.at.y + other.size.h + other.size.feet <= piece.at.y + 2,
  )
}

/** Cabinets one above the other: each outer height, then the sum. */
function verticalChain(pieces: ChainPiece[]): DimChain | null {
  const stacked = pieces.filter((piece) => piece.place === 'above' || piece.place === 'below')
  if (stacked.length === 0) return null
  const host = pieces.find((piece) => piece.place === 'host')
  if (!host) return null
  const col = [host, ...stacked].sort((a, b) => a.at.y - b.at.y)
  const parts = col.map((piece) => {
    const outer = piece.size.h + piece.size.feet
    return { a: piece.at.y, b: piece.at.y + outer, mm: outer }
  })
  return {
    parts,
    total: {
      a: parts[0]!.a,
      b: parts[parts.length - 1]!.b,
      mm: parts.reduce((sum, part) => sum + part.mm, 0),
    },
    keys: col.map((piece) => piece.key),
    edge: host.at.x,
  }
}

/** Cabinets side by side: each width, then the sum. */
function horizontalChain(pieces: ChainPiece[]): DimChain | null {
  const beside = pieces.filter((piece) => piece.place === 'left' || piece.place === 'right')
  if (beside.length === 0) return null
  const host = pieces.find((piece) => piece.place === 'host')
  if (!host) return null
  const row = [host, ...beside].sort((a, b) => a.at.x - b.at.x)
  const parts = row.map((piece) => ({ a: piece.at.x, b: piece.at.x + piece.size.w, mm: piece.size.w }))
  return {
    parts,
    total: {
      a: parts[0]!.a,
      b: parts[parts.length - 1]!.b,
      mm: parts.reduce((sum, part) => sum + part.mm, 0),
    },
    keys: row.map((piece) => piece.key),
    edge: Math.max(...row.map((piece) => piece.at.y + piece.size.h + piece.size.feet)),
  }
}

function chainPad(font: number) {
  return { left: Math.round(font * 2.5 + 24), bottom: Math.round(font * 2.7 + 28) }
}

function fittedFont(span: number, label: string, base: number) {
  let size = base
  while (size > 18 && label.length * size * 0.62 > span - 8) size -= 10
  return size
}

function GroupDimChain({
  heights,
  widths,
  originX,
  originY,
  stageHeight,
  font,
  padL,
  padB,
}: {
  heights: DimChain | null
  widths: DimChain | null
  originX: number
  originY: number
  stageHeight: number
  font: number
  padL: number
  padB: number
}) {
  const yOf = (y: number) => originY + y
  const xOf = (x: number) => originX + x
  const xAll = 14 + font * 0.45
  const xEach = padL - 14 - font * 0.15
  const yEach = stageHeight + font * 0.7
  const yAll = stageHeight + padB - font * 0.55
  return (
    <g>
      {heights?.parts.map((part) => {
        const label = formatMm(part.mm)
        const size = fittedFont(yOf(part.b) - yOf(part.a), label, font)
        const mid = (yOf(part.a) + yOf(part.b)) / 2
        return (
          <g key={`h-${part.a}`}>
            <line x1={xEach} y1={yOf(part.a)} x2={xOf(heights.edge)} y2={yOf(part.a)} stroke={DRAW_DIM} strokeWidth={1.2} />
            <line x1={xEach} y1={yOf(part.b)} x2={xOf(heights.edge)} y2={yOf(part.b)} stroke={DRAW_DIM} strokeWidth={1.2} />
            <DimLine x1={xEach} y1={yOf(part.a)} x2={xEach} y2={yOf(part.b)} />
            <DimText x={xEach - size * 0.42} y={mid} label={label} fontSize={size} rotate={-90} />
          </g>
        )
      })}
      {heights && (
        <g>
          <line x1={xAll} y1={yOf(heights.total.a)} x2={xOf(heights.edge)} y2={yOf(heights.total.a)} stroke={DRAW_DIM} strokeWidth={1.2} />
          <line x1={xAll} y1={yOf(heights.total.b)} x2={xOf(heights.edge)} y2={yOf(heights.total.b)} stroke={DRAW_DIM} strokeWidth={1.2} />
          <DimLine x1={xAll} y1={yOf(heights.total.a)} x2={xAll} y2={yOf(heights.total.b)} />
          <DimText
            x={xAll}
            y={(yOf(heights.total.a) + yOf(heights.total.b)) / 2}
            label={formatMm(heights.total.mm)}
            fontSize={font}
            rotate={-90}
          />
        </g>
      )}
      {widths?.parts.map((part) => {
        const label = formatMm(part.mm)
        const size = fittedFont(xOf(part.b) - xOf(part.a), label, font)
        return (
          <g key={`w-${part.a}`}>
            <line x1={xOf(part.a)} y1={yEach} x2={xOf(part.a)} y2={yOf(widths.edge)} stroke={DRAW_DIM} strokeWidth={1.2} />
            <line x1={xOf(part.b)} y1={yEach} x2={xOf(part.b)} y2={yOf(widths.edge)} stroke={DRAW_DIM} strokeWidth={1.2} />
            <DimLine x1={xOf(part.a)} y1={yEach} x2={xOf(part.b)} y2={yEach} />
            <DimText x={(xOf(part.a) + xOf(part.b)) / 2} y={yEach + size * 0.55} label={label} fontSize={size} />
          </g>
        )
      })}
      {widths && (
        <g>
          <line x1={xOf(widths.total.a)} y1={yAll} x2={xOf(widths.total.a)} y2={yOf(widths.edge)} stroke={DRAW_DIM} strokeWidth={1.2} />
          <line x1={xOf(widths.total.b)} y1={yAll} x2={xOf(widths.total.b)} y2={yOf(widths.edge)} stroke={DRAW_DIM} strokeWidth={1.2} />
          <DimLine x1={xOf(widths.total.a)} y1={yAll} x2={xOf(widths.total.b)} y2={yAll} />
          <DimText
            x={(xOf(widths.total.a) + xOf(widths.total.b)) / 2}
            y={yAll + font * 0.62}
            label={formatMm(widths.total.mm)}
            fontSize={font}
          />
        </g>
      )}
    </g>
  )
}

function PlacedBox({
  frame,
  box,
  width,
  height,
  children,
}: {
  frame: DrawFrame
  box: { left: number; top: number }
  width: number
  height: number
  children: ReactNode
}) {
  const style: CSSProperties = {
    position: 'absolute',
    left: `${(box.left / width) * 100}%`,
    top: `${(box.top / height) * 100}%`,
    width: `${(frame.vbW / width) * 100}%`,
    height: `${(frame.vbH / height) * 100}%`,
    overflow: 'hidden',
  }
  return <div style={style}>{children}</div>
}
