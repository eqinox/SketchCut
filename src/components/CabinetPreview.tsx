import React, { type ReactNode } from 'react'
import { formatMm } from '@/lib/utils'
import { KITCHEN_BASE_JOINERY, KITCHEN_WALL_JOINERY, measureCarcass } from '@/lib/cabinets/joinery'
import {
  parseKitchenBaseParams,
  parseKitchenWallParams,
  parseNightstandParams,
  parseVanityParams,
  parseBedParams,
  vanityBackSpans,
  vanityOpening,
  VANITY_MIRROR_BOARD_MM,
  zoneInVanityKnee,
  parseSectionParams,
  parseWardrobeParams,
  measureNightstand,
  shelfFrontInsetMm,
  shelfPanelDepth,
  DEFAULT_HARDBOARD_COLOR,
  HARDBOARD_RAW_COLOR,
  FASCIA_SETBACK_MM,
  kitchenClearInnerH,
  wallBottomHole,
  wallShelfHole,
  drawerBoxRails,
  isSoftCloseSlide,
  DOOR_GAP_X,
  DRAWER_DOOR_GAP,
  INNER_DRAWER_GAP_X,
  INNER_DRAWER_SIDE_GAP_EACH,
  layoutInterior,
  layoutCounts,
  type DoorCount,
  parsePartColors,
  uniqueDrawerBoxes,
  zoneFrontBox,
  zoneInsetFrontBox,
  stackFronts,
  shelvesForColumn,
  layoutSlidingDoors,
  slidingProfileMm,
  threeDoorGabarit,
  SLIDING_BOTTOM_TRACK_MM,
  SLIDING_DOOR_BOTTOM_CLEAR_MM,
  SLIDING_DRAWER_FROM_BOTTOM_MM,
  SLIDING_UPPER_TRACK_DEPTH_MM,
  SLIDING_UPPER_TRACK_HEIGHT_MM,
  SLIDING_LOWER_TRACK_DEPTH_MM,
  SLIDING_LOWER_TRACK_INSET_MM,
  CLOTHES_RAIL_SECTION_MM,
  type KitchenBaseParams,
  type KitchenWallParams,
  type NightstandParams,
  type DrawerBoxRails,
  type InteriorLayout,
  type PanelHole,
} from '@/lib/cabinets'
import { BedPreview } from '@/components/BedPreview'
import { MIRROR_GLASS_COLOR, MIRROR_HALO_COLOR, MIRROR_HALO_INSET_MM, mirrorCoversDoor, mirrorGlass, parseMirrorSpec, type MirrorSpec } from '@/lib/cabinets/mirror'
import { PullChoiceContext, pullChoiceFrom, type PullSku } from '@/lib/cabinets/pulls'
import {
  BETWEEN_FACES,
  Board,
  BOX_FACES,
  PieceColorContext,
  usePiecePaint,
  ClothesRailBar,
  DimLine,
  DimText,
  WorldDim,
  DRAW_STROKE,
  DRAW_DIM,
  SIDE_LEFT_BODY,
  SIDE_LEFT_TOP,
  SIDE_RIGHT,
  DecorTextureProvider,
  HingedDoor,
  SketchSvg,
  createDrawCam,
  hingeSwingPad,
  type DrawCam,
  type DrawFaces,
} from '@/lib/cabinets/draw-3d'
import type { DrawFrame } from '@/lib/cabinets/compose'
import { cn } from '@/lib/utils'
import { DrawPlaceContext, useCaptureSolid, type SceneSolid } from '@/lib/cabinets/scene-solids'
import { paintForPieceFinishes, type BoardFinish } from '@/lib/board-finishes'
import { CapturedModel } from '@/components/CabinetModel'

interface CabinetPreviewProps {
  typeId?: string
  params: Record<string, unknown>
  className?: string
  /** Extension lines and arrows. Off by default — sizes sit next to the panels. */
  showDimLines?: boolean
  /** Inner openings between partitions and shelves — count depends on the layout. */
  showOpeningDims?: boolean
  /** Draw doors, drawer fronts and drawer faces on the 3D view. */
  showFronts?: boolean
  /** Line drawing, coloured drawing, or a model you can turn. */
  drawStyle?: 'line' | 'color' | 'model'
  /** Hidden, shut, or stood beside the cabinet so the inside shows. */
  doorView?: 'hidden' | 'closed' | 'open'
  carcassColor?: string
  frontColor?: string
  carcassImage?: string
  frontImage?: string
  /** Not used for now: the back is always white inside and bare fibreboard behind. */
  backColor?: string
  backImage?: string
  /** Drop this cabinet's own doors. A door across two cabinets is drawn outside. */
  hideDoors?: boolean
  /** The group drawing shows this height, so the cabinet does not write it again. */
  suppressOuterHeight?: boolean
  /** The group drawing shows this width, so the cabinet does not write it again. */
  suppressOuterWidth?: boolean
  /** A cabinet stands on this top, so depth and width cannot stay there. */
  coveredTop?: boolean
  /** The box above another one. Its legs would sit in the lower cabinet. */
  hideFeet?: boolean
  /** A click in the 3D view chose a handle for one door or drawer. */
  onPullChange?: (key: string, sku: PullSku) => void
  /**
   * Capture hinged doors the way the 3D view does, without starting a second
   * picture. The room photograph uses this so a click can open the door.
   */
  captureSolids?: boolean
  /** main = the front picture only. extras = the small drawings under it. */
  part?: PreviewPart
  /** Workshop boards. A clicked piece takes its colour and photo from one of these. */
  finishes?: BoardFinish[]
}

const SLIDE_STROKE_COLOR = DRAW_STROKE
const CLOTHES_RAIL_COLOR = '#94a3b8'
const SHELF_PIN_COLOR = '#6b7280'

function hingeLeaf(layout: InteriorLayout, width: number): { leaf: number; pair: boolean } {
  const spans: { w: number; n: number }[] = []
  if (layout.fullDoorCount > 0) spans.push({ w: width, n: layout.fullDoorCount })
  for (const zone of layout.zones) {
    if (zone.doorCount > 0) spans.push({ w: zone.frontWidth > 0 ? zone.frontWidth : width, n: zone.doorCount })
  }
  if (spans.length === 0) return { leaf: width, pair: false }
  let leaf = 0
  let pair = false
  for (const s of spans) {
    const one = s.w / Math.max(1, s.n)
    if (one > leaf) leaf = one
    if (s.n >= 2) pair = true
  }
  return { leaf, pair }
}

function viewPad(
  open: boolean,
  layout: InteriorLayout,
  width: number,
  slide: boolean,
): { left: number; right: number; bottom: number } {
  if (!open) return { left: 0, right: 0, bottom: 0 }
  if (slide) return { left: width + 80, right: width / 2 + 80, bottom: 0 }
  const swing = hingeLeaf(layout, width)
  return hingeSwingPad(swing.leaf, swing.pair)
}

function shelfPinMark(vbH: number) {
  return Math.max(8, Math.min(32, vbH * (5 / 460)))
}

/** Line drawings keep sizes and shelf pins. The coloured picture and the 3D model do not. */
const ShowCabinetMarks = React.createContext(true)
/** The group drawing writes these sizes once, for each cabinet and for the whole. */
const SuppressOuterDims = React.createContext({ height: false, width: false })
/** Another cabinet sits on this top, so the sizes that were there move down. */
const CoveredTopContext = React.createContext(false)
const PreviewIsModel = React.createContext(false)
const CaptureSolidsOnly = React.createContext(false)

type DrawerHardware = {
  cabinetWidth: number
  slideLength: number
  soft: boolean
  sideColor: string
}

const DrawerHardwareContext = React.createContext<DrawerHardware | null>(null)

function drawerHardwareValue(
  p: { width: number; slideLength: number; slideKind: KitchenBaseParams['slideKind']; colors: { side: string } },
): DrawerHardware {
  return {
    cabinetWidth: p.width,
    slideLength: p.slideLength,
    soft: isSoftCloseSlide(p.slideKind),
    sideColor: p.colors.side,
  }
}
const HideDoorsContext = React.createContext(false)
const DoorMirrorContext = React.createContext<MirrorSpec | null>(null)
/** The picture is one piece of a larger drawing, so it has no card of its own. */
export const GroupedPreviewContext = React.createContext(false)
export const DrawFrameContext = React.createContext<((frame: DrawFrame) => void) | null>(null)
type PreviewPart = 'all' | 'main' | 'extras'
const PreviewPartContext = React.createContext<PreviewPart>('all')

function PlacedSketch({ frame, children }: { frame: DrawFrame; children: ReactNode }) {
  const report = React.useContext(DrawFrameContext)
  const place = React.useContext(DrawPlaceContext)
  const key = `${frame.ox}|${frame.top}|${frame.w}|${frame.h}|${frame.feet}|${frame.vbW}|${frame.vbH}`
  React.useLayoutEffect(() => {
    report?.(frame)
  }, [report, key])
  return (
    <DrawPlaceContext.Provider value={{ x: place.x, y: place.y, localLeft: 0, localTop: frame.top }}>
      {children}
    </DrawPlaceContext.Provider>
  )
}

function useCabinetMarks() {
  return React.useContext(ShowCabinetMarks)
}

function useSuppressOuter() {
  return React.useContext(SuppressOuterDims)
}

function useCoveredTop() {
  return React.useContext(CoveredTopContext)
}

/** Depth size. On top when the edge is free, otherwise outside the lower right edge. */
function depthMark(ox: number, edgeY: number, dx: number, dy: number, gap: number, width: number, covered: boolean) {
  const len = Math.hypot(dx, dy) || 1
  const rot = (Math.atan2(dy, dx) * 180) / Math.PI
  if (!covered) {
    const nx = dy / len
    const ny = -dx / len
    return {
      x: ox + dx / 2 + nx * gap,
      y: edgeY + dy / 2 + ny * gap,
      rot,
      x1: ox,
      y1: edgeY - 8,
      x2: ox + dx,
      y2: edgeY + dy - 8,
    }
  }
  const px = (-dy / len) * gap
  const py = (dx / len) * gap
  const x0 = ox + width
  return {
    x: x0 + dx / 2 + px,
    y: edgeY + dy / 2 + py,
    rot,
    x1: x0 + px * 0.3,
    y1: edgeY + py * 0.3,
    x2: x0 + dx + px * 0.3,
    y2: edgeY + dy + py * 0.3,
  }
}
const SLIDE_PROFILE_H = 18
const SLIDE_FRONT_INSET = 28
const SLIDE_STROKE = 10
export const FRONT_FILL = '#c4a06a'

/** The cabinet itself has a door or a drawer front. Sliding leaves count too. */
function layoutHasFronts(layout: InteriorLayout, slidingDoors = false): boolean {
  if (slidingDoors) return true
  if (layout.fullDoorCount > 0 || layout.fullDrawerFrontHeights.length > 0) return true
  return layout.zones.some((z) => z.doorCount > 0 || z.drawerFrontHeights.some((h) => h > 0))
}

function mm(n: number) {
  return formatMm(n)
}

function scaledDimFont(base: number, scale: number) {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1
  return Math.max(8, base * s)
}

function drawerSlideStacks(
  layout: InteriorLayout,
  opts: {
    innerFloorY: number
    carcassTopY: number
    carcassBotY: number
    thickness: number
    innerTopY?: number
    innerBotY?: number
    inset?: boolean
  },
): {
  id: string
  heights: number[]
  box: { y: number; h: number }
  doorCount: DoorCount
}[] {
  const innerTopY = opts.innerTopY ?? opts.carcassTopY
  const innerBotY = opts.innerBotY ?? opts.carcassBotY
  const sources: {
    id: string
    heights: number[]
    box: { y: number; h: number }
    doorCount: DoorCount
  }[] = []
  if (layout.fullDrawerFrontHeights.length > 0) {
    sources.push({
      id: 'full',
      heights: layout.fullDrawerFrontHeights,
      box: opts.inset
        ? { y: innerTopY, h: Math.max(1, innerBotY - innerTopY) }
        : { y: opts.carcassTopY, h: Math.max(1, opts.carcassBotY - opts.carcassTopY) },
      doorCount: layout.fullDoorCount,
    })
  }
  for (const zone of layout.zones) {
    if (zone.drawerFrontHeights.length === 0) continue
    sources.push({
      id: zone.id,
      heights: zone.drawerFrontHeights,
      box: opts.inset
        ? zoneInsetFrontBox(zone, { innerFloorY: opts.innerFloorY, innerTopY, innerBotY })
        : zoneFrontBox(zone, opts),
      doorCount: zone.doorCount,
    })
  }
  return sources
}

function drawerFrontTopY(
  box: { y: number; h: number },
  doorCount: DoorCount,
  heights: number[],
  index: number,
  clearanceBottom = 0,
  fromTop = false,
): number {
  const row = stackFronts({
    frontHeight: box.h,
    doorCount,
    drawerFrontHeights: heights,
    clearanceBottom,
    fromTop,
  }).find((s) => s.kind === 'drawer' && s.index === index)
  return box.y + (row?.yFromFrontTop ?? 0)
}

function drawerSlideWorldX(layout: InteriorLayout, sourceId: string, thickness: number): number {
  if (sourceId === 'full') return thickness
  const zone = layout.zones.find((z) => z.id === sourceId)
  if (!zone) return thickness
  return thickness + zone.x0
}

function SlideBar({
  x,
  y,
  z,
  length,
  h,
}: {
  x: number
  y: number
  z: number
  length: number
  h: number
}) {
  useCaptureSolid(
    length > 1
      ? { kind: 'box', x, y, z, w: 14, h, d: length, color: '#8b919a' }
      : null,
  )
  return null
}

function columnsWithDrawers(layout: InteriorLayout): Set<number> {
  const out = new Set<number>()
  if (layout.fullDrawerFrontHeights.length > 0) {
    layout.columns.forEach((_, i) => out.add(i))
  }
  for (const z of layout.zones) {
    if (z.drawerFrontHeights.length > 0) out.add(z.colIndex ?? 0)
  }
  return out
}

function DrawerSlidesOnCabinet({
  layout,
  T,
  cam,
  z0,
  partitionFrontZ,
  width,
  thickness,
  slideLength,
  slideKind,
  innerFloorY,
  carcassTopY,
  carcassBotY,
  fontScale = 1,
  clearanceBottom = 0,
  innerTopY,
  innerBotY,
  insetFronts = false,
  opening,
  zLimit,
  seatPageZ,
  seatShelfZ,
  /** Knee opening, in inner-left coordinates. Drawers there hang from the top. */
  hangFromTop,
}: {
  layout: InteriorLayout
  T: number
  cam: ReturnType<typeof createDrawCam>
  z0: number
  /** Front of a set-back inner partition. Zone drawers on that wall start here, not at the outer side. */
  partitionFrontZ?: number
  width: number
  thickness: number
  slideLength: number
  slideKind: KitchenBaseParams['slideKind']
  innerFloorY: number
  carcassTopY: number
  carcassBotY: number
  fontScale?: number
  clearanceBottom?: number
  innerTopY?: number
  innerBotY?: number
  insetFronts?: boolean
  /** Only the drawers in this opening. The page on its right is drawn afterwards. */
  opening?: { x0: number; x1: number; includeFull?: boolean; zoneId?: string }
  /** Inside face of the back. The runner stops here and does not come out past the hardboard. */
  zLimit?: number
  /** Front edge of the pages, used so a set-back inner front does not leave the runner in front of it. */
  seatPageZ?: number
  seatShelfZ?: number
  hangFromTop?: { x0: number; x1: number } | null
}) {
  const marks = useCabinetMarks()
  return (
    <>
      {drawerSlideStacks(layout, {
        innerFloorY,
        carcassTopY,
        carcassBotY,
        thickness: T,
        innerTopY,
        innerBotY,
        inset: insetFronts,
      }).flatMap((src) =>
        src.heights.map((frontH, i) => {
          const zone = src.id === 'full' ? undefined : layout.zones.find((z) => z.id === src.id)
          if (opening) {
            if (opening.zoneId) {
              if (src.id !== opening.zoneId) return null
            } else if (src.id === 'full') {
              if (!opening.includeFull) return null
            } else if (!zone || zone.x0 < opening.x0 - 0.5 || zone.x1 > opening.x1 + 0.5) return null
          }
          const openingW = zone && zone.innerW > 0 ? zone.innerW : width - 2 * thickness
          const rails = drawerBoxRails(
            width,
            thickness,
            frontH,
            slideLength,
            isSoftCloseSlide(slideKind),
            openingW,
          )
          if (!rails) return null
          const x = drawerSlideWorldX(layout, src.id, T)
          const bottomGap = src.id === 'full' || (zone != null && zone.y0 <= 0.5) ? clearanceBottom : 0
          const baseStart =
            partitionFrontZ != null && zone != null && zone.x0 > 0.5
              ? partitionFrontZ
              : z0
          const face =
            insetFronts && seatPageZ != null
              ? innerDrawerFaceZ(
                  seatPageZ,
                  seatShelfZ ?? seatPageZ,
                  zone != null && !(zone.isFirst && zone.isLast),
                )
              : null
          const startZ = face != null ? Math.max(baseStart, face + thickness) : baseStart
          const room = zLimit != null ? Math.max(1, zLimit - startZ) : slideLength
          const drawn = Math.min(slideLength, room)
          const z1 = startZ + drawn
          const yBot =
            drawerFrontTopY(
              src.box,
              src.doorCount,
              src.heights,
              i,
              bottomGap,
              zone != null && zoneInVanityKnee(zone, hangFromTop),
            ) + rails.outer.height
          const yTopS = yBot - SLIDE_PROFILE_H
          const a0 = cam.proj(x, yTopS, startZ)
          const a1 = cam.proj(x, yTopS, z1)
          const b0 = cam.proj(x, yBot, startZ)
          const b1 = cam.proj(x, yBot, z1)
          const mid = cam.proj(x, yTopS, startZ + drawn / 2)
          const slideFont = scaledDimFont(Math.max(32, Math.min(slideLength * 0.1, 56)), fontScale)
          return (
            <g key={`slide-${src.id}-${i}`}>
              <SlideBar x={x} y={yTopS} z={startZ} length={drawn} h={SLIDE_PROFILE_H} />
              <SlideBar
                x={x + Math.max(0, openingW - 14)}
                y={yTopS}
                z={startZ}
                length={drawn}
                h={SLIDE_PROFILE_H}
              />
              <g stroke={SLIDE_STROKE_COLOR} fill="none" strokeWidth={SLIDE_STROKE} strokeLinecap="butt">
                <line x1={a0.x} y1={a0.y} x2={a1.x} y2={a1.y} />
                <line x1={b0.x} y1={b0.y} x2={b1.x} y2={b1.y} />
              </g>
              {marks && i === 0 && (
                <DimText
                  x={mid.x + 18}
                  y={mid.y - 8}
                  label={mm(slideLength)}
                  fontSize={slideFont}
                  fill={SLIDE_STROKE_COLOR}
                />
              )}
            </g>
          )
        }),
      )}
    </>
  )
}

function WithDecor({
  entries,
  children,
}: {
  entries: { color: string; image: string }[]
  children: ReactNode
}) {
  // Always the same wrapper: adding or dropping it would rebuild the 3D picture and close its menu.
  return <DecorTextureProvider entries={entries}>{children}</DecorTextureProvider>
}

/** Hands a mirror's halo light to the 3D picture. Draws nothing in the drawing itself. */
function GlowCapture({ solid }: { solid: Extract<SceneSolid, { kind: 'glow' }> }) {
  useCaptureSolid(solid)
  return null
}

/** White 8 mm strip with 2835 LEDs, 60 per metre. */
const HALO_STRIP_W_MM = 8
const HALO_STRIP_T_MM = 1.5
const HALO_LED_PITCH_MM = 1000 / 60

/**
 * Everything behind a mirror lit from behind, at its real size: a second board screwed on the
 * mirror board, 40 mm in from the glass edge on every side, with the glass glued on its face; the
 * LED strip round that board's edge with every LED; the 12 V driver on the back of the mirror board
 * with its cables through a hole; and the switch on the board's right edge.
 * Only for the 3D picture; the drawing shows the glass alone.
 */
function haloParts(
  glass: { x: number; y: number; width: number; height: number },
  boardFront: number,
  boardRight: number,
  boardT: number,
  boardColor: string,
  tone: keyof typeof MIRROR_HALO_COLOR,
  switchY: number,
): Extract<SceneSolid, { kind: 'box' }>[] {
  const x0 = glass.x + MIRROR_HALO_INSET_MM
  const x1 = glass.x + glass.width - MIRROR_HALO_INSET_MM
  const y0 = glass.y + MIRROR_HALO_INSET_MM
  const y1 = glass.y + glass.height - MIRROR_HALO_INSET_MM
  if (x1 - x0 < 100 || y1 - y0 < 100) return []
  const z = boardFront - boardT
  const box = (x: number, y: number, zz: number, w: number, h: number, d: number, color: string) =>
    ({ kind: 'box', x, y, z: zz, w, h, d, color, assembly: 'mirror' }) as const
  // The second board, as thick as the mirror board, in the same decor.
  const parts: Extract<SceneSolid, { kind: 'box' }>[] = [box(x0, y0, z, x1 - x0, y1 - y0, boardT, boardColor)]
  // The strip round its edge, so the light falls on the mirror board round the glass.
  const zs = z + (boardT - HALO_STRIP_W_MM) / 2
  const T = HALO_STRIP_T_MM
  const strip = '#f1f1ec'
  parts.push(
    box(x0, y0 - T, zs, x1 - x0, T, HALO_STRIP_W_MM, strip),
    box(x0, y1, zs, x1 - x0, T, HALO_STRIP_W_MM, strip),
    box(x0 - T, y0, zs, T, y1 - y0, HALO_STRIP_W_MM, strip),
    box(x1, y0, zs, T, y1 - y0, HALO_STRIP_W_MM, strip),
  )
  const led = MIRROR_HALO_COLOR[tone]
  const L = 3.5
  const zl = z + (boardT - 2.8) / 2
  const leds = (from: number, to: number, place: (at: number) => Extract<SceneSolid, { kind: 'box' }>) => {
    for (let at = from + HALO_LED_PITCH_MM / 2; at + L <= to; at += HALO_LED_PITCH_MM) parts.push(place(at))
  }
  leds(x0, x1, (at) => box(at, y0 - T - 0.8, zl, L, 0.8, 2.8, led))
  leds(x0, x1, (at) => box(at, y1 + T, zl, L, 0.8, 2.8, led))
  leds(y0, y1, (at) => box(x0 - T - 0.8, at, zl, 0.8, L, 2.8, led))
  leds(y0, y1, (at) => box(x1 + T, at, zl, 0.8, L, 2.8, led))
  const cable = '#f4f4f0'
  const back = boardFront + boardT
  // The strip's lead at the top right corner goes through a hole in the mirror board.
  const holeX = x1 + 12
  const holeY = y0 + 30
  parts.push(box(x1 + T, holeY, zs + 1, holeX - x1 - T, 5, 5, cable))
  parts.push(box(holeX, holeY, zs + 1, 5, 5, back - zs - 1 + 4, cable))
  // Slim 12 V driver screwed on the back of the mirror board, behind the top right of the glass.
  const driverW = 160
  const driverX = Math.max(x0, holeX - 60 - driverW)
  const driverY = holeY + 40
  parts.push(box(driverX, driverY, back, driverW, 32, 22, '#2a2a2d'))
  // On the back: strip lead to the driver, and the mains lead to the switch and on to the socket.
  parts.push(box(holeX, holeY, back, 5, driverY + 6 - holeY + 5, 5, cable))
  parts.push(box(driverX + driverW, driverY + 6, back, holeX - driverX - driverW, 5, 5, cable))
  const mainsY = driverY + 24
  parts.push(box(driverX + driverW, mainsY, back, boardRight - 12 - driverX - driverW, 5, 5, cable))
  parts.push(box(boardRight - 12, mainsY, back, 5, Math.max(5, switchY + 20 - mainsY), 5, cable))
  parts.push(box(boardRight - 12, switchY + 20, back, 12, 5, 5, cable))
  // Rocker switch on the board's right edge, within reach above the desk.
  parts.push(box(boardRight, switchY, boardFront + (boardT - 14) / 2, 6, 40, 14, '#f6f6f3'))
  parts.push(box(boardRight + 6, switchY + 6, boardFront + (boardT - 8) / 2, 4, 28, 8, '#d9d9d4'))
  return parts
}

/** Single 3D front view with depth extending to the right. */
export function CabinetPreview(props: CabinetPreviewProps) {
  const pictured = props.drawStyle === 'color' || props.drawStyle === 'model' || props.captureSolids === true
  const piecePaint = paintForPieceFinishes(props.params.pieceFinishes, props.finishes ?? [])
  return (
    <PieceColorContext.Provider value={pictured ? piecePaint.colors : {}}>
    <DoorMirrorContext.Provider value={parseMirrorSpec(props.params.doorMirror)}>
    <PullChoiceContext.Provider value={pullChoiceFrom(props.params, props.onPullChange)}>
      <CaptureSolidsOnly.Provider value={props.captureSolids === true}>
        <CabinetPreviewView {...props} />
      </CaptureSolidsOnly.Provider>
    </PullChoiceContext.Provider>
    </DoorMirrorContext.Provider>
    </PieceColorContext.Provider>
  )
}

function CabinetPreviewView({
  typeId = 'kitchen-base',
  params,
  className,
  showDimLines = false,
  showOpeningDims = false,
  showFronts = false,
  drawStyle = 'line',
  doorView = 'closed',
  carcassColor,
  frontColor,
  carcassImage,
  frontImage,
  finishes = [],
  hideDoors = false,
  hideFeet = false,
  part = 'all',
  captureSolids = false,
  suppressOuterHeight = false,
  suppressOuterWidth = false,
  coveredTop = false,
}: CabinetPreviewProps) {
  const openDoors = doorView === 'open'
  const pictured = drawStyle === 'color' || drawStyle === 'model' || captureSolids
  // The back is white on the inside and bare fibreboard behind. It has no other colours for now.
  const backFill = pictured ? '#ffffff' : DEFAULT_HARDBOARD_COLOR
  const drawnParams =
    pictured && carcassColor
      ? {
          ...params,
          colors: {
            ...parsePartColors(params.colors),
            bottom: carcassColor,
            side: carcassColor,
            rail: carcassColor,
            shelf: carcassColor,
          },
        }
      : params
  const doorColor = pictured ? frontColor : undefined
  const textureEntries = [
    ...(pictured
      ? [
          ...(carcassColor && carcassImage ? [{ color: carcassColor, image: carcassImage }] : []),
          ...(doorColor && frontImage ? [{ color: doorColor, image: frontImage }] : []),
          ...paintForPieceFinishes(params.pieceFinishes, finishes).images,
        ]
      : []),
  ]
  const showMarks = drawStyle === 'line' || drawStyle === 'model'
  const model = drawStyle === 'model' || captureSolids
  const suppressOuter = { height: suppressOuterHeight, width: suppressOuterWidth }
  if (typeId === 'bed') {
    return (
      <ShowCabinetMarks.Provider value={showMarks}>
      <PreviewPartContext.Provider value={part}>
      <PreviewIsModel.Provider value={model}>
      <WithDecor entries={textureEntries}>
        <div className={cn('flex flex-col gap-3', className)}>
          <FrontDrawing title="3D Изглед отпред">
            <BedPreview params={parseBedParams(drawnParams)} showDims={showMarks} />
          </FrontDrawing>
        </div>
      </WithDecor>
      </PreviewIsModel.Provider>
      </PreviewPartContext.Provider>
      </ShowCabinetMarks.Provider>
    )
  }
  if (typeId === 'kitchen-wall') {
    return (
      <CoveredTopContext.Provider value={coveredTop}>
      <SuppressOuterDims.Provider value={suppressOuter}>
      <ShowCabinetMarks.Provider value={showMarks}>
      <HideDoorsContext.Provider value={hideDoors}>
      <PreviewPartContext.Provider value={part}>
      <PreviewIsModel.Provider value={model}>
      <WithDecor entries={textureEntries}>
      <KitchenWallPreview
        params={drawnParams}
        className={className}
        showDimLines={showDimLines}
        showOpeningDims={showOpeningDims}
        showFronts={showFronts}
        openDoors={openDoors}
        frontColor={doorColor}
        backFill={backFill}
      />
      </WithDecor>
      </PreviewIsModel.Provider>
      </PreviewPartContext.Provider>
      </HideDoorsContext.Provider>
      </ShowCabinetMarks.Provider>
      </SuppressOuterDims.Provider>
      </CoveredTopContext.Provider>
    )
  }
  if (typeId === 'nightstand' || typeId === 'vanity' || typeId === 'section' || typeId === 'wardrobe') {
    return (
      <CoveredTopContext.Provider value={coveredTop}>
      <SuppressOuterDims.Provider value={suppressOuter}>
      <ShowCabinetMarks.Provider value={showMarks}>
      <HideDoorsContext.Provider value={hideDoors}>
      <PreviewPartContext.Provider value={part}>
      <PreviewIsModel.Provider value={model}>
      <WithDecor entries={textureEntries}>
      <PlinthBoxPreview
        typeId={typeId}
        params={drawnParams}
        className={className}
        showDimLines={showDimLines}
        showOpeningDims={showOpeningDims}
        showFronts={showFronts}
        openDoors={openDoors}
        frontColor={doorColor}
        backFill={backFill}
      />
      </WithDecor>
      </PreviewIsModel.Provider>
      </PreviewPartContext.Provider>
      </HideDoorsContext.Provider>
      </ShowCabinetMarks.Provider>
      </SuppressOuterDims.Provider>
      </CoveredTopContext.Provider>
    )
  }

  const p = parseKitchenBaseParams(drawnParams)
  const m = measureCarcass(
    { width: p.width, height: p.height, depth: p.depth, thickness: p.thickness },
    KITCHEN_BASE_JOINERY,
  )
  const { colors } = p
  const layout = layoutInterior({
    innerH: kitchenClearInnerH(p.height, p.thickness, p.topStyle),
    innerW: m.innerW,
    thickness: p.thickness,
    fixedShelves: p.fixedShelves,
    partitions: p.partitions,
    doorSpan: p.doorSpan,
    doorCount: p.doorCount,
    shelfCount: p.shelfCount,
    movableShelves: p.movableShelves,
    drawerFrontHeights: p.drawerFrontHeights,
    cutFromOneBoard: p.cutFromOneBoard,
    hasClothesRail: p.hasClothesRail,
    clothesRails: p.clothesRails,
    zones: p.zones,
    overlayCovers: p.topStyle === 'rails' ? undefined : { top: false, bottom: true },
  })
  const drawerViews = uniqueDrawerViews(p, layout)

  return (
    <DrawerHardwareContext.Provider value={drawerHardwareValue(p)}>
    <CoveredTopContext.Provider value={coveredTop}>
    <SuppressOuterDims.Provider value={suppressOuter}>
    <ShowCabinetMarks.Provider value={showMarks}>
    <HideDoorsContext.Provider value={hideDoors}>
    <PreviewPartContext.Provider value={part}>
    <PreviewIsModel.Provider value={model}>
    <WithDecor entries={textureEntries}>
    <div className={cn('flex flex-col gap-3', className)}>
      <FrontDrawing title="3D Изглед отпред">
          <Front3DView
            p={p}
            m={m}
            layout={layout}
            showDimLines={showDimLines}
            showOpeningDims={showOpeningDims}
            showFronts={showFronts}
            openDoors={openDoors}
            frontColor={doorColor}
            backFill={backFill}
            hideFeet={hideFeet}
          />
      </FrontDrawing>
      <ExtraDrawings>
      {drawerViews.map((view, index) => (
        <ViewCard
          key={`${view.frontHeight}-${Math.round(view.box.drawerOuterW)}-${view.label}`}
          title={drawerViewTitle(view, drawerViews.length)}
        >
          <ZoomableView>
            <Drawer3DView p={p} box={view.box} boxKey={`${view.label}-${index}`} />
          </ZoomableView>
        </ViewCard>
      ))}
      </ExtraDrawings>
      <p className="text-center text-[11px] text-[var(--color-muted-foreground)]">
        <span className="mr-3" style={{ color: colors.bottom }}>■ Дъно</span>
        <span className="mr-3" style={{ color: colors.side }}>■ Страници</span>
        {p.topStyle !== 'none' && (
          <span className="mr-3" style={{ color: colors.rail }}>
            {p.topStyle === 'fascia' ? '■ Бленда надолу' : '■ Бленди'}
          </span>
        )}
        {(layoutCounts(layout).shelfCount > 0 || layout.shelves.length > 0) && (
          <span className="mr-3" style={{ color: colors.shelf }}>■ Рафтове</span>
        )}
        {p.hasBack && (
          <span className="mr-3" style={{ color: backFill }}>■ Фазер</span>
        )}
        {layoutCounts(layout).clothesRailCount > 0 && (
          <span className="mr-3" style={{ color: CLOTHES_RAIL_COLOR }}>■ Лост</span>
        )}
        {drawerViews.length > 0 && (
          <span className="mr-3" style={{ color: SLIDE_STROKE_COLOR }}>■ Водачи</span>
        )}
        <span style={{ color: colors.leg }}>■ Крачета</span>
        {showFronts && layoutHasFronts(layout) && (
          <span className="mr-3" style={{ color: doorColor || FRONT_FILL }}>
            {' '}■ Врати и чела
          </span>
        )}
        {!showFronts && layoutCounts(layout).doorCount > 0 && (
          <>
            {' · '}
            {layoutCounts(layout).doorCount === 1 ? '1 врата' : `${layoutCounts(layout).doorCount} врати`} (Врати → Затворени)
          </>
        )}
        {!showFronts && layoutCounts(layout).drawerCount > 0 && (
          <>
            {' · '}
            {layoutCounts(layout).drawerCount === 1
              ? '1 чекмедже'
              : `${layoutCounts(layout).drawerCount} чекмеджета`}{' '}
            (Врати → Затворени)
          </>
        )}
        {' · '}страниците сядат върху дъното, винтове отдолу
      </p>
    </div>
    </WithDecor>
    </PreviewIsModel.Provider>
    </PreviewPartContext.Provider>
    </HideDoorsContext.Provider>
    </ShowCabinetMarks.Provider>
    </SuppressOuterDims.Provider>
    </CoveredTopContext.Provider>
    </DrawerHardwareContext.Provider>
  )
}

function uniqueDrawerViews(
  p: {
    width: number
    thickness: number
    slideKind: KitchenBaseParams['slideKind']
    slideLength: number
  },
  layout: InteriorLayout,
): { frontHeight: number; box: DrawerBoxRails; count: number; label: string }[] {
  return uniqueDrawerBoxes(layout, {
    width: p.width,
    thickness: p.thickness,
    slideLength: p.slideLength,
    slideKind: p.slideKind,
  })
}

function drawerViewTitle(
  view: { frontHeight: number; count: number; label: string },
  total: number,
): string {
  const zone =
    view.label && view.label !== 'Цял шкаф' && view.label !== 'Шкаф' ? ` · ${view.label}` : ''
  const count = view.count > 1 ? ` ×${view.count}` : ''
  if (total === 1) return `Чекмедже${count}${zone}`
  return `Чекмедже ${view.frontHeight} мм${count}${zone}`
}

function shelfMeasureEndY(s: { toFace?: 'top' | 'bottom'; yTop: number; yBottom: number; endY: number }) {
  return s.toFace === 'top' ? s.yTop : s.toFace === 'bottom' ? s.yBottom : s.endY
}

function heightRangesOverlap(a0: number, a1: number, b0: number, b1: number, clearMm = 100): boolean {
  const A0 = Math.min(a0, a1)
  const A1 = Math.max(a0, a1)
  const B0 = Math.min(b0, b1)
  const B1 = Math.max(b0, b1)
  return Math.min(A1, B1) - Math.max(A0, B0) >= -clearMm
}

type HeightDimPlace = {
  id: string
  col: number
  y0: number
  y1: number
  offsetMm: number
  originZ: number
  endZ: number
  inside?: boolean
}

/** A middle shelf is stored with offset 0 so it stays centered. The line shows the real gap. */
function fixedShelfDimMm(s: InteriorLayout['shelves'][number]): number {
  if (s.from !== 'middle') return s.offsetMm
  return Math.abs(shelfMeasureEndY(s) - s.startY)
}

function heightDimSpecs(
  layout: InteriorLayout,
  opts: { originZ: number; shelfZ: number; railZ: number; shiftRightColumns?: Set<number> },
): HeightDimPlace[] {
  const dims: HeightDimPlace[] = []
  layout.shelves.forEach((s, i) => {
    dims.push({
      id: `fixed-${i}`,
      col: s.columnIndex ?? 0,
      y0: s.startY,
      y1: shelfMeasureEndY(s),
      offsetMm: fixedShelfDimMm(s),
      originZ: opts.originZ,
      endZ: opts.shelfZ,
      inside: s.columnIndex != null && opts.shiftRightColumns?.has(s.columnIndex),
    })
  })
  for (const z of layout.zones) {
    const col = z.colIndex ?? 0
    z.movable.forEach((s, i) => {
      if (s.from === 'middle') return
      dims.push({
        id: `mov-${z.id}-${i}`,
        col,
        y0: z.y0 + s.startY,
        y1: z.y0 + shelfMeasureEndY(s),
        offsetMm: s.offsetMm,
        originZ: opts.originZ,
        endZ: opts.shelfZ,
      })
    })
    z.rails.forEach((r, i) => {
      if (r.from !== 'middle') {
        dims.push({
          id: `rail-${z.id}-${i}`,
          col,
          y0: r.from === 'top' ? r.openingY1 : r.openingY0,
          y1: r.yTop,
          offsetMm: r.offsetMm,
          originZ: opts.originZ,
          endZ: opts.railZ,
        })
      }
      // Clear space under the rod, down to the nearer of the shelf below or the bottom.
      const rodBottom = r.yTop - CLOTHES_RAIL_SECTION_MM
      const clear = rodBottom - r.openingY0
      if (clear > 0.5) {
        dims.push({
          id: `hang-${z.id}-${i}`,
          col,
          y0: r.openingY0,
          y1: rodBottom,
          offsetMm: clear,
          originZ: opts.shelfZ,
          endZ: opts.railZ,
        })
      }
    })
  }
  return dims
}

/** Same column + overlapping (or touching) height spans → different X, so numbers never sit on each other. */
function placeHeightDimX(
  dims: HeightDimPlace[],
  columns: InteriorLayout['columns'],
  worldX0: number,
  fontSize: number,
): Map<string, number> {
  const stagger = Math.max(36, fontSize * 0.5)
  const inset = Math.max(28, fontSize * 0.32)
  const out = new Map<string, number>()
  const byCol = new Map<number, HeightDimPlace[]>()
  for (const d of dims) {
    const arr = byCol.get(d.col) ?? []
    arr.push(d)
    byCol.set(d.col, arr)
  }
  for (const [colIndex, list] of byCol) {
    const col = columns[colIndex]
    const lanes: HeightDimPlace[][] = []
    for (const d of list) {
      if (d.inside && col && col.innerW > 1) {
        const margin = Math.max(inset * 1.6, fontSize * 0.45)
        const fromLeft = Math.min(Math.max(col.innerW * 0.58, margin), col.innerW - margin)
        out.set(d.id, worldX0 + col.x0 + fromLeft - inset)
        continue
      }
      let lane = 0
      for (; lane < lanes.length; lane++) {
        if (!lanes[lane]!.some((o) => heightRangesOverlap(d.y0, d.y1, o.y0, o.y1))) break
      }
      if (!lanes[lane]) lanes[lane] = []
      lanes[lane]!.push(d)
      out.set(d.id, worldX0 + (col?.x0 ?? 0) + lane * stagger)
    }
  }
  return out
}

function InteriorHeightDimLines({
  layout,
  innerFloorY,
  T,
  fontSize,
  cam,
  originZ = 0,
  shelfZ = 0,
  railZ = 0,
}: {
  layout: InteriorLayout
  innerFloorY: number
  T: number
  fontSize: number
  cam: ReturnType<typeof createDrawCam>
  originZ?: number
  shelfZ?: number
  railZ?: number
}) {
  const worldX0 = T + Math.max(28, fontSize * 0.32)
  const specs = heightDimSpecs(layout, {
    originZ,
    shelfZ,
    railZ,
    shiftRightColumns: columnsWithDrawers(layout),
  })
  const xs = placeHeightDimX(specs, layout.columns, worldX0, fontSize)
  const tick = Math.max(12, fontSize * 0.22)
  return (
    <>
      {specs.map((d) => {
        const worldX = xs.get(d.id) ?? worldX0
        const a = cam.proj(worldX, innerFloorY - d.y0, d.originZ)
        const b = cam.proj(worldX, innerFloorY - d.y1, d.endZ)
        const labelFont = d.id.startsWith('rail-') ? Math.max(18, fontSize * 0.58) : fontSize
        return (
          <g key={d.id} stroke={DRAW_DIM} fill={DRAW_DIM}>
            <line x1={a.x - tick} y1={a.y} x2={a.x + tick} y2={a.y} strokeWidth={2} />
            <line x1={b.x - tick} y1={b.y} x2={b.x + tick} y2={b.y} strokeWidth={2} />
            <DimLine x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            <DimText
              x={(a.x + b.x) / 2}
              y={(a.y + b.y) / 2}
              label={mm(d.offsetMm)}
              fontSize={labelFont}
              rotate={-90}
              fill={DRAW_DIM}
            />
            <WorldDim
              label={mm(d.offsetMm)}
              x0={worldX}
              y0={innerFloorY - d.y0}
              z0={d.originZ}
              x1={worldX}
              y1={innerFloorY - d.y1}
              z1={d.endZ}
            />
          </g>
        )
      })}
    </>
  )
}

function spansOverlap(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
  frac = 0.8,
): boolean {
  const opening = a1 - a0
  if (opening <= 0) return true
  return Math.min(a1, b1) - Math.max(a0, b0) >= opening * frac
}

/** A measure that runs across another divider, not just up to the next one. */
function isOverallPartitionMeasure(
  partition: InteriorLayout['partitions'][number],
  partitions: InteriorLayout['partitions'],
): boolean {
  const a = Math.min(partition.startX, partition.endX)
  const b = Math.max(partition.startX, partition.endX)
  return partitions.some((other) => {
    if (other === partition) return false
    const mid = (other.xLeft + other.xRight) / 2
    return mid > a + 0.5 && mid < b - 0.5
  })
}

/** Clear openings that the user did not already measure (the leftover on the other side). */
function leftoverPartitionSpans(
  partitions: InteriorLayout['partitions'],
  columns: InteriorLayout['columns'],
): { startX: number; endX: number; offsetMm: number }[] {
  if (partitions.length === 0) return []
  const measured = partitions
    .filter((p) => p.from !== 'middle' && !isOverallPartitionMeasure(p, partitions))
    .map((p) => {
      const a = Math.min(p.startX, p.endX)
      const b = Math.max(p.startX, p.endX)
      return { a, b }
    })
  return columns
    .filter((col) => col.innerW > 0.5 && !measured.some((m) => spansOverlap(col.x0, col.x1, m.a, m.b)))
    .map((col) => ({ startX: col.x0, endX: col.x1, offsetMm: col.innerW }))
}

/**
 * A bay that still sits on the old equal third (776 at width 2400) is written as the
 * door-aligned size: the ends are gabarit minus the divider, the middle is what remains.
 */
function doorAlignedOpeningMm(
  startX: number,
  endX: number,
  offsetMm: number,
  innerW: number,
  thickness: number,
): number {
  const span = Math.abs(endX - startX)
  const third = (innerW - 2 * thickness) / 3
  const nearThird = Math.abs(span - third) < 0.05 || Math.abs(offsetMm - third) < 0.05
  if (!nearThird || !(innerW > 0)) return offsetMm
  const end = threeDoorGabarit(innerW) - thickness
  const middle = innerW - 2 * thickness - 2 * end
  const mid = (Math.min(startX, endX) + Math.max(startX, endX)) / 2
  return Math.abs(mid - innerW / 2) < third * 0.6 ? middle : end
}

/** Door widths, in the same dimension row as the bay sizes. Gabarit, then the cut if it differs. */
function slidingDoorDimSpans(
  leaves: {
    x: number
    gabaritW: number
    cutW: number
    edges: { left: Parameters<typeof slidingProfileMm>[0]; right: Parameters<typeof slidingProfileMm>[0] }
  }[],
): { startX: number; endX: number; offsetMm: number }[] {
  return leaves.flatMap((leaf) => {
    const gabarit = { startX: leaf.x, endX: leaf.x + leaf.gabaritW, offsetMm: leaf.gabaritW }
    if (Math.abs(leaf.cutW - leaf.gabaritW) < 1e-6) return [gabarit]
    const left = slidingProfileMm(leaf.edges.left)
    return [gabarit, { startX: leaf.x + left, endX: leaf.x + left + leaf.cutW, offsetMm: leaf.cutW }]
  })
}

/** Openings not already labeled by a measure line or leftover. */
function openingWidthSpans(
  partitions: InteriorLayout['partitions'],
  columns: InteriorLayout['columns'],
): { startX: number; endX: number; offsetMm: number }[] {
  if (columns.length <= 1) return []
  const drawn = partitions
    .filter((p) => p.from !== 'middle' && !isOverallPartitionMeasure(p, partitions))
    .map((p) => ({ a: Math.min(p.startX, p.endX), b: Math.max(p.startX, p.endX) }))
  const leftover = leftoverPartitionSpans(partitions, columns)
  const labeled = [
    ...drawn,
    ...leftover.map((s) => ({ a: Math.min(s.startX, s.endX), b: Math.max(s.startX, s.endX) })),
  ]
  return columns
    .filter(
      (col) => col.innerW > 0.5 && !labeled.some((m) => spansOverlap(col.x0, col.x1, m.a, m.b)),
    )
    .map((col) => ({ startX: col.x0, endX: col.x1, offsetMm: col.innerW }))
}

function clearSpans(length: number, occupied: { a: number; b: number }[]): { start: number; end: number }[] {
  const merged: { a: number; b: number }[] = []
  for (const band of [...occupied].sort((x, y) => x.a - y.a)) {
    if (!(band.b > band.a)) continue
    const last = merged[merged.length - 1]
    if (!last || band.a > last.b) merged.push({ a: band.a, b: band.b })
    else last.b = Math.max(last.b, band.b)
  }
  const gaps: { start: number; end: number }[] = []
  let cursor = 0
  for (const m of merged) {
    if (m.a > cursor) gaps.push({ start: cursor, end: m.a })
    cursor = Math.max(cursor, m.b)
  }
  if (cursor < length) gaps.push({ start: cursor, end: length })
  return gaps
}

function remainingHeightSpans(
  layout: InteriorLayout,
  innerH: number,
): { x0: number; x1: number; startY: number; endY: number; offsetMm: number }[] {
  if (!(innerH > 0.5)) return []
  const labeled: { col: number | null; a: number; b: number }[] = []
  for (const s of layout.shelves) {
    const a = Math.min(s.startY, shelfMeasureEndY(s))
    const b = Math.max(s.startY, shelfMeasureEndY(s))
    labeled.push({ col: s.columnIndex ?? null, a, b })
  }
  for (const z of layout.zones) {
    const col = z.colIndex ?? 0
    for (const s of z.movable) {
      if (s.from === 'middle') continue
      const start = z.y0 + s.startY
      const end = z.y0 + shelfMeasureEndY(s)
      labeled.push({ col, a: Math.min(start, end), b: Math.max(start, end) })
    }
    for (const r of z.rails) {
      if (r.from !== 'middle') {
        const origin = r.from === 'top' ? r.openingY1 : r.openingY0
        labeled.push({ col, a: Math.min(origin, r.yTop), b: Math.max(origin, r.yTop) })
      }
      const rodBottom = r.yTop - CLOTHES_RAIL_SECTION_MM
      if (rodBottom > r.openingY0 + 0.5) {
        labeled.push({ col, a: r.openingY0, b: rodBottom })
      }
    }
  }
  const covers = (colIndex: number, y0: number, y1: number) =>
    labeled.some(
      (m) => (m.col == null || m.col === colIndex) && spansOverlap(y0, y1, m.a, m.b),
    )

  const out: { x0: number; x1: number; startY: number; endY: number; offsetMm: number }[] = []
  for (let c = 0; c < layout.columns.length; c++) {
    const col = layout.columns[c]
    const occupied: { a: number; b: number }[] = []
    for (const s of shelvesForColumn(layout.shelves, c)) {
      occupied.push({ a: s.yBottom, b: s.yTop })
    }
    for (const z of layout.zones) {
      if ((z.colIndex ?? 0) !== c) continue
      for (const s of z.movable) {
        occupied.push({ a: z.y0 + s.yBottom, b: z.y0 + s.yTop })
      }
    }
    const gaps = clearSpans(innerH, occupied)
    if (gaps.length <= 1) continue
    for (const g of gaps) {
      const h = g.end - g.start
      if (h <= 0.5 || covers(c, g.start, g.end)) continue
      out.push({
        x0: col.x0,
        x1: col.x1,
        startY: g.start,
        endY: g.end,
        offsetMm: h,
      })
    }
  }
  return out
}

function RemainingHeightDimLines({
  spans,
  innerFloorY,
  innerLeft,
  fontSize,
  cam,
  originZ = 0,
}: {
  spans: { x0: number; x1: number; startY: number; endY: number; offsetMm: number }[]
  innerFloorY: number
  innerLeft: number
  fontSize: number
  cam: ReturnType<typeof createDrawCam>
  originZ?: number
}) {
  const tick = Math.max(12, fontSize * 0.18)
  const sw = Math.max(5, Math.min(8, fontSize * 0.045))
  return (
    <>
      {spans.map((s, i) => {
        const x = innerLeft + (s.x0 + s.x1) / 2
        const a = cam.proj(x, innerFloorY - s.startY, originZ)
        const b = cam.proj(x, innerFloorY - s.endY, originZ)
        return (
          <g key={`open-h-${i}`} stroke={DRAW_DIM} fill={DRAW_DIM} strokeLinecap="butt">
            <line x1={a.x - tick} y1={a.y} x2={a.x + tick} y2={a.y} strokeWidth={sw} />
            <line x1={b.x - tick} y1={b.y} x2={b.x + tick} y2={b.y} strokeWidth={sw} />
            <DimLine x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={sw} />
            <DimText
              x={(a.x + b.x) / 2}
              y={(a.y + b.y) / 2}
              label={mm(s.offsetMm)}
              fontSize={fontSize}
              rotate={-90}
              fill={DRAW_DIM}
            />
            <WorldDim
              label={mm(s.offsetMm)}
              x0={x}
              y0={innerFloorY - s.startY}
              z0={originZ}
              x1={x}
              y1={innerFloorY - s.endY}
              z1={originZ}
            />
          </g>
        )
      })}
    </>
  )
}

type DimBox = { x: number; y: number; w: number; h: number }

/** Width of a dimension number. Digits are ~0.62 em; the comma is narrower. */
function dimLabelWidth(label: string, fontSize: number): number {
  let em = 0
  for (const ch of label) {
    if (ch === ',' || ch === '.') em += 0.32
    else if (ch === ' ') em += 0.28
    else if (ch === '1') em += 0.4
    else em += 0.62
  }
  return fontSize * Math.max(0.95, em)
}

function dimLabelBox(cx: number, cy: number, label: string, fontSize: number, rotated: boolean): DimBox {
  const along = dimLabelWidth(label, fontSize)
  const across = fontSize * 1.05
  if (rotated) return { x: cx - across / 2, y: cy - along / 2, w: across, h: along }
  return { x: cx - along / 2, y: cy - across / 2, w: along, h: across }
}

function dimBoxesOverlap(a: DimBox, b: DimBox, gap = 8): boolean {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y
}

/** Extra viewBox under the cabinet, only when a width number could not stay inside. */
function widthDimPad(fontSize: number, rows: number): number {
  const pitch = Math.max(48, fontSize * 1.35)
  const n = Math.max(1, rows)
  return Math.max(28, fontSize * 0.45) + (n - 1) * pitch + fontSize * 1.25
}

function widthDimInsideY(innerFloorY: number, fontSize: number, trackMm = 0): number {
  return innerFloorY - trackMm - Math.max(44, fontSize * 0.4)
}

function heightDimBoxes(
  layout: InteriorLayout,
  innerFloorY: number,
  T: number,
  fontSize: number,
  cam: ReturnType<typeof createDrawCam>,
  originZ = 0,
  shelfZ = 0,
  railZ = 0,
): DimBox[] {
  const worldX0 = T + Math.max(28, fontSize * 0.32)
  const specs = heightDimSpecs(layout, {
    originZ,
    shelfZ,
    railZ,
    shiftRightColumns: columnsWithDrawers(layout),
  })
  const xs = placeHeightDimX(specs, layout.columns, worldX0, fontSize)
  return specs.map((d) => {
    const worldX = xs.get(d.id) ?? worldX0
    const a = cam.proj(worldX, innerFloorY - d.y0, d.originZ)
    const b = cam.proj(worldX, innerFloorY - d.y1, d.endZ)
    const labelFont = d.id.startsWith('rail-') ? Math.max(18, fontSize * 0.58) : fontSize
    return dimLabelBox((a.x + b.x) / 2, (a.y + b.y) / 2, mm(d.offsetMm), labelFont, true)
  })
}

type WidthLabelPlace = {
  startX: number
  endX: number
  offsetMm: number
  flat: boolean
  yy: number
  labelX: number
  labelY: number
  font: number
  outside: boolean
  /** Runs across another divider and is drawn under the cabinet. */
  overall?: boolean
}

/** A shelf face the width number can sit on, instead of leaving the cabinet. */
type ShelfSeat = {
  x0: number
  x1: number
  /** World Y of the top face. */
  yTop: number
  z: number
}

function shelfSeats(
  layout: InteriorLayout,
  innerLeft: number,
  innerFloorY: number,
  z: number,
): ShelfSeat[] {
  const seats: ShelfSeat[] = []
  layout.columns.forEach((col, colIndex) => {
    if (!(col.innerW > 0)) return
    for (const s of shelvesForColumn(layout.shelves, colIndex)) {
      const x0 = s.spanX0 ?? col.x0
      const x1 = s.spanX1 ?? col.x1
      seats.push({
        x0: innerLeft + x0,
        x1: innerLeft + x1,
        yTop: innerFloorY - s.yTop,
        z,
      })
    }
    for (const zone of layout.zones) {
      if (zone.colIndex !== colIndex) continue
      for (const s of zone.movable) {
        seats.push({
          x0: innerLeft + zone.x0,
          x1: innerLeft + zone.x1,
          yTop: innerFloorY - s.yTop,
          z,
        })
      }
    }
  })
  return seats
}

function placePartitionDimLabels(input: {
  partitions: InteriorLayout['partitions']
  leftovers: { startX: number; endX: number; offsetMm: number }[]
  cam: ReturnType<typeof createDrawCam>
  innerLeft: number
  insideY: number
  outsideY: number
  /** World Y of the underside of the top. Numbers may rise up to here before leaving the cabinet. */
  ceilingWorldY?: number
  z?: number
  zAtX?: (x: number) => number
  leftoverZ?: number
  fontSize: number
  obstacles: DimBox[]
  shelves?: ShelfSeat[]
}): { places: WidthLabelPlace[]; outsideRows: number } {
  const depth = (x: number) => input.zAtX?.(x) ?? input.z ?? 0
  const leftoverDepth = input.leftoverZ ?? input.z ?? 0
  const raw = [
    ...input.partitions
      .filter((p) => p.from !== 'middle')
      .map((p) => {
        const overall = isOverallPartitionMeasure(p, input.partitions)
        return { startX: p.startX, endX: p.endX, offsetMm: p.offsetMm, flat: overall, overall }
      }),
    ...input.leftovers.map((p) => ({ ...p, flat: true, overall: false })),
  ].sort((a, b) => Number(a.overall) - Number(b.overall))
  const obstacles = [...input.obstacles]
  let outsideRows = 0
  const places: WidthLabelPlace[] = raw.map((p) => {
    const za = depth(p.startX)
    const zb = depth(p.endX)
    const a = input.cam.proj(input.innerLeft + p.startX, input.insideY, za)
    const b = input.cam.proj(input.innerLeft + p.endX, input.insideY, zb)
    const centerX = (a.x + b.x) / 2
    const lineY = p.flat
      ? (input.cam.proj(input.innerLeft + p.startX, input.insideY, leftoverDepth).y +
          input.cam.proj(input.innerLeft + p.endX, input.insideY, leftoverDepth).y) /
        2
      : (a.y + b.y) / 2
    const spanLo = Math.min(a.x, b.x)
    const spanHi = Math.max(a.x, b.x)
    const label = mm(p.offsetMm)
    const worldA = input.innerLeft + p.startX
    const worldB = input.innerLeft + p.endX
    const spanMid = (worldA + worldB) / 2
    const spanW = Math.max(1, Math.abs(worldB - worldA))
    const seats = (input.shelves ?? [])
      .filter((s) => {
        const overlap = Math.min(worldB, s.x1) - Math.max(worldA, s.x0)
        const shelfW = Math.max(1, s.x1 - s.x0)
        return overlap >= Math.min(spanW, shelfW) * 0.6
      })
      .sort((left, right) => {
        const dy = right.yTop - left.yTop
        if (Math.abs(dy) > 1) return dy
        const lc = (left.x0 + left.x1) / 2
        const rc = (right.x0 + right.x1) / 2
        return Math.abs(lc - spanMid) - Math.abs(rc - spanMid)
      })
    const labelWiderThan = (font: number, lo: number, hi: number) => {
      const box = dimLabelBox(0, 0, label, font, false)
      return box.w + Math.max(2, font * 0.08) > Math.abs(hi - lo)
    }
    /** Center range that keeps the whole number between the two faces. */
    const contain = (font: number, lo: number, hi: number) => {
      const box = dimLabelBox(0, 0, label, font, false)
      const pad = Math.max(2, font * 0.08)
      const innerLo = Math.min(lo, hi) + box.w / 2 + pad
      const innerHi = Math.max(lo, hi) - box.w / 2 - pad
      if (innerHi < innerLo - 0.5) return null
      return { lo: innerLo, hi: innerHi }
    }
    const keep = (x: number, labelY: number, font: number) => {
      obstacles.push(dimLabelBox(x, labelY, label, font, false))
      return { ...p, yy: input.insideY, labelX: x, labelY, font, outside: false }
    }
    const atLine = (font: number) => {
      const bounds = contain(font, spanLo, spanHi)
      if (!bounds) return null
      const labelY = lineY - font * 0.62
      const x = fitLabelX(centerX, labelY, label, font, obstacles, bounds.lo, bounds.hi)
      return x == null ? null : keep(x, labelY, font)
    }
    const raiseThisOne = (font: number) => {
      const bounds = contain(font, spanLo, spanHi)
      if (!bounds) return null
      const boxH = dimLabelBox(0, 0, label, font, false).h
      const nearLine = lineY - font * 0.62
      const step = Math.max(12, font * 0.75)
      const ceilingScreen =
        input.ceilingWorldY == null
          ? nearLine - step * 8
          : input.cam.proj(
              input.innerLeft + (p.startX + p.endX) / 2,
              input.ceilingWorldY,
              leftoverDepth,
            ).y
      const highest = ceilingScreen + boxH * 0.5 + Math.max(4, font * 0.15)
      for (let labelY = nearLine - step; labelY >= highest - 0.5; labelY -= step) {
        const x = fitLabelX(centerX, labelY, label, font, obstacles, bounds.lo, bounds.hi)
        if (x != null) return keep(x, labelY, font)
      }
      return null
    }
    const onShelf = (font: number) => {
      for (const seat of seats) {
        const sa = input.cam.proj(seat.x0, seat.yTop, seat.z)
        const sb = input.cam.proj(seat.x1, seat.yTop, seat.z)
        const mid = input.cam.proj((seat.x0 + seat.x1) / 2, seat.yTop, seat.z)
        const shelfLo = Math.max(spanLo, Math.min(sa.x, sb.x))
        const shelfHi = Math.min(spanHi, Math.max(sa.x, sb.x))
        const bounds = contain(font, shelfLo, shelfHi)
        if (!bounds) continue
        const labelY = mid.y - font * 0.45
        const x = fitLabelX(mid.x, labelY, label, font, obstacles, bounds.lo, bounds.hi)
        if (x != null) return keep(x, labelY, font)
      }
      return null
    }
    const placeOutside = () => {
      const pitch = Math.max(48, input.fontSize * 1.35)
      const scales = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42]
      for (const scale of scales) {
        const font = input.fontSize * scale
        if (labelWiderThan(font, spanLo, spanHi)) continue
        const bounds = contain(font, spanLo, spanHi)
        if (!bounds) continue
        for (let row = 0; row < 4; row += 1) {
          const yy = input.outsideY + row * pitch
          const labelY = yy + font * 0.62
          const x = fitLabelX(centerX, labelY, label, font, obstacles, bounds.lo, bounds.hi)
          if (x != null) {
            outsideRows = Math.max(outsideRows, row + 1)
            obstacles.push(dimLabelBox(x, labelY, label, font, false))
            return { ...p, yy, labelX: x, labelY, font, outside: true }
          }
        }
      }
      outsideRows = Math.max(outsideRows, 1)
      const font = input.fontSize * 0.42
      const yy = input.outsideY
      const labelY = yy + font * 0.62
      return { ...p, yy, labelX: centerX, labelY, font, outside: true }
    }
    if (p.overall) return placeOutside()
    const fitted = atLine(input.fontSize)
    if (fitted) return fitted
    const minFont = Math.max(16, Math.round(input.fontSize * 0.45))
    let font = input.fontSize
    if (labelWiderThan(font, spanLo, spanHi)) {
      for (font = input.fontSize - 10; font >= minFont - 0.5; font -= 10) {
        const smaller = atLine(font) ?? onShelf(font)
        if (smaller) return smaller
        if (!labelWiderThan(font, spanLo, spanHi)) break
      }
    }
    const raised = raiseThisOne(Math.max(minFont, font)) ?? onShelf(Math.max(minFont, font))
    if (raised) return raised
    for (let next = Math.max(minFont, font) - 10; next >= minFont - 0.5; next -= 10) {
      const smaller = atLine(next) ?? onShelf(next) ?? raiseThisOne(next)
      if (smaller) return smaller
    }
    return placeOutside()
  })
  return { places, outsideRows }
}

function fitLabelX(
  centerX: number,
  labelY: number,
  label: string,
  font: number,
  obstacles: DimBox[],
  lo: number,
  hi: number,
): number | null {
  const step = Math.max(8, font * 0.22)
  const reach = Math.max(Math.abs(hi - centerX), Math.abs(centerX - lo), step)
  const xs = [centerX]
  for (let d = step; d <= reach + 0.1; d += step) xs.push(centerX + d, centerX - d)
  for (const x of xs) {
    if (x < Math.min(lo, hi) || x > Math.max(lo, hi)) continue
    const box = dimLabelBox(x, labelY, label, font, false)
    if (!obstacles.some((o) => dimBoxesOverlap(box, o))) return x
  }
  return null
}

function PartitionDimLines({
  partitions,
  leftovers = [],
  cam,
  innerLeft,
  insideY,
  outsideY,
  ceilingWorldY,
  anchorY,
  belowAnchorY,
  z = 0,
  zAtX,
  leftoverZ,
  fontSize,
  obstacles = [],
  shelves = [],
}: {
  partitions: InteriorLayout['partitions']
  leftovers?: { startX: number; endX: number; offsetMm: number }[]
  cam: ReturnType<typeof createDrawCam>
  innerLeft: number
  /** Dimension line inside the cabinet, just above the inner floor. */
  insideY: number
  /** Used only when the number still does not fit inside the bay, even higher up and in a smaller font. */
  outsideY: number
  /** World Y of the underside of the top. */
  ceilingWorldY?: number
  /** Inner floor — extension lines drop to the measured faces here. */
  anchorY: number
  /** Bottom of the cabinet. Overall widths draw their line under this. */
  belowAnchorY?: number
  z?: number
  /** Depth of each measured face (set-back partition vs full-depth side). */
  zAtX?: (x: number) => number
  /** Leftover opening dims stay on one plane so the line is straight. */
  leftoverZ?: number
  fontSize: number
  obstacles?: DimBox[]
  shelves?: ShelfSeat[]
}) {
  const tick = Math.max(14, fontSize * 0.18)
  const sw = Math.max(5, Math.min(8, fontSize * 0.045))
  const depth = (x: number) => zAtX?.(x) ?? z
  const leftoverDepth = leftoverZ ?? z
  const { places } = placePartitionDimLabels({
    partitions,
    leftovers,
    cam,
    innerLeft,
    insideY,
    outsideY,
    ceilingWorldY,
    z,
    zAtX,
    leftoverZ,
    fontSize,
    obstacles,
    shelves,
  })
  return (
    <>
      {places.map((p, i) => {
        const za = depth(p.startX)
        const zb = depth(p.endX)
        const a = p.flat
          ? {
              x: cam.proj(innerLeft + p.startX, p.yy, za).x,
              y: cam.proj(innerLeft + p.startX, p.yy, leftoverDepth).y,
            }
          : cam.proj(innerLeft + p.startX, p.yy, za)
        const b = p.flat
          ? {
              x: cam.proj(innerLeft + p.endX, p.yy, zb).x,
              y: cam.proj(innerLeft + p.endX, p.yy, leftoverDepth).y,
            }
          : cam.proj(innerLeft + p.endX, p.yy, zb)
        const footY = p.overall && belowAnchorY != null ? belowAnchorY : anchorY
        const footA = cam.proj(innerLeft + p.startX, footY, za)
        const footB = cam.proj(innerLeft + p.endX, footY, zb)
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy) || 1
        const nx = (-dy / len) * tick
        const ny = (dx / len) * tick
        return (
          <g key={`part-dim-${i}`} stroke={DRAW_DIM} fill={DRAW_DIM} strokeLinecap="butt">
            <line x1={a.x} y1={a.y} x2={footA.x} y2={footA.y} strokeWidth={sw} />
            <line x1={b.x} y1={b.y} x2={footB.x} y2={footB.y} strokeWidth={sw} />
            <line x1={a.x - nx} y1={a.y - ny} x2={a.x + nx} y2={a.y + ny} strokeWidth={sw} />
            <line x1={b.x - nx} y1={b.y - ny} x2={b.x + nx} y2={b.y + ny} strokeWidth={sw} />
            <DimLine x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={sw} />
            <DimText x={p.labelX} y={p.labelY} label={mm(p.offsetMm)} fontSize={p.font} fill={DRAW_DIM} />
            <WorldDim
              label={mm(p.offsetMm)}
              x0={innerLeft + p.startX}
              y0={p.yy}
              z0={p.flat ? leftoverDepth : za}
              x1={innerLeft + p.endX}
              y1={p.yy}
              z1={p.flat ? leftoverDepth : zb}
            />
          </g>
        )
      })}
    </>
  )
}

function PanelHoleMark({
  x,
  y,
  z,
  w,
  d,
  hole,
  cam,
}: {
  x: number
  y: number
  z: number
  w: number
  d: number
  hole: PanelHole
  cam: ReturnType<typeof createDrawCam>
}) {
  const cx = x + w / 2
  const cz = z + d / 2
  if (hole.kind === 'round') {
    const r = hole.diameter / 2
    const pts = Array.from({ length: 28 }, (_, i) => {
      const a = (i / 28) * Math.PI * 2
      return cam.proj(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r)
    })
    return (
      <polygon
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={DRAW_STROKE}
        strokeWidth={1.6}
      />
    )
  }
  const hw = hole.width / 2
  const hd = hole.height / 2
  const corners = [
    cam.proj(cx - hw, y, cz - hd),
    cam.proj(cx + hw, y, cz - hd),
    cam.proj(cx + hw, y, cz + hd),
    cam.proj(cx - hw, y, cz + hd),
  ]
  return (
    <polygon
      points={corners.map((p) => `${p.x},${p.y}`).join(' ')}
      fill="none"
      stroke={DRAW_STROKE}
      strokeWidth={1.6}
    />
  )
}

function ShelfPins({
  x,
  yTop,
  z,
  w,
  shelfT,
  d,
  cam,
  mark,
}: {
  x: number
  yTop: number
  z: number
  w: number
  shelfT: number
  d: number
  cam: ReturnType<typeof createDrawCam>
  mark: number
}) {
  const pinH = mark * 0.85
  const pinL = mark * 1.8
  const pinD = mark * 0.85
  const hangL = Math.min(mark * 0.55, w * 0.05)
  const hangR = Math.min(Math.max(mark * 5.2, pinL * 2.2), w * 0.18)
  const leftX = x + hangL
  const rightX = Math.max(leftX + pinL + pinL * 1.4, x + w - pinL - hangR)
  const y = yTop + shelfT
  const zFront = z + Math.min(6, d * 0.02)
  return (
    <>
      <Board
        x={leftX}
        y={y}
        z={zFront}
        w={pinL}
        h={pinH}
        d={pinD}
        color={SHELF_PIN_COLOR}
        cam={cam}
        faces={{ front: true, top: true, right: true }}
        strokeWidth={1.6}
      />
      <Board
        x={rightX}
        y={y}
        z={zFront}
        w={pinL}
        h={pinH}
        d={pinD}
        color={SHELF_PIN_COLOR}
        cam={cam}
        faces={{ front: true, top: true, left: true }}
        strokeWidth={1.6}
      />
    </>
  )
}

/**
 * A shelf, including one across 1.1 and 1.2, is drawn in the opening that holds its right edge,
 * so the page on that edge is painted afterwards and its front edge stays in front.
 * A page the shelf cuts is an earlier step: it stays under the shelf and is painted before it.
 */
function BayShelvesAndPartials({
  layout,
  colIndex,
  T,
  innerFloorY,
  cam,
  shelfColor,
  sideColor,
  fixedZ,
  fixedD,
  shelfHole,
  adjZ,
  adjD,
  pinMark = 10,
  clothesTrackMm = 0,
  railSideZ = 0,
  railPartitionZ,
  railDepth = 0,
  between,
}: {
  layout: InteriorLayout
  colIndex: number
  T: number
  innerFloorY: number
  cam: ReturnType<typeof createDrawCam>
  shelfColor: string
  sideColor: string
  fixedZ: number
  fixedD: number
  shelfHole?: PanelHole
  adjZ?: number
  adjD?: number
  pinMark?: number
  clothesTrackMm?: number
  railSideZ?: number
  railPartitionZ?: number
  /** Depth of the panel the rail is screwed to. The bar sits in the middle of it. */
  railDepth?: number
  between?: (x0: number, x1: number, includeFull: boolean, zoneId?: string) => ReactNode
}) {
  const marks = useCabinetMarks()
  const col = layout.columns[colIndex]
  if (!col || !(col.innerW > 0)) return null
  const shelfZ = adjZ ?? fixedZ
  const shelfD = adjD ?? fixedD
  const cabinetTop = layout.zones.reduce((max, zone) => Math.max(max, zone.y1), 0)
  const partials = layout.partialPartitions
    .filter((part) => part.columnIndex === colIndex && !part.aboveShelf)
    .slice()
    .sort((a, b) => a.xLeft - b.xLeft || a.height - b.height)
  const abovePartials = layout.partialPartitions
    .filter((part) => part.columnIndex === colIndex && part.aboveShelf)
    .slice()
    .sort((a, b) => a.xLeft - b.xLeft)
  // A shelf across two columns is drawn in the column that holds its right edge:
  // after the page it cuts, and before the page on its right.
  const fixedShelves = layout.shelves.filter((shelf) => {
    if (shelf.spanX1 == null) {
      if (shelf.columnIndex == null) return true
      return shelf.columnIndex === colIndex
    }
    return shelf.spanX1 > col.x0 + 0.5 && shelf.spanX1 <= col.x1 + 0.5
  })
  const columnZones = layout.zones.filter((zone) => zone.colIndex === colIndex)
  const steps: Array<{ kind: 'slice'; x0: number; x1: number } | { kind: 'partial'; part: (typeof partials)[number] }> = []
  let cursor = col.x0
  for (const part of partials) {
    if (part.xLeft > cursor + 0.5) steps.push({ kind: 'slice', x0: cursor, x1: part.xLeft })
    steps.push({ kind: 'partial', part })
    cursor = Math.max(cursor, part.xRight)
  }
  if (cursor < col.x1 - 0.5 || steps.length === 0) steps.push({ kind: 'slice', x0: cursor, x1: col.x1 })

  /** The piece's right face is this opening, so the page after the opening stays in front of it. */
  const endsHere = (sliceX0: number, sliceX1: number, x1: number) => {
    if (x1 > col.x1 + 0.5) return sliceX1 >= col.x1 - 0.5
    return x1 > sliceX0 + 0.5 && x1 <= sliceX1 + 0.5
  }
  const shelfBox = (shelf: (typeof fixedShelves)[number]) => ({
    x0: shelf.spanX0 ?? col.x0,
    x1: shelf.spanX1 ?? col.x1,
  })

  const drawFixed = (shelves: typeof fixedShelves, key: string) =>
    shelves.map((shelf) => {
      const box = shelfBox(shelf)
      return (
        <g key={`${key}-${shelf.specIndex}`}>
          <Board
            x={T + box.x0}
            y={innerFloorY - shelf.yTop}
            z={fixedZ}
            w={box.x1 - box.x0}
            h={T}
            d={fixedD}
            color={shelfColor} pick={`shelf-${shelf.specIndex}`}
            cam={cam}
            faces={BETWEEN_FACES}
          />
          {shelfHole && (
            <PanelHoleMark
              x={T + box.x0}
              y={innerFloorY - shelf.yTop}
              z={fixedZ}
              w={box.x1 - box.x0}
              d={fixedD}
              hole={shelfHole}
              cam={cam}
            />
          )}
        </g>
      )
    })

  const drawZone = (zone: (typeof columnZones)[number], key: string) => {
    const zLeft = col.isFirst && zone.x0 <= col.x0 + 0.5 ? railSideZ : (railPartitionZ ?? railSideZ)
    const zRight = col.isLast && zone.x1 >= col.x1 - 0.5 ? railSideZ : (railPartitionZ ?? railSideZ)
    const railCenter = Math.max(0, (railDepth - 22) / 2)
    return (
      <g key={key}>
        {zone.movable.map((shelf, index) => (
          <g key={`shelf-${zone.id}-${index}`}>
            <Board
              x={T + zone.x0}
              y={innerFloorY - (zone.y0 + shelf.yBottom) - T}
              z={shelfZ}
              w={zone.innerW}
              h={T}
              d={shelfD}
              color={shelfColor} pick={`shelf-${zone.id}-${index}`}
              cam={cam}
              faces={BETWEEN_FACES}
            />
            {marks && (
            <ShelfPins
              x={T + zone.x0}
              yTop={innerFloorY - (zone.y0 + shelf.yBottom) - T}
              z={shelfZ}
              w={zone.innerW}
              shelfT={T}
              d={shelfD}
              cam={cam}
              mark={pinMark}
            />
            )}
            {shelfHole && (
              <PanelHoleMark
                x={T + zone.x0}
                y={innerFloorY - (zone.y0 + shelf.yBottom) - T}
                z={shelfZ}
                w={zone.innerW}
                d={shelfD}
                hole={shelfHole}
                cam={cam}
              />
            )}
          </g>
        ))}
        {zone.rails.map((rail, index) => {
          const underTrack = clothesTrackMm > 0 && rail.from === 'top' && rail.openingY1 >= cabinetTop - 0.5
          const yTop = underTrack ? rail.yTop - clothesTrackMm : rail.yTop
          return (
            <ClothesRailBar
              key={`rail-${zone.id}-${index}`}
              x={T + zone.x0}
              y={innerFloorY - yTop}
              w={zone.innerW}
              h={22}
              d={22}
              z0={zLeft + railCenter}
              z1={zRight + railCenter}
              color={CLOTHES_RAIL_COLOR}
              cam={cam}
            />
          )
        })}
      </g>
    )
  }

  return (
    <>
      {steps.map((step, index) => {
        if (step.kind === 'partial') {
          const part = step.part
          const foot = part.y0 ?? 0
          return (
            <Board
              key={`partial-${part.specIndex}-c${colIndex}`}
              x={T + part.xLeft}
              y={innerFloorY - (foot + part.height)}
              z={fixedZ}
              w={T}
              h={part.height}
              d={fixedD}
              color={sideColor} pick={`divider-${part.specIndex}`}
              cam={cam}
              faces={SIDE_LEFT_BODY}
            />
          )
        }
        const localShelves = fixedShelves.filter((shelf) => endsHere(step.x0, step.x1, shelfBox(shelf).x1))
        const localZones = columnZones.filter((zone) => endsHere(step.x0, step.x1, zone.x1))
        return (
          <React.Fragment key={`slice-${colIndex}-${index}`}>
            {drawFixed(localShelves, `fixed-${index}`)}
            {localZones.map((zone) => drawZone(zone, `zone-${zone.id}`))}
            {between?.(step.x0, step.x1, col.isFirst && step.x0 <= col.x0 + 0.5)}
            {localZones
              .filter((zone) => zone.x0 < step.x0 - 0.5)
              .map((zone) => (
                <React.Fragment key={`span-front-${zone.id}`}>{between?.(zone.x0, zone.x1, false, zone.id)}</React.Fragment>
              ))}
          </React.Fragment>
        )
      })}
      {abovePartials.map((part) => {
        const foot = part.y0 ?? 0
        return (
          <Board
            key={`partial-above-${part.specIndex}-c${colIndex}`}
            x={T + part.xLeft}
            y={innerFloorY - (foot + part.height)}
            z={fixedZ}
            w={T}
            h={part.height}
            d={fixedD}
            color={sideColor} pick={`divider-${part.specIndex}`}
            cam={cam}
            faces={SIDE_LEFT_BODY}
          />
        )
      })}
    </>
  )
}

function CaptureOnly({ solid }: { solid: SceneSolid }) {
  useCaptureSolid(solid)
  return null
}

/** Front plus the four rails. The rails are only in the 3D picture; the runners stay on the cabinet. */
function DrawerFront({
  slideId,
  x,
  y,
  z,
  w,
  h,
  d,
  color,
  cam,
  faces,
  opacity,
  openingX,
  openingW,
  thickness,
  pick,
}: {
  slideId: string
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  color: string
  cam: DrawCam
  faces: DrawFaces
  opacity?: number
  openingX: number
  openingW: number
  thickness: number
  pick?: string
}) {
  const hardware = React.useContext(DrawerHardwareContext)
  const pulls = React.useContext(PullChoiceContext)
  const sku = pulls?.skuFor(slideId) ?? 'none'
  const box = hardware
    ? drawerBoxRails(hardware.cabinetWidth, thickness, h, hardware.slideLength, hardware.soft, openingW)
    : null
  const reach = box ? Math.min(hardware?.slideLength ?? box.outer.width, box.outer.width) : hardware?.slideLength ?? 250
  // Stops with the box still on the runner. Closed (0) is the drawn front, not a generic plane.
  const slide = { id: slideId, travel: Math.max(60, Math.round(reach * 0.86)) }
  const parts: Extract<SceneSolid, { kind: 'box' }>[] = []
  if (box && hardware) {
    const topReveal = Math.min(16, Math.max(0, h - box.outer.height))
    const railTop = y + topReveal
    const left = openingX + box.sideGapEach
    const depth = box.outer.width
    const sideH = box.outer.height
    const innerTop = railTop + (sideH - box.inner.height)
    const z0 = z + d
    const sideColor = hardware.sideColor
    parts.push(
      { kind: 'box', x: left, y: railTop, z: z0, w: thickness, h: sideH, d: depth, color: sideColor, slide },
      { kind: 'box', x: left + box.drawerOuterW - thickness, y: railTop, z: z0, w: thickness, h: sideH, d: depth, color: sideColor, slide },
      { kind: 'box', x: left + thickness, y: innerTop, z: z0, w: box.inner.width, h: box.inner.height, d: thickness, color: sideColor, slide },
      { kind: 'box', x: left + thickness, y: innerTop, z: z0 + depth - thickness, w: box.inner.width, h: box.inner.height, d: thickness, color: sideColor, slide },
    )
  }
  return (
    <>
      <Board
        x={x}
        y={y}
        z={z}
        w={w}
        h={h}
        d={d}
        color={color}
        cam={cam}
        faces={faces}
        opacity={opacity}
        slide={slide}
        pull={sku === 'none' ? undefined : { key: slideId, sku }}
        pick={pick}
      />
      {parts.map((part, index) => (
        <CaptureOnly key={`${slideId}-rail-${index}`} solid={part} />
      ))}
    </>
  )
}

function insetFrontGeom(T: number, x0: number, innerW: number): { x: number; w: number } {
  return {
    x: T + x0 + INNER_DRAWER_SIDE_GAP_EACH,
    w: Math.max(0, innerW - INNER_DRAWER_GAP_X),
  }
}

/**
 * Front face of an inner drawer.
 * It begins on the front edge of the pages that frame it (internal pages in a
 * sliding wardrobe, the carcass sides otherwise). A shelf that bounds the
 * opening and sits further back pulls the face back onto that edge, so the
 * edge banding stays visible and the front starts there.
 */
function innerDrawerFaceZ(pageFrontZ: number, shelfFrontZ: number, boundedByShelf: boolean): number {
  if (boundedByShelf && shelfFrontZ > pageFrontZ + 0.5) return shelfFrontZ
  return pageFrontZ
}

/**
 * Equal leaves in one opening.
 * The outer left hinges on the left side, the outer right on the right side.
 * Inner leaves hinge on the edge toward the middle, so they meet in pairs.
 */
function doorLeafLayout(
  x: number,
  w: number,
  count: number,
  betweenGap: number,
): { x: number; w: number; side: 'left' | 'right' }[] {
  const n = count === 2 || count === 3 || count === 4 ? count : 1
  const gaps = n - 1
  const dw = gaps > 0 ? (w - betweenGap * gaps) / n : w
  return Array.from({ length: n }, (_, i) => {
    const side: 'left' | 'right' =
      n === 1 || i === 0 ? 'left' : i === n - 1 ? 'right' : i < n / 2 ? 'right' : 'left'
    return { x: x + i * (dw + betweenGap), w: dw, side }
  })
}

function FrontsOnCabinet({
  layout,
  W,
  T,
  innerFloorY,
  carcassTopY,
  carcassBotY,
  z,
  d,
  cam,
  clearanceBottom = 0,
  insetFronts = false,
  innerDrawerFronts = false,
  insetFrontZ,
  pageFrontZ,
  shelfFrontZ,
  innerDoors = false,
  layer,
  fontScale = 1,
  innerTopY,
  innerBotY,
  opening,
  openDoors = false,
  frontColor,
  visualDoor = false,
  hangFromTop,
}: {
  layout: InteriorLayout
  W: number
  T: number
  innerFloorY: number
  carcassTopY: number
  carcassBotY: number
  z: number
  d: number
  cam: ReturnType<typeof createDrawCam>
  clearanceBottom?: number
  insetFronts?: boolean
  innerDrawerFronts?: boolean
  /** Closed face of an overlay drawer when it is not the outer side (sliding wardrobe). */
  insetFrontZ?: number
  /** Front edge of the pages that frame an inner drawer. */
  pageFrontZ?: number
  /** Front edge of a shelf. An inner drawer bounded by one begins here when the shelf is further back. */
  shelfFrontZ?: number
  innerDoors?: boolean
  /** Draw only inset fronts (between the sides) or only overlay fronts (covering the sides). */
  layer?: 'inset' | 'overlay'
  fontScale?: number
  innerTopY?: number
  innerBotY?: number
  /** Only fronts in this opening, drawn before the page on its right. */
  opening?: { x0: number; x1: number; includeFull?: boolean; zoneId?: string }
  /** Stand the doors beside the cabinet so the inside stays visible. */
  openDoors?: boolean
  frontColor?: string
  /** One door on the drawing when the cabinet has none, so the colour and the open view show. */
  visualDoor?: boolean
  /** Knee opening, in inner-left coordinates. Drawers there hang from the top. */
  hangFromTop?: { x0: number; x1: number } | null
}) {
  const marks = useCabinetMarks()
  const hideDoors = React.useContext(HideDoorsContext)
  const model = React.useContext(PreviewIsModel)
  const doorMirror = React.useContext(DoorMirrorContext)
  const gap = DOOR_GAP_X
  const fill = frontColor || FRONT_FILL
  const items: ReactNode[] = []
  const overlayFaces = { front: true, top: true, right: true } as const
  const insetFaces = { front: true, top: true, right: true } as const
  const cavityTopY = innerTopY ?? carcassTopY
  const cavityBotY = innerBotY ?? carcassBotY

  const include = (inset: boolean) => {
    if (!layer) return true
    return layer === 'inset' ? inset : !inset
  }

  const pushHeightLabel = (id: string, x: number, y: number, w: number, h: number) => {
    if (!marks || !(h > 24 && w > 40)) return
    const pt = cam.proj(x + w / 2, y + h / 2, z)
    const fontSize = scaledDimFont(Math.max(22, Math.min(h * 0.28, w * 0.14, 52)), fontScale)
    items.push(<DimText key={id} x={pt.x} y={pt.y} label={mm(h)} fontSize={fontSize} rotate={-90} />)
  }

  const pushDoors = (
    x: number,
    y: number,
    w: number,
    h: number,
    count: number,
    key: string,
    label: boolean,
    faces: typeof overlayFaces,
    betweenGap: number,
  ) => {
    if (!(h > 4)) return
    const leaves = doorLeafLayout(x, w, count, betweenGap)
    const glassOn = (id: string, leafW: number) =>
      doorMirror && mirrorCoversDoor(doorMirror, id) ? mirrorGlass(leafW, h, doorMirror) : null
    if (openDoors || model) {
      leaves.forEach((leaf, i) => {
        const id = leaves.length === 1 ? key : `${key}-${i}`
        const glass = glassOn(id, leaf.w)
        items.push(
          <HingedDoor
            key={id}
            hingeX={leaf.side === 'left' ? leaf.x : leaf.x + leaf.w}
            y={y}
            z={z}
            width={leaf.w}
            height={h}
            thickness={d}
            side={leaf.side}
            color={fill}
            cam={cam}
            inset={innerDoors}
            pick={id}
            mirror={glass ? { x: glass.x, y: glass.y, width: glass.width, height: glass.height } : undefined}
            noPull={Boolean(glass && doorMirror?.noPull)}
          />,
        )
      })
      return
    }
    leaves.forEach((leaf, i) => {
      const id = leaves.length === 1 ? key : `${key}-${i}`
      items.push(
        <Board
          key={id}
          x={leaf.x}
          y={y}
          z={z}
          w={leaf.w}
          h={h}
          d={d}
          color={fill}
          cam={cam}
          faces={faces}
          opacity={0.92}
          pick={id}
        />,
      )
      const glass = glassOn(id, leaf.w)
      if (glass) {
        items.push(
          <Board
            key={`${id}-glass`}
            x={leaf.x + glass.x}
            y={y + glass.y}
            z={Math.max(0, z - 6)}
            w={glass.width}
            h={glass.height}
            d={4}
            color={MIRROR_GLASS_COLOR}
            cam={cam}
            faces={{ front: true }}
            mirrorGlass
          />,
        )
      }
      if (label) pushHeightLabel(`${id}-h`, leaf.x, y, leaf.w, h)
    })
  }

  const pushStacked = (
    overlay: { x: number; y: number; w: number; h: number },
    innerY: { y: number; h: number },
    doorCount: DoorCount,
    drawerFrontHeights: number[],
    key: string,
    bottomGap: number,
    inset: { x: number; w: number },
    openingBox: { x: number; w: number },
    boundedByShelf: boolean,
    fromTop = false,
  ) => {
    const hasDrawers = drawerFrontHeights.some((h) => h > 0)
    const hasDoors = doorCount > 0
    const allInner = (hasDrawers ? innerDrawerFronts : true) && (hasDoors ? innerDoors : true)
    const stackBox = allInner ? { ...overlay, y: innerY.y, h: innerY.h } : overlay
    const stacked = stackFronts({
      frontHeight: stackBox.h,
      doorCount,
      drawerFrontHeights,
      clearanceBottom: bottomGap,
      fromTop,
    })
    const label = stacked.length >= 2
    for (const s of stacked) {
      const y = stackBox.y + s.yFromFrontTop
      if (s.kind === 'drawer') {
        if (!include(innerDrawerFronts)) continue
        const box = innerDrawerFronts ? inset : overlay
        const faces = innerDrawerFronts ? insetFaces : overlayFaces
        const drawerZ = innerDrawerFronts
          ? innerDrawerFaceZ(pageFrontZ ?? insetFrontZ ?? z, shelfFrontZ ?? pageFrontZ ?? z, boundedByShelf)
          : insetFrontZ != null
            ? insetFrontZ
            : z
        items.push(
          <DrawerFront
            key={`df-${key}-${s.index}`}
            slideId={`drawer:${key}:${s.index}`}
            x={box.x}
            y={y}
            z={drawerZ}
            w={box.w}
            h={s.height}
            d={d}
            color={fill}
            cam={cam}
            faces={faces}
            opacity={0.92}
            openingX={openingBox.x}
            openingW={openingBox.w}
            thickness={T}
            pick={`drawer-front-${key}-${s.index}`}
          />,
        )
        if (label) pushHeightLabel(`df-${key}-${s.index}-h`, box.x, y, box.w, s.height)
      } else if (!hideDoors && s.doorCount != null && s.doorCount > 0) {
        if (!include(innerDoors)) continue
        const box = innerDoors ? inset : overlay
        const faces = innerDoors ? insetFaces : overlayFaces
        const between = innerDoors ? DRAWER_DOOR_GAP : gap
        pushDoors(box.x, y, box.w, s.height, s.doorCount, `door-${key}`, label, faces, between)
      }
    }
  }

  if ((!opening || (opening.includeFull && !opening.zoneId)) && (layout.fullDoorCount > 0 || layout.fullDrawerFrontHeights.length > 0)) {
    const overlayX = insetFronts ? T : 0
    const overlayW = insetFronts ? Math.max(0, W - 2 * T) : W
    const innerOpenW = Math.max(0, W - 2 * T)
    pushStacked(
      { x: overlayX, y: carcassTopY, w: overlayW, h: carcassBotY - carcassTopY },
      { y: cavityTopY, h: Math.max(1, cavityBotY - cavityTopY) },
      layout.fullDoorCount,
      layout.fullDrawerFrontHeights,
      'full',
      clearanceBottom,
      insetFrontGeom(T, 0, innerOpenW),
      { x: T, w: innerOpenW },
      false,
    )
  }

  for (const zone of layout.zones) {
    if (zone.doorCount === 0 && zone.drawerFrontHeights.length === 0) continue
    if (opening?.zoneId) {
      if (zone.id !== opening.zoneId) continue
    } else if (opening && (zone.x0 < opening.x0 - 0.5 || zone.x1 > opening.x1 + 0.5)) continue
    const box = zoneFrontBox(zone, { innerFloorY, carcassTopY, carcassBotY, thickness: T })
    const insetBox = zoneInsetFrontBox(zone, {
      innerFloorY,
      innerTopY: cavityTopY,
      innerBotY: cavityBotY,
    })
    const x =
      insetFronts || zone.frontWidth <= 0
        ? T + zone.x0
        : T + zone.frontX0
    const w =
      insetFronts || zone.frontWidth <= 0
        ? zone.innerW > 0
          ? zone.innerW
          : W
        : zone.frontWidth
    const zoneInnerW = zone.innerW > 0 ? zone.innerW : Math.max(0, W - 2 * T)
    pushStacked(
      { x, y: box.y, w, h: box.h },
      { y: insetBox.y, h: insetBox.h },
      zone.doorCount,
      zone.drawerFrontHeights,
      zone.id,
      zone.y0 <= 0.5 ? clearanceBottom : 0,
      insetFrontGeom(T, zone.x0, zoneInnerW),
      { x: T + zone.x0, w: zoneInnerW },
      !(zone.isFirst && zone.isLast),
      zoneInVanityKnee(zone, hangFromTop),
    )
  }

  if (!hideDoors && visualDoor && !opening && items.length === 0) {
    const overlayX = insetFronts ? T : 0
    const overlayW = insetFronts ? Math.max(0, W - 2 * T) : W
    pushDoors(overlayX, carcassTopY, overlayW, carcassBotY - carcassTopY, 1, 'look', false, overlayFaces, gap)
  }

  return <>{items}</>
}

function FrontDrawing({ title, children }: { title: string; children: ReactNode }) {
  const model = React.useContext(PreviewIsModel)
  const solidsOnly = React.useContext(CaptureSolidsOnly)
  const grouped = React.useContext(GroupedPreviewContext)
  const part = React.useContext(PreviewPartContext)
  if (part === 'extras') return null
  if (grouped || solidsOnly) return <>{children}</>
  if (model) {
    return (
      <ViewCard title="3D">
        <CapturedModel>{children}</CapturedModel>
      </ViewCard>
    )
  }
  return (
    <ViewCard title={title}>
      <ZoomableView>{children}</ZoomableView>
    </ViewCard>
  )
}

function ExtraDrawings({ children }: { children: ReactNode }) {
  const model = React.useContext(PreviewIsModel)
  const part = React.useContext(PreviewPartContext)
  if (model || part === 'main') return null
  return children
}

function ViewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-md border border-neutral-300 bg-white p-2">
      <p className="mb-1 text-center text-[11px] font-medium text-neutral-700">{title}</p>
      <div className="flex flex-1 items-center justify-center overflow-hidden bg-white">{children}</div>
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
  layout,
  showDimLines,
  showOpeningDims,
  showFronts,
  openDoors = false,
  frontColor,
  backFill = DEFAULT_HARDBOARD_COLOR,
  hideFeet = false,
}: {
  p: KitchenBaseParams
  m: ReturnType<typeof measureCarcass>
  layout: InteriorLayout
  showDimLines: boolean
  showOpeningDims: boolean
  showFronts: boolean
  openDoors?: boolean
  frontColor?: string
  backFill?: string
  hideFeet?: boolean
}) {
  const marks = useCabinetMarks()
  const suppressOuter = useSuppressOuter()
  const coveredTop = useCoveredTop()
  const legLeftPaint = usePiecePaint('leg-left', p.colors.leg)
  const legRightPaint = usePiecePaint('leg-right', p.colors.leg)
  const T = m.thickness
  const W = m.outerW
  const H = m.outerH
  const D = m.outerD
  const L = p.legHeight
  const R = p.railWidth

  const cam = createDrawCam({ ox: 0, oy: 0 })
  const { x: dx, y: dy } = cam.depthDelta(D)

  const fontScale = p.dimFontScale
  const font = scaledDimFont(Math.max(72, Math.min(W, H) * 0.13), fontScale)
  const railFont = scaledDimFont(Math.max(48, Math.min(R * 0.5, m.railLength * 0.1)), fontScale)
  const legFont = scaledDimFont(Math.max(40, Math.max(72, Math.min(W, H) * 0.13) * 0.55), fontScale)
  const doorPad = viewPad(openDoors, layout, W, false)
  const padL = (marks ? font + 48 : 28) + doorPad.left
  const padT = (marks ? font : 20) + Math.abs(dy) + (marks ? 28 : 12)
  const padR = (marks ? 48 : 24) + doorPad.right
  const leftovers = leftoverPartitionSpans(layout.partitions, layout.columns)
  const openingWidths =
    p.topStyle === 'rails' ? [] : openingWidthSpans(layout.partitions, layout.columns)
  const innerClearH = kitchenClearInnerH(p.height, p.thickness, p.topStyle)
  const openingHeights = remainingHeightSpans(layout, innerClearH)

  const totalH = H + L
  const vbW = padL + W + dx + padR
  const ox = padL
  const floor = padT + totalH
  const topY = floor - L - H
  const botY = floor - L

  const view = createDrawCam({ ox, oy: 0 })

  const legW = Math.max(18, T * 1.2)
  const legInset = Math.max(28, W * 0.08)

  const gap = font * 0.55
  const heightX = ox - gap
  const heightY = (topY + botY) / 2
  const depth = depthMark(ox, coveredTop ? botY : topY, dx, dy, gap, W, coveredTop)
  const depthMx = depth.x
  const depthMy = depth.y
  const depthRot = depth.rot
  const backMx = coveredTop ? ox + W / 2 : ox + W / 2 + dx
  const backMy = coveredTop ? floor - L * 0.55 : topY + dy - font * 0.45
  const legLabelX = ox + legInset + legW / 2
  const legLabelY = floor - L / 2
  const sideLabelX = ox + W + dx / 2
  const sideLabelY = (topY + floor - L - T) / 2 + dy / 2

  const zRailFront = D - R
  const zBack = D
  const zShelfFront = shelfFrontInsetMm(p)
  const shelfDepth = shelfPanelDepth(D, T, zShelfFront)
  const innerFloorY = floor - L - T
  const widthInsideY = widthDimInsideY(innerFloorY, railFont)
  const widthOutsideY = floor + Math.max(28, railFont * 0.45)
  const widthAvoid = [
    ...heightDimBoxes(layout, innerFloorY, T, railFont, view, 0, zShelfFront, 0),
    ...(showOpeningDims
      ? openingHeights.map((s) => {
          const x = T + (s.x0 + s.x1) / 2
          const a = view.proj(x, innerFloorY - s.startY, 0)
          const b = view.proj(x, innerFloorY - s.endY, 0)
          return dimLabelBox((a.x + b.x) / 2, (a.y + b.y) / 2, mm(s.offsetMm), railFont, true)
        })
      : []),
  ]
  const widthLabels = placePartitionDimLabels({
    partitions: layout.partitions,
    leftovers: showOpeningDims ? [...leftovers, ...openingWidths] : leftovers,
    cam: view,
    innerLeft: T,
    insideY: widthInsideY,
    outsideY: widthOutsideY,
    ceilingWorldY: topY + T,
    fontSize: railFont,
    obstacles: widthAvoid,
    shelves: shelfSeats(layout, T, innerFloorY, zShelfFront),
  })
  const padB = (marks ? 36 : 16) + doorPad.bottom + (coveredTop ? font * 0.95 : 0) + (marks && widthLabels.outsideRows > 0 ? widthDimPad(railFont, widthLabels.outsideRows) : 0)
  const vbH = padT + totalH + padB
  const cavityTopY = innerFloorY - innerClearH
  const adjShelfOffs = layout.zones.flatMap((z) => z.movable.map((s) => z.y0 + s.yBottom))
  const topShelfOff =
    layout.shelves.length > 0
      ? layout.shelves[layout.shelves.length - 1].yBottom
      : adjShelfOffs.length > 0
        ? adjShelfOffs[adjShelfOffs.length - 1]
        : 0
  const shelfLabelPt =
    layout.shelves.length > 0
      ? view.proj(W / 2, innerFloorY - layout.shelves[layout.shelves.length - 1].yTop, D / 2)
      : adjShelfOffs.length > 0
        ? view.proj(W / 2, innerFloorY - topShelfOff - T, zShelfFront + shelfDepth / 2)
        : null

  const wood = p.colors
  const sideH = H - T
  const sideY = topY
  const legD = legW
  const legZFront = Math.min(48, Math.max(18, D * 0.08))
  const legZBack = Math.max(legZFront, D - legZFront - legD)
  const drawFeet = !hideFeet && L > 0
  const legBox = (x: number, z: number, color: string): SceneSolid | null =>
    drawFeet ? { kind: 'box', x, y: floor - L, z, w: legW, h: L, d: legD, color, assembly: 'feet' } : null
  useCaptureSolid(legBox(legInset, legZFront, legLeftPaint.color))
  useCaptureSolid(legBox(W - legInset - legW, legZFront, legRightPaint.color))
  useCaptureSolid(legBox(legInset, legZBack, wood.leg))
  useCaptureSolid(legBox(W - legInset - legW, legZBack, wood.leg))

  const frame = { ox, top: topY, w: W, h: H, feet: drawFeet ? L : 0, vbW, vbH }
  return (
    <PlacedSketch frame={frame}>
    <SketchSvg vbW={vbW} vbH={vbH} height={460} label="3D изглед отпред">
      <defs>
        <filter id="shadow">
          <feDropShadow dx="1" dy="1" stdDeviation="1.5" floodOpacity="0.3" />
        </filter>
      </defs>

      {drawFeet && (
        <>
          <g
            filter="url(#shadow)"
            style={legLeftPaint.onClick ? { cursor: 'pointer' } : undefined}
            onClick={legLeftPaint.onClick}
          >
            <polygon
              points={`${ox + legInset},${floor - L} ${ox + legInset + legW},${floor - L} ${ox + legInset + legW},${floor} ${ox + legInset},${floor}`}
              fill={legLeftPaint.color}
              stroke={legLeftPaint.chosen ? '#1d4ed8' : '#1e293b'}
              strokeWidth={legLeftPaint.chosen ? 2.8 : 1}
            />
          </g>
          <g
            filter="url(#shadow)"
            style={legRightPaint.onClick ? { cursor: 'pointer' } : undefined}
            onClick={legRightPaint.onClick}
          >
            <polygon
              points={`${ox + W - legInset - legW},${floor - L} ${ox + W - legInset},${floor - L} ${ox + W - legInset},${floor} ${ox + W - legInset - legW},${floor}`}
              fill={legRightPaint.color}
              stroke={legRightPaint.chosen ? '#1d4ed8' : '#1e293b'}
              strokeWidth={legRightPaint.chosen ? 2.8 : 1}
            />
          </g>
        </>
      )}

      <Board x={0} y={floor - L - T} w={W} h={T} d={D} color={wood.bottom} pick="bottom" cam={view} faces={BOX_FACES} />

      {p.hasBack && (
        <Board
          x={T}
          y={cavityTopY}
          z={zBack}
          w={Math.max(1, W - 2 * T)}
          h={Math.max(1, innerFloorY - cavityTopY)}
          d={1}
          color={backFill}
          rearColor={HARDBOARD_RAW_COLOR}
          cam={view}
          faces={{ front: true }}
          strokeWidth={2.4}
          pick="back"
        />
      )}

      <Board x={0} y={sideY} w={T} h={sideH} d={D} color={wood.side} pick="side-left" cam={view} faces={SIDE_LEFT_BODY} />

      {layout.columns.map((col, i) => (
        <g key={`bay-${i}`}>
          <BayShelvesAndPartials
            layout={layout}
            colIndex={i}
            T={T}
            innerFloorY={innerFloorY}
            cam={view}
            shelfColor={wood.shelf}
            sideColor={wood.side}
            fixedZ={zShelfFront}
            fixedD={shelfDepth}
            adjZ={zShelfFront}
            adjD={shelfDepth}
            railSideZ={0}
            railDepth={D}
            pinMark={shelfPinMark(vbH)}
            between={(x0, x1, includeFull, zoneId) => (
              <>
                <DrawerSlidesOnCabinet
                  layout={layout}
                  T={T}
                  cam={view}
                  z0={SLIDE_FRONT_INSET}
                  zLimit={zBack}
                  width={p.width}
                  thickness={p.thickness}
                  slideLength={p.slideLength}
                  slideKind={p.slideKind}
                  innerFloorY={innerFloorY}
                  carcassTopY={topY}
                  carcassBotY={botY}
                  innerTopY={cavityTopY}
                  innerBotY={innerFloorY}
                  insetFronts={p.innerDrawerFronts === true}
                  fontScale={fontScale}
                  opening={{ x0, x1, includeFull, zoneId }}
                  seatPageZ={0}
                  seatShelfZ={zShelfFront}
                />
                {showFronts && (
                  <FrontsOnCabinet
                    layout={layout}
                    W={W}
                    T={T}
                    innerFloorY={innerFloorY}
                    carcassTopY={topY}
                    carcassBotY={botY}
                    innerTopY={cavityTopY}
                    innerBotY={innerFloorY}
                    z={0}
                    d={T}
                    cam={view}
                    fontScale={fontScale}
                    innerDrawerFronts={p.innerDrawerFronts === true}
                    pageFrontZ={0}
                    shelfFrontZ={zShelfFront}
                    innerDoors={p.innerDoors === true}
                    layer="inset"
                    opening={{ x0, x1, includeFull, zoneId }}
                    openDoors={openDoors}
                    frontColor={frontColor}
                  />
                )}
              </>
            )}
          />
          {p.topStyle === 'rails' && (
            <>
              <Board
                x={T + col.x0}
                y={topY}
                w={col.innerW}
                h={T}
                d={R}
                color={wood.rail} pick={`rail-back-${i}`}
                cam={view}
                faces={BETWEEN_FACES}
              />
              <Board
                x={T + col.x0}
                y={topY}
                z={zRailFront}
                w={col.innerW}
                h={T}
                d={R}
                color={wood.rail} pick={`rail-front-${i}`}
                cam={view}
                faces={BETWEEN_FACES}
              />
            </>
          )}
          {layout.partitions[i] && layout.partitions[i].riseMm == null && (
            <Board
              x={T + layout.partitions[i].xLeft}
              y={innerFloorY - sideH}
              w={T}
              h={sideH}
              d={D}
              color={wood.side} pick={`divider-${layout.partitions[i].specIndex}`}
              cam={view}
              faces={SIDE_LEFT_BODY}
            />
          )}
        </g>
      ))}

      <Board x={0} y={sideY} w={T} h={sideH} d={D} color={wood.side} pick="side-left" cam={view} faces={SIDE_LEFT_TOP} />

      <Board x={W - T} y={sideY} w={T} h={sideH} d={D} color={wood.side} pick="side-right" cam={view} faces={SIDE_RIGHT} />

      {p.topStyle === 'fascia' &&
        layout.columns.map((col, i) => (
          <Board
            key={`fascia-${i}`}
            x={T + col.x0}
            y={topY}
            z={FASCIA_SETBACK_MM}
            w={col.innerW}
            h={R}
            d={T}
            color={wood.rail} pick={`fascia-${i}`}
            cam={view}
            faces={BETWEEN_FACES}
          />
        ))}

      {showFronts && (
        <FrontsOnCabinet
          layout={layout}
          W={W}
          T={T}
          innerFloorY={innerFloorY}
          carcassTopY={topY}
          carcassBotY={botY}
          innerTopY={cavityTopY}
          innerBotY={innerFloorY}
          z={0}
          d={T}
          cam={view}
          fontScale={fontScale}
          innerDrawerFronts={p.innerDrawerFronts === true}
          pageFrontZ={0}
          shelfFrontZ={zShelfFront}
          innerDoors={p.innerDoors === true}
          layer="overlay"
          openDoors={openDoors}
          frontColor={frontColor}
        />
      )}

      {marks && (
      <>
      <InteriorHeightDimLines
        layout={layout}
        innerFloorY={innerFloorY}
        T={T}
        fontSize={railFont}
        cam={view}
        shelfZ={zShelfFront}
        railZ={0}
      />
      {layout.partitions.length > 0 && (
        <PartitionDimLines
          partitions={layout.partitions}
          leftovers={showOpeningDims ? [...leftovers, ...openingWidths] : leftovers}
          cam={view}
          innerLeft={T}
          insideY={widthInsideY}
          outsideY={widthOutsideY}
          ceilingWorldY={topY + T}
          anchorY={innerFloorY}
          belowAnchorY={floor}
          fontSize={railFont}
          obstacles={widthAvoid}
          shelves={shelfSeats(layout, T, innerFloorY, zShelfFront)}
        />
      )}
      {showOpeningDims && openingHeights.length > 0 && (
        <RemainingHeightDimLines
          spans={openingHeights}
          innerFloorY={innerFloorY}
          innerLeft={T}
          fontSize={railFont}
          cam={view}
        />
      )}

      {!suppressOuter.height && <DimText x={heightX} y={heightY} label={mm(H)} fontSize={font} rotate={-90} />}
      {!suppressOuter.height && <WorldDim label={mm(H)} x0={-36} y0={topY} z0={0} x1={-36} y1={botY} z1={0} />}
      <DimText x={depthMx} y={depthMy} label={mm(D)} fontSize={font} rotate={depthRot} />
      <WorldDim label={mm(D)} x0={W + 36} y0={topY} z0={0} x1={W + 36} y1={topY} z1={D} />
      {!suppressOuter.width && <DimText x={backMx} y={backMy} label={mm(W)} fontSize={font} />}
      {!suppressOuter.width && <WorldDim label={mm(W)} x0={0} y0={topY - 110} z0={0} x1={W} y1={topY - 110} z1={0} />}
      {p.topStyle === 'rails' &&
        layout.columns.map((col, i) => {
        const pt = view.proj(T + col.x0 + col.innerW / 2, topY + T / 2, zRailFront + R / 2)
        return (
          <g key={`rail-dim-${i}`}>
            <DimText x={pt.x} y={pt.y} label={mm(col.innerW)} fontSize={railFont} />
            <WorldDim
              label={mm(col.innerW)}
              x0={T + col.x0}
              y0={topY + T / 2}
              z0={zRailFront + R / 2}
              x1={T + col.x0 + col.innerW}
              y1={topY + T / 2}
              z1={zRailFront + R / 2}
            />
          </g>
        )
      })}
      {p.topStyle === 'fascia' &&
        layout.columns.map((col, i) => {
          const pt = view.proj(T + col.x0 + col.innerW / 2, topY + R / 2, FASCIA_SETBACK_MM + T / 2)
          return (
            <g key={`fascia-dim-${i}`}>
              <DimText x={pt.x} y={pt.y} label={mm(R)} fontSize={railFont} />
              <WorldDim
                label={mm(R)}
                x0={T + col.x0 + col.innerW / 2}
                y0={topY}
                z0={FASCIA_SETBACK_MM + T / 2}
                x1={T + col.x0 + col.innerW / 2}
                y1={topY + R}
                z1={FASCIA_SETBACK_MM + T / 2}
              />
            </g>
          )
        })}
      {drawFeet && !suppressOuter.height && <DimText x={legLabelX} y={legLabelY} label={mm(L)} fontSize={legFont} rotate={-90} />}
      {drawFeet && !suppressOuter.height && (
        <WorldDim
          label={mm(L)}
          x0={legInset + legW / 2}
          y0={floor - L}
          z0={legZFront + legD / 2}
          x1={legInset + legW / 2}
          y1={floor}
          z1={legZFront + legD / 2}
        />
      )}
      <DimText x={sideLabelX} y={sideLabelY} label={mm(m.sideH)} fontSize={font} rotate={-90} />
      <WorldDim label={mm(m.sideH)} x0={W + 12} y0={topY} z0={D * 0.45} x1={W + 12} y1={topY + m.sideH} z1={D * 0.45} />
      {shelfLabelPt && (
        <DimText
          x={shelfLabelPt.x}
          y={shelfLabelPt.y}
          label={mm(shelfDepth)}
          fontSize={railFont}
          rotate={depthRot}
        />
      )}
      {shelfLabelPt && (
        <WorldDim
          label={mm(shelfDepth)}
          x0={W / 2}
          y0={
            layout.shelves.length > 0
              ? innerFloorY - layout.shelves[layout.shelves.length - 1].yTop
              : innerFloorY - topShelfOff - T
          }
          z0={zShelfFront}
          x1={W / 2}
          y1={
            layout.shelves.length > 0
              ? innerFloorY - layout.shelves[layout.shelves.length - 1].yTop
              : innerFloorY - topShelfOff - T
          }
          z1={zShelfFront + shelfDepth}
        />
      )}

      {showDimLines && (
        <g>
          {!suppressOuter.height && <DimLine x1={heightX + font * 0.22} y1={topY} x2={heightX + font * 0.22} y2={botY} />}
          <DimLine x1={depth.x1} y1={depth.y1} x2={depth.x2} y2={depth.y2} />
          {!suppressOuter.width && (
            <DimLine
              x1={coveredTop ? ox : ox + dx}
              y1={coveredTop ? backMy : topY + dy - font * 0.2}
              x2={coveredTop ? ox + W : ox + W + dx}
              y2={coveredTop ? backMy : topY + dy - font * 0.2}
            />
          )}
        </g>
      )}
      </>
      )}
    </SketchSvg>
    </PlacedSketch>
  )
}

function KitchenWallPreview({
  params,
  className,
  showDimLines,
  showOpeningDims,
  showFronts,
  openDoors = false,
  frontColor,
  backFill = DEFAULT_HARDBOARD_COLOR,
}: {
  params: Record<string, unknown>
  className?: string
  showDimLines: boolean
  showOpeningDims: boolean
  showFronts: boolean
  openDoors?: boolean
  frontColor?: string
  backFill?: string
}) {
  const p = parseKitchenWallParams(params)
  const m = measureCarcass(
    { width: p.width, height: p.height, depth: p.depth, thickness: p.thickness },
    KITCHEN_WALL_JOINERY,
  )
  const { colors } = p
  const layout = layoutInterior({
    innerH: m.innerH,
    innerW: m.innerW,
    thickness: p.thickness,
    fixedShelves: p.fixedShelves,
    partitions: p.partitions,
    doorSpan: p.doorSpan,
    doorCount: p.doorCount,
    shelfCount: p.shelfCount,
    movableShelves: p.movableShelves,
    drawerFrontHeights: p.drawerFrontHeights,
    cutFromOneBoard: p.cutFromOneBoard,
    hasClothesRail: p.hasClothesRail,
    clothesRails: p.clothesRails,
    zones: p.zones,
    overlayCovers: { top: true, bottom: true },
  })
  const drawerViews = uniqueDrawerViews(p, layout)
  const counts = layoutCounts(layout)
  const bottomHole = wallBottomHole(p, m.bottomW, m.bottomD)
  const shelfHole = wallShelfHole(p, m.innerW, shelfPanelDepth(m.sideD, p.thickness, shelfFrontInsetMm(p)))

  return (
    <DrawerHardwareContext.Provider value={drawerHardwareValue(p)}>
    <div className={cn('flex flex-col gap-3', className)}>
      <FrontDrawing title="3D Изглед отпред">
          <WallFront3DView
            p={p}
            m={m}
            layout={layout}
            showDimLines={showDimLines}
            showOpeningDims={showOpeningDims}
            showFronts={showFronts}
            openDoors={openDoors}
            frontColor={frontColor}
            backFill={backFill}
            bottomHole={bottomHole}
            shelfHole={shelfHole}
          />
      </FrontDrawing>
      <ExtraDrawings>
      {drawerViews.map((view, index) => (
        <ViewCard
          key={`${view.frontHeight}-${Math.round(view.box.drawerOuterW)}-${view.label}`}
          title={drawerViewTitle(view, drawerViews.length)}
        >
          <ZoomableView>
            <Drawer3DView p={p} box={view.box} boxKey={`${view.label}-${index}`} />
          </ZoomableView>
        </ViewCard>
      ))}
      </ExtraDrawings>
      <p className="text-center text-[11px] text-[var(--color-muted-foreground)]">
        <span className="mr-3" style={{ color: colors.bottom }}>■ Дъно</span>
        <span className="mr-3" style={{ color: colors.side }}>■ Страници</span>
        <span className="mr-3" style={{ color: colors.rail }}>■ Плот</span>
        {(counts.shelfCount > 0 || layout.shelves.length > 0) && (
          <span className="mr-3" style={{ color: colors.shelf }}>■ Рафтове</span>
        )}
        {p.hasBack && (
          <span className="mr-3" style={{ color: backFill }}>■ Фазер</span>
        )}
        {p.hasHood && <span className="mr-3">○ Абсорбатор</span>}
        {showFronts && layoutHasFronts(layout) && (
          <span className="mr-3" style={{ color: frontColor || FRONT_FILL }}>
            {' '}■ Врати и чела
          </span>
        )}
        {' · '}
        страниците захлупват плота и дъното
      </p>
    </div>
    </DrawerHardwareContext.Provider>
  )
}

function WallFront3DView({
  p,
  m,
  layout,
  showDimLines,
  showOpeningDims,
  showFronts,
  openDoors = false,
  frontColor,
  backFill = DEFAULT_HARDBOARD_COLOR,
  bottomHole,
  shelfHole,
}: {
  p: KitchenWallParams
  m: ReturnType<typeof measureCarcass>
  layout: InteriorLayout
  showDimLines: boolean
  showOpeningDims: boolean
  showFronts: boolean
  openDoors?: boolean
  frontColor?: string
  backFill?: string
  bottomHole?: PanelHole
  shelfHole?: PanelHole
}) {
  const marks = useCabinetMarks()
  const suppressOuter = useSuppressOuter()
  const coveredTop = useCoveredTop()
  const T = m.thickness
  const W = m.outerW
  const H = m.outerH
  const D = m.outerD

  const cam = createDrawCam({ ox: 0, oy: 0 })
  const { x: dx, y: dy } = cam.depthDelta(D)
  const fontScale = p.dimFontScale
  const font = scaledDimFont(Math.max(72, Math.min(W, H) * 0.13), fontScale)
  const small = scaledDimFont(Math.max(48, Math.max(72, Math.min(W, H) * 0.13) * 0.55), fontScale)
  const doorPad = viewPad(openDoors, layout, W, false)
  const padL = (marks ? font + 48 : 28) + doorPad.left
  const padT = (marks ? font : 20) + Math.abs(dy) + (marks ? 28 : 12)
  const padR = (marks ? 48 : 24) + doorPad.right
  const leftovers = leftoverPartitionSpans(layout.partitions, layout.columns)
  const openingWidths = openingWidthSpans(layout.partitions, layout.columns)
  const openingHeights = remainingHeightSpans(layout, m.innerH)
  const vbW = padL + W + dx + padR
  const ox = padL
  const floor = padT + H
  const topY = floor - H
  const view = createDrawCam({ ox, oy: 0 })
  const gap = font * 0.55
  const heightX = ox - gap
  const heightY = (topY + floor) / 2
  const depth = depthMark(ox, coveredTop ? floor : topY, dx, dy, gap, W, coveredTop)
  const depthMx = depth.x
  const depthMy = depth.y
  const depthRot = depth.rot
  const backMx = coveredTop ? ox + W / 2 : ox + W / 2 + dx
  const backMy = coveredTop ? floor - font * 0.55 : topY + dy - font * 0.45
  const zShelfFront = shelfFrontInsetMm(p)
  const shelfDepth = shelfPanelDepth(D, T, zShelfFront)
  const innerFloorY = floor - T
  const widthInsideY = widthDimInsideY(innerFloorY, small)
  const widthOutsideY = floor + Math.max(28, small * 0.45)
  const widthAvoid = [
    ...heightDimBoxes(layout, innerFloorY, T, small, view, 0, zShelfFront, 0),
    ...(showOpeningDims
      ? openingHeights.map((s) => {
          const x = T + (s.x0 + s.x1) / 2
          const a = view.proj(x, innerFloorY - s.startY, 0)
          const b = view.proj(x, innerFloorY - s.endY, 0)
          return dimLabelBox((a.x + b.x) / 2, (a.y + b.y) / 2, mm(s.offsetMm), small, true)
        })
      : []),
  ]
  const widthLabels = placePartitionDimLabels({
    partitions: layout.partitions,
    leftovers: showOpeningDims ? [...leftovers, ...openingWidths] : leftovers,
    cam: view,
    innerLeft: T,
    insideY: widthInsideY,
    outsideY: widthOutsideY,
    ceilingWorldY: topY + T,
    fontSize: small,
    obstacles: widthAvoid,
    shelves: shelfSeats(layout, T, innerFloorY, zShelfFront),
  })
  const padB = (marks ? 36 : 16) + doorPad.bottom + (coveredTop ? font * 0.95 : 0) + (marks && widthLabels.outsideRows > 0 ? widthDimPad(small, widthLabels.outsideRows) : 0)
  const vbH = padT + H + padB
  const innerTopY = topY + T
  const wood = p.colors
  const sideH = H
  const partitionH = m.innerH
  const leftInnerY = topY
  const leftInnerH = H - T

  const frame = { ox, top: topY, w: W, h: H, feet: 0, vbW, vbH }
  return (
    <PlacedSketch frame={frame}>
    <SketchSvg vbW={vbW} vbH={vbH} height={460} label="3D изглед отпред">
      {p.hasBack && (
        <Board
          x={T}
          y={innerTopY}
          z={D}
          w={Math.max(1, W - 2 * T)}
          h={Math.max(1, innerFloorY - innerTopY)}
          d={1}
          color={backFill}
          rearColor={HARDBOARD_RAW_COLOR}
          cam={view}
          faces={{ front: true }}
          strokeWidth={2.4}
          pick="back"
        />
      )}

      <Board
        x={0}
        y={leftInnerY}
        w={T}
        h={leftInnerH}
        d={D}
        color={wood.side} pick="side-left"
        cam={view}
        faces={{ right: true }}
      />
      <Board x={0} y={topY} w={T} h={sideH} d={D} color={wood.side} pick="side-left" cam={view} faces={{ front: true }} />
      <Board x={0} y={topY} w={T} h={T} d={D} color={wood.side} pick="side-left" cam={view} faces={SIDE_LEFT_TOP} />

      <Board x={T} y={innerFloorY} w={m.bottomW} h={T} d={D} color={wood.bottom} pick="bottom" cam={view} faces={BETWEEN_FACES} />
      {bottomHole && (
        <PanelHoleMark x={T} y={innerFloorY} z={0} w={m.bottomW} d={D} hole={bottomHole} cam={view} />
      )}

      {layout.columns.map((_, i) => (
        <g key={`bay-${i}`}>
          <BayShelvesAndPartials
            layout={layout}
            colIndex={i}
            T={T}
            innerFloorY={innerFloorY}
            cam={view}
            shelfColor={wood.shelf}
            sideColor={wood.side}
            fixedZ={zShelfFront}
            fixedD={shelfDepth}
            shelfHole={shelfHole}
            adjZ={zShelfFront}
            adjD={shelfDepth}
            railSideZ={0}
            railDepth={D}
            pinMark={shelfPinMark(vbH)}
            between={(x0, x1, includeFull, zoneId) =>
              showFronts ? (
                <FrontsOnCabinet
                  layout={layout}
                  W={W}
                  T={T}
                  innerFloorY={innerFloorY}
                  carcassTopY={topY}
                  carcassBotY={floor}
                  innerTopY={innerTopY}
                  innerBotY={innerFloorY}
                  z={0}
                  d={T}
                  cam={view}
                  fontScale={fontScale}
                  innerDrawerFronts={p.innerDrawerFronts === true}
                  pageFrontZ={0}
                  shelfFrontZ={zShelfFront}
                  innerDoors={p.innerDoors === true}
                  layer="inset"
                  opening={{ x0, x1, includeFull, zoneId }}
                  openDoors={openDoors}
                  frontColor={frontColor}
                />
              ) : null
            }
          />
          {layout.partitions[i] && layout.partitions[i].riseMm == null && (
            <Board
              x={T + layout.partitions[i].xLeft}
              y={innerTopY}
              w={T}
              h={partitionH}
              d={D}
              color={wood.side} pick={`divider-${layout.partitions[i].specIndex}`}
              cam={view}
              faces={SIDE_LEFT_BODY}
            />
          )}
        </g>
      ))}

      <Board x={W - T} y={topY} w={T} h={sideH} d={D} color={wood.side} pick="side-right" cam={view} faces={SIDE_RIGHT} />

      <Board
        x={T}
        y={topY}
        w={m.railLength}
        h={T}
        d={D}
        color={wood.rail} pick="top"
        cam={view}
        faces={BETWEEN_FACES}
      />

      {showFronts && (
        <FrontsOnCabinet
          layout={layout}
          W={W}
          T={T}
          innerFloorY={innerFloorY}
          carcassTopY={topY}
          carcassBotY={floor}
          innerTopY={innerTopY}
          innerBotY={innerFloorY}
          z={0}
          d={T}
          cam={view}
          fontScale={fontScale}
          innerDrawerFronts={p.innerDrawerFronts === true}
          pageFrontZ={0}
          shelfFrontZ={zShelfFront}
          innerDoors={p.innerDoors === true}
          layer="overlay"
          openDoors={openDoors}
          frontColor={frontColor}
        />
      )}

      {marks && (
      <>
      <InteriorHeightDimLines
        layout={layout}
        innerFloorY={innerFloorY}
        T={T}
        fontSize={small}
        cam={view}
        shelfZ={zShelfFront}
        railZ={0}
      />
      {layout.partitions.length > 0 && (
        <PartitionDimLines
          partitions={layout.partitions}
          leftovers={showOpeningDims ? [...leftovers, ...openingWidths] : leftovers}
          cam={view}
          innerLeft={T}
          insideY={widthInsideY}
          outsideY={widthOutsideY}
          ceilingWorldY={topY + T}
          anchorY={innerFloorY}
          belowAnchorY={floor}
          fontSize={small}
          obstacles={widthAvoid}
          shelves={shelfSeats(layout, T, innerFloorY, zShelfFront)}
        />
      )}
      {showOpeningDims && openingHeights.length > 0 && (
        <RemainingHeightDimLines
          spans={openingHeights}
          innerFloorY={innerFloorY}
          innerLeft={T}
          fontSize={small}
          cam={view}
        />
      )}

      {!suppressOuter.height && <DimText x={heightX} y={heightY} label={mm(H)} fontSize={font} rotate={-90} />}
      {!suppressOuter.height && <WorldDim label={mm(H)} x0={-36} y0={topY} z0={0} x1={-36} y1={floor} z1={0} />}
      <DimText x={depthMx} y={depthMy} label={mm(D)} fontSize={font} rotate={depthRot} />
      <WorldDim label={mm(D)} x0={W + 36} y0={topY} z0={0} x1={W + 36} y1={topY} z1={D} />
      {!suppressOuter.width && <DimText x={backMx} y={backMy} label={mm(W)} fontSize={font} />}
      {!suppressOuter.width && <WorldDim label={mm(W)} x0={0} y0={topY - 110} z0={0} x1={W} y1={topY - 110} z1={0} />}
      {bottomHole && (
        <DimText
          x={view.proj(T + m.bottomW / 2, innerFloorY, D / 2).x}
          y={view.proj(T + m.bottomW / 2, innerFloorY, D / 2).y}
          label={bottomHole.kind === 'round' ? `Ø${mm(bottomHole.diameter)}` : `${mm(bottomHole.width)}×${mm(bottomHole.height)}`}
          fontSize={small}
        />
      )}
      {bottomHole && (
        <WorldDim
          label={bottomHole.kind === 'round' ? `Ø${mm(bottomHole.diameter)}` : `${mm(bottomHole.width)}×${mm(bottomHole.height)}`}
          x0={T + m.bottomW / 2}
          y0={innerFloorY}
          z0={D / 2}
          x1={T + m.bottomW / 2}
          y1={innerFloorY}
          z1={D / 2}
        />
      )}

      {showDimLines && (
        <g>
          {!suppressOuter.height && <DimLine x1={heightX + font * 0.22} y1={topY} x2={heightX + font * 0.22} y2={floor} />}
          <DimLine x1={depth.x1} y1={depth.y1} x2={depth.x2} y2={depth.y2} />
          {!suppressOuter.width && (
            <DimLine
              x1={coveredTop ? ox : ox + dx}
              y1={coveredTop ? backMy : topY + dy - font * 0.2}
              x2={coveredTop ? ox + W : ox + W + dx}
              y2={coveredTop ? backMy : topY + dy - font * 0.2}
            />
          )}
        </g>
      )}
      </>
      )}
    </SketchSvg>
    </PlacedSketch>
  )
}

function Drawer3DView({
  p,
  box,
  boxKey,
}: {
  p: { thickness: number; colors: { side: string }; dimFontScale?: number }
  box: DrawerBoxRails
  boxKey: string
}) {
  const marks = useCabinetMarks()
  const T = p.thickness
  const Wd = box.drawerOuterW
  const Hd = box.outer.height
  const Dd = box.outer.width
  const Wi = box.inner.width
  const Hi = box.inner.height
  const innerY = Hd - Hi

  const hint = createDrawCam({ ox: 0, oy: 0 })
  const { x: dx, y: dy } = hint.depthDelta(Dd)

  const fontScale = p.dimFontScale ?? 1
  const font = scaledDimFont(Math.max(40, Math.min(Wd, Hd) * 0.18), fontScale)
  const small = scaledDimFont(Math.max(32, Math.max(40, Math.min(Wd, Hd) * 0.18) * 0.7), fontScale)
  const padL = marks ? font + 36 : 20
  const padT = (marks ? font : 16) + Math.abs(dy) + (marks ? 24 : 12)
  const padR = marks ? font + 40 : 20
  const padB = marks ? font + 28 : 16

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
      <Board x={0} y={0} w={T} h={Hd} d={Dd} color={wood} pick={`box-${boxKey}-left`} cam={cam} faces={SIDE_LEFT_BODY} />
      <Board
        x={T}
        y={innerY}
        z={Dd - T}
        w={Wi}
        h={Hi}
        d={T}
        color={wood} pick={`box-${boxKey}-back`}
        cam={cam}
        faces={BETWEEN_FACES}
      />
      <Board x={0} y={0} w={T} h={Hd} d={Dd} color={wood} pick={`box-${boxKey}-left`} cam={cam} faces={SIDE_LEFT_TOP} />
      <Board x={Wd - T} y={0} w={T} h={Hd} d={Dd} color={wood} pick={`box-${boxKey}-right`} cam={cam} faces={SIDE_RIGHT} />
      <Board x={T} y={innerY} z={0} w={Wi} h={Hi} d={T} color={wood} pick={`box-${boxKey}-front`} cam={cam} faces={BETWEEN_FACES} />

      {marks && (
        <>
          <DimText x={outerL.x} y={outerL.y} label={mm(Dd)} fontSize={small} />
          <DimText x={outerH.x} y={outerH.y} label={mm(Hd)} fontSize={small} rotate={-90} />
          <DimText
            x={innerFrontMid.x}
            y={innerFrontMid.y}
            label={Hi !== Hd ? `${mm(Wi)}×${mm(Hi)}` : mm(Wi)}
            fontSize={small}
          />
          <DimText x={boxW.x} y={boxW.y} label={mm(Wd)} fontSize={small} />
        </>
      )}
    </SketchSvg>
  )
}

function PlinthBoxPreview({
  typeId,
  params,
  className,
  showDimLines,
  showOpeningDims,
  showFronts,
  openDoors = false,
  frontColor,
  backFill = DEFAULT_HARDBOARD_COLOR,
}: {
  typeId: 'nightstand' | 'vanity' | 'section' | 'wardrobe'
  params: Record<string, unknown>
  className?: string
  showDimLines: boolean
  showOpeningDims: boolean
  showFronts: boolean
  openDoors?: boolean
  frontColor?: string
  backFill?: string
}) {
  const topInner = typeId === 'section' || typeId === 'wardrobe'
  const vanityParsed = typeId === 'vanity' ? parseVanityParams(params) : null
  const p =
    vanityParsed ??
    (typeId === 'wardrobe'
      ? parseWardrobeParams(params)
      : topInner
        ? parseSectionParams(params)
        : parseNightstandParams(params))
  const opening = vanityParsed ? vanityOpening(vanityParsed) : null
  const bottomSpans =
    opening && !opening.error ? opening.pedestals.map((pedestal) => ({ x: pedestal.x, w: pedestal.w })) : null
  const kneeSpan =
    opening && !opening.error ? { x: p.thickness + opening.x0, w: opening.knee } : null
  const backSpans =
    vanityParsed && opening && !opening.error && vanityParsed.hasBack
      ? vanityBackSpans(vanityParsed, opening)
      : null
  const fascia =
    opening && !opening.error
      ? {
          x: p.thickness + opening.x0,
          w: opening.knee,
          h: vanityParsed?.backRailHeight ?? 280,
        }
      : null
  const m = measureNightstand(p, topInner)
  const { colors } = p
  const sliding = p.doorStyle === 'sliding'
  const layout = layoutInterior({
    innerH: m.innerH,
    innerW: m.innerW,
    thickness: p.thickness,
    fixedShelves: p.fixedShelves,
    partitions: p.partitions,
    doorSpan: sliding ? 'full' : p.doorSpan,
    doorCount: sliding ? 0 : p.doorCount,
    shelfCount: p.shelfCount,
    movableShelves: p.movableShelves,
    drawerFrontHeights: p.drawerFrontHeights,
    cutFromOneBoard: p.cutFromOneBoard,
    hasClothesRail: p.hasClothesRail,
    clothesRails: p.clothesRails,
    zones: sliding
      ? Object.fromEntries(
          Object.entries(p.zones ?? {}).map(([id, z]) => [id, z ? { ...z, doorCount: 0 as const } : z]),
        )
      : p.zones,
    overlayCovers: sliding
      ? { top: false, bottom: false }
      : { top: m.frontCoversTop, bottom: m.frontCoversBottom },
  })
  const counts = layoutCounts(layout)
  const drawerViews = uniqueDrawerViews(p, layout)
  return (
    <DrawerHardwareContext.Provider value={drawerHardwareValue(p)}>
    <div className={cn('flex flex-col gap-3', className)}>
      <FrontDrawing title="3D Изглед отпред">
          <PlinthBoxFront3DView
            p={p}
            topInner={topInner}
            layout={layout}
            showDimLines={showDimLines}
            showOpeningDims={showOpeningDims}
            showFronts={showFronts}
            openDoors={openDoors}
            frontColor={frontColor}
            backFill={backFill}
            bottomSpans={bottomSpans}
            kneeSpan={kneeSpan}
            backSpans={backSpans}
            fascia={fascia}
            boardMirror={parseMirrorSpec(params.boardMirror)}
            dividersToFloor={bottomSpans != null}
            sketchTitle={typeId === 'vanity' ? 'Тоалетка 3D' : ''}
          />
      </FrontDrawing>
      <ExtraDrawings>
      {drawerViews.map((view, index) => (
        <ViewCard
          key={`${view.frontHeight}-${Math.round(view.box.drawerOuterW)}-${view.label}`}
          title={drawerViewTitle(view, drawerViews.length)}
        >
          <ZoomableView>
            <Drawer3DView p={p} box={view.box} boxKey={`${view.label}-${index}`} />
          </ZoomableView>
        </ViewCard>
      ))}
      </ExtraDrawings>
      <p className="text-center text-[11px] text-[var(--color-muted-foreground)]">
        <span className="mr-3" style={{ color: colors.bottom }}>■ Дъно</span>
        <span className="mr-3" style={{ color: colors.side }}>■ Страници</span>
        {p.topStyle === 'panel' && (
          <span className="mr-3" style={{ color: colors.rail }}>■ Плот</span>
        )}
        {p.topStyle === 'fascia' && (
          <span className="mr-3" style={{ color: colors.rail }}>■ Бленда надолу</span>
        )}
        {counts.shelfCount > 0 || layout.shelves.length > 0 ? (
          <span className="mr-3" style={{ color: colors.shelf }}>■ Рафтове</span>
        ) : null}
        {p.hasBack && (
          <span className="mr-3" style={{ color: backFill }}>■ Фазер</span>
        )}
        {counts.clothesRailCount > 0 && (
          <span className="mr-3" style={{ color: CLOTHES_RAIL_COLOR }}>■ Лост</span>
        )}
        {drawerViews.length > 0 && (
          <span className="mr-3" style={{ color: SLIDE_STROKE_COLOR }}>■ Водачи</span>
        )}
        {p.useLegs ? (
          <span style={{ color: colors.leg }}>■ Крачета</span>
        ) : (
          <span style={{ color: colors.bottom }}>■ Цокъл</span>
        )}
        {showFronts && layoutHasFronts(layout, sliding && p.doorCount === 2) && (
          <span className="mr-3" style={{ color: frontColor || FRONT_FILL }}> ■ Врати и чела</span>
        )}
        {!showFronts && (counts.doorCount > 0 || (sliding && p.doorCount === 2)) && (
          <>
            {' · '}
            {sliding && p.doorCount === 2
              ? '2 плъзгащи врати'
              : counts.doorCount === 1
                ? '1 врата'
                : `${counts.doorCount} врати`} (Врати → Затворени)
          </>
        )}
        {!showFronts && counts.drawerCount > 0 && (
          <>
            {' · '}
            {counts.drawerCount === 1 ? '1 чекмедже' : `${counts.drawerCount} чекмеджета`} (Врати → Затворени)
          </>
        )}
        {' · '}
        {topInner
          ? p.topStyle === 'panel'
            ? 'страниците външни на дъното и плота, плотът между тях'
            : p.topStyle === 'fascia'
              ? 'страниците външни на дъното, бленда надолу 3 мм навътре'
              : 'страниците външни на дъното, отворен корпус отгоре'
          : p.topStyle === 'panel'
            ? 'страниците външни на дъното, плотът външен върху страниците, ъгълчета отвътре'
            : p.topStyle === 'fascia'
              ? 'страниците външни на дъното, бленда надолу 3 мм навътре'
              : 'страниците външни на дъното, отворен корпус отгоре'}
      </p>
    </div>
    </DrawerHardwareContext.Provider>
  )
}

function PlinthBoxFront3DView({
  p,
  topInner,
  layout,
  showDimLines,
  showOpeningDims,
  showFronts,
  openDoors = false,
  frontColor,
  backFill = DEFAULT_HARDBOARD_COLOR,
  bottomSpans = null,
  kneeSpan = null,
  backSpans = null,
  fascia = null,
  boardMirror = null,
  dividersToFloor = false,
  sketchTitle = '',
}: {
  p: NightstandParams
  topInner: boolean
  layout: InteriorLayout
  showDimLines: boolean
  showOpeningDims: boolean
  showFronts: boolean
  openDoors?: boolean
  frontColor?: string
  backFill?: string
  bottomSpans?: { x: number; w: number }[] | null
  kneeSpan?: { x: number; w: number } | null
  backSpans?: { x: number; w: number }[] | null
  fascia?: { x: number; w: number; h: number } | null
  boardMirror?: MirrorSpec | null
  dividersToFloor?: boolean
  sketchTitle?: string
}) {
  const marks = useCabinetMarks()
  const suppressOuter = useSuppressOuter()
  const coveredTop = useCoveredTop()
  const hideDoors = React.useContext(HideDoorsContext)
  const doorMirror = React.useContext(DoorMirrorContext)
  const m = measureNightstand(p, topInner)
  const T = m.thickness
  const W = p.width
  const H = p.height
  const D = p.depth
  const zSide = m.frontOverhang
  const kneeInner =
    kneeSpan != null ? { x0: kneeSpan.x - T, x1: kneeSpan.x - T + kneeSpan.w } : null

  const hint = createDrawCam({ ox: 0, oy: 0 })
  const { x: dx, y: dy } = hint.depthDelta(D)

  const fontScale = p.dimFontScale
  const fontBase = Math.max(72, Math.min(W, H) * 0.13)
  const font = scaledDimFont(fontBase, fontScale)
  const small = scaledDimFont(Math.max(40, fontBase * 0.55), fontScale)
  const tallCabinet = H >= 1800
  const supportFont = scaledDimFont(Math.max(30, Math.min(tallCabinet ? 46 : 48, Math.max(40, fontBase * 0.55) * 0.58)), fontScale)
  const supportGap = Math.max(34, supportFont * 0.75)
  const doorPad = viewPad(openDoors, layout, W, m.sliding && p.doorCount === 2)
  const padL = (marks ? font + 48 : 28) + doorPad.left + (fascia && marks ? font * 1.6 : 0)
  const padT =
    (marks ? font : 20) +
    Math.abs(dy) +
    (marks ? 28 : 12) +
    (fascia ? VANITY_MIRROR_BOARD_MM + Math.abs(dy) + (marks ? font : 16) : 0)
  const padR = (marks ? 48 : 24) + doorPad.right
  const leftovers = leftoverPartitionSpans(layout.partitions, layout.columns)
  const openingWidths = openingWidthSpans(layout.partitions, layout.columns)
  const openingHeights = remainingHeightSpans(layout, m.innerH)
  const slidingLeaves =
    m.sliding && p.doorCount === 2
      ? layoutSlidingDoors({
          innerW: m.innerW,
          innerH: m.innerH,
          thickness: T,
          partitions: layout.partitions,
          edges: p.slidingEdges,
        })
      : []
  const doorWidthSpans = showFronts ? slidingDoorDimSpans(slidingLeaves) : []

  const vbW = padL + W + dx + padR
  const ox = padL
  const floor = padT + H
  const topY = floor - H
  const coveringTop = m.coveringTop
  const innerTopPanel = m.innerTopPanel
  const sideY = coveringTop ? topY + T : topY
  const supportH = m.supportH
  const bottomY = floor - supportH - T

  const view = createDrawCam({ ox, oy: 0 })

  const gap = font * 0.55
  const heightX = ox - gap
  const heightY = (topY + floor) / 2
  const depth = depthMark(ox, coveredTop ? floor : topY, dx, dy, gap, W, coveredTop)
  const depthMx = depth.x
  const depthMy = depth.y
  const depthRot = depth.rot
  const backMx = coveredTop ? ox + W / 2 : ox + W / 2 + dx
  const backMy = coveredTop ? floor - font * 0.55 : topY + dy - font * 0.45
  const sideDepthLabel = view.proj(W, sideY + m.sideH * 0.4, zSide + m.sideD / 2)
  const bottomFrontLabel = p.useLegs
    ? view.proj(W / 2, bottomY + T / 2, 0)
    : view.proj(T + m.bottomW / 2, bottomY + T / 2, zSide)
  const supportLineX = ox - supportGap
  const supportTick = Math.max(10, supportFont * 0.22)
  const supportLabelX = supportLineX - supportFont * 0.28
  const supportLift = tallCabinet ? Math.max(24, supportFont * 0.75) : 12
  const supportLabelY = floor - supportH / 2 - supportLift

  const wood = p.colors
  const legW = Math.max(18, T * 1.2)
  const legD = Math.max(legW, 42)
  const legInset = Math.max(28, W * 0.08)
  const legZ = Math.max(16, T)
  const plinthMeetsLeft =
    !bottomSpans || bottomSpans.some((span) => Math.abs(span.x - T) < 1)

  const zShelfFront = zSide + (m.sideD - m.shelfD)
  const shelfDepth = m.shelfD
  const zPartition = zSide + (m.sideD - m.partitionD)
  const innerFloorY = bottomY
  const shelfDimZ = m.sliding ? zShelfFront : zSide
  const widthInsideY = widthDimInsideY(innerFloorY, small, m.sliding ? SLIDING_BOTTOM_TRACK_MM : 0)
  const widthOutsideY = floor + Math.max(28, small * 0.45)
  const widthZAtX = (x: number) =>
    layout.partitions.some((part) => x >= part.xLeft - 0.51 && x <= part.xRight + 0.51) ? zPartition : zSide
  const lowerTrackDepthPt = m.sliding
    ? view.proj(
        T + m.innerW * 0.72,
        bottomY - 18,
        zSide + SLIDING_LOWER_TRACK_INSET_MM + SLIDING_LOWER_TRACK_DEPTH_MM / 2,
      )
    : null
  const lowerTrackInsetPt = m.sliding
    ? view.proj(T + m.innerW * 0.55, bottomY - 8, zSide + SLIDING_LOWER_TRACK_INSET_MM / 2)
    : null
  const widthAvoidBase = [
    ...heightDimBoxes(layout, innerFloorY, T, small, view, shelfDimZ, shelfDimZ, zSide),
    ...(showOpeningDims
      ? openingHeights.map((s) => {
          const x = T + (s.x0 + s.x1) / 2
          const a = view.proj(x, innerFloorY - s.startY, zSide)
          const b = view.proj(x, innerFloorY - s.endY, zSide)
          return dimLabelBox((a.x + b.x) / 2, (a.y + b.y) / 2, mm(s.offsetMm), small, true)
        })
      : []),
    ...(m.sliding && showDimLines && lowerTrackDepthPt && lowerTrackInsetPt
      ? [
          dimLabelBox(
            lowerTrackDepthPt.x,
            lowerTrackDepthPt.y - small * 0.35,
            mm(SLIDING_LOWER_TRACK_DEPTH_MM),
            small,
            false,
          ),
          dimLabelBox(
            lowerTrackInsetPt.x,
            lowerTrackInsetPt.y - small * 0.35,
            mm(SLIDING_LOWER_TRACK_INSET_MM),
            small,
            false,
          ),
        ]
      : []),
  ]
  const bottomLabelX =
    fitLabelX(
      bottomFrontLabel.x,
      bottomFrontLabel.y,
      mm(m.bottomW),
      small,
      widthAvoidBase,
      bottomFrontLabel.x - small * 2.6,
      bottomFrontLabel.x + small * 0.8,
    ) ?? bottomFrontLabel.x
  const splitBottom = bottomSpans != null && bottomSpans.length > 0
  const widthAvoid = [
    ...widthAvoidBase,
    ...(splitBottom ? [] : [dimLabelBox(bottomLabelX, bottomFrontLabel.y, mm(m.bottomW), small, false)]),
  ]
  const widthLabels = placePartitionDimLabels({
    partitions: layout.partitions,
    leftovers: showOpeningDims ? [...leftovers, ...openingWidths] : leftovers,
    cam: view,
    innerLeft: T,
    insideY: widthInsideY,
    outsideY: widthOutsideY,
    ceilingWorldY: topY + T,
    z: zPartition,
    leftoverZ: zSide,
    zAtX: widthZAtX,
    fontSize: small,
    obstacles: widthAvoid,
    shelves: shelfSeats(layout, T, innerFloorY, zShelfFront),
  })
  const padB =
    (marks ? Math.max(52, supportFont * 0.85) : 16) +
    doorPad.bottom +
    (coveredTop ? font * 0.95 : 0) +
    (marks && widthLabels.outsideRows > 0 ? widthDimPad(small, widthLabels.outsideRows) : 0)
  const vbH = padT + H + padB
  const carcassBotY = floor - supportH
  const frontTopY = coveringTop ? topY + T : topY
  const frontBotY = m.frontCoversBottom ? carcassBotY : bottomY

  const leftInnerY = innerTopPanel ? topY + T : sideY
  const leftInnerH = Math.max(T, bottomY - leftInnerY)
  const partitionDepthDim = (() => {
    if (layout.partitions.length === 0) return null
    if (!(m.partitionD + 0.5 < m.sideD)) return null
    const part = layout.partitions[layout.partitions.length - 1]!
    const x = T + part.xRight
    const y = leftInnerY + Math.max(56, leftInnerH * 0.16)
    const a = view.proj(x, y, zPartition)
    const b = view.proj(x, y, zPartition + m.partitionD)
    const mid = view.proj(x, y, zPartition + m.partitionD / 2)
    return { a, b, mid }
  })()

  const frame = { ox, top: topY, w: W, h: H, feet: 0, vbW, vbH }
  return (
    <PlacedSketch frame={frame}>
    <SketchSvg vbW={vbW} vbH={vbH} height={460} label={sketchTitle || (topInner ? (p.doorStyle === 'sliding' ? 'Гардероб 3D' : 'Секция 3D') : 'Нощно шкафче 3D')}>
      <defs>
        <filter id="ns-shadow">
          <feDropShadow dx="1" dy="1" stdDeviation="1.5" floodOpacity="0.3" />
        </filter>
      </defs>

      {p.useLegs && (
        <>
          <Board
            x={legInset}
            y={floor - supportH}
            z={legZ}
            w={legW}
            h={supportH}
            d={legD}
            color={wood.leg} pick="leg-left"
            cam={view}
            faces={{ front: true, right: true, top: true }}
          />
          <Board
            x={W - legInset - legW}
            y={floor - supportH}
            z={legZ}
            w={legW}
            h={supportH}
            d={legD}
            color={wood.leg} pick="leg-right"
            cam={view}
            faces={{ front: true, right: true, top: true }}
          />
        </>
      )}

      {p.useLegs && (
        <Board
          x={0}
          y={bottomY}
          z={0}
          w={W}
          h={T}
          d={D}
          color={wood.bottom} pick="bottom"
          cam={view}
          faces={BOX_FACES}
        />
      )}

      {fascia && (
        <Board
          x={0}
          y={sideY - VANITY_MIRROR_BOARD_MM}
          z={zSide + m.sideD}
          w={W}
          h={VANITY_MIRROR_BOARD_MM + Math.min(fascia.h, Math.max(T, m.sideH))}
          d={T}
          color={wood.side}
          pick="mirror-board"
          cam={view}
          faces={{ front: true, right: true, top: true }}
        />
      )}
      {fascia && (() => {
        // Glass only above the top: lower down the board is behind the top and the pedestals.
        const glass = boardMirror ? mirrorGlass(W, VANITY_MIRROR_BOARD_MM - T, boardMirror) : null
        if (!glass) return null
        const halo = boardMirror?.halo
        // Lit from behind, the glass is glued on a second board and stands off by its thickness.
        const standoff = halo ? T : 0
        return (
          <>
          {halo && (
            <GlowCapture
              solid={{
                kind: 'glow',
                key: 'vanity-mirror',
                x: glass.x,
                y: sideY - VANITY_MIRROR_BOARD_MM + glass.y,
                z: zSide + m.sideD,
                w: glass.width,
                h: glass.height,
                color: MIRROR_HALO_COLOR[halo],
              }}
            />
          )}
          {halo &&
            haloParts(
              { ...glass, y: sideY - VANITY_MIRROR_BOARD_MM + glass.y },
              zSide + m.sideD,
              W,
              T,
              wood.side,
              halo,
              sideY - 250,
            ).map((part, index) => <CaptureOnly key={`halo-${index}`} solid={part} />)}
          {/* GlassMania 3 mm; when lit it is glued on the second board, one board thickness off. */}
          <Board
            x={glass.x}
            y={sideY - VANITY_MIRROR_BOARD_MM + glass.y}
            z={halo ? zSide + m.sideD - standoff - 3 : zSide + m.sideD - 6}
            w={glass.width}
            h={glass.height}
            d={halo ? 3 : 4}
            color={MIRROR_GLASS_COLOR}
            cam={view}
            faces={{ front: true }}
            mirrorGlass
          />
          </>
        )
      })()}

      {p.hasBack &&
        (backSpans && backSpans.length > 0 ? backSpans : [{ x: T, w: Math.max(1, W - 2 * T) }]).map((span) => (
          <Board
            key={`back-${span.x}`}
            x={span.x}
            y={topY + (m.innerTopPanel || m.coveringTop ? T : 0)}
            z={zSide + m.sideD}
            w={Math.max(1, span.w)}
            h={Math.max(1, (p.useLegs ? H : H - p.plinthHeight) - (m.innerTopPanel || m.coveringTop ? T : 0) - T)}
            d={1}
            color={backFill}
            rearColor={HARDBOARD_RAW_COLOR}
            cam={view}
            faces={{ front: true }}
            strokeWidth={2.4}
            pick={`back-${Math.round(span.x)}`}
          />
        ))}

      <Board
        x={0}
        y={leftInnerY}
        z={zSide}
        w={T}
        h={leftInnerH}
        d={m.sideD}
        color={wood.side} pick="side-left"
        cam={view}
        faces={{ right: true }}
      />
      {!p.useLegs && (
        <>
          {plinthMeetsLeft && (
            <Board
              x={0}
              y={floor - p.plinthHeight}
              z={zSide}
              w={T}
              h={p.plinthHeight}
              d={m.plinthInset}
              color={wood.side} pick="side-left"
              cam={view}
              faces={{ right: true }}
              strokeWidth={0}
            />
          )}
          {/* The second plinth stands at the back, drawn first so the front one covers it. */}
          {!bottomSpans && p.plinthCount === 2 && (
            <Board
              x={T}
              y={floor - p.plinthHeight}
              z={m.backPlinthZ}
              w={m.plinthLength}
              h={p.plinthHeight}
              d={T}
              color={wood.bottom} pick="plinth"
              cam={view}
              faces={{ front: true, top: true }}
            />
          )}
          {!bottomSpans && (
            <Board
              x={T}
              y={floor - p.plinthHeight}
              z={m.plinthZ}
              w={m.plinthLength}
              h={p.plinthHeight}
              d={T}
              color={wood.bottom} pick="plinth"
              cam={view}
              faces={{ front: true, top: true }}
            />
          )}
        </>
      )}
      <Board
        x={0}
        y={sideY}
        z={zSide}
        w={T}
        h={m.sideH}
        d={m.sideD}
        color={wood.side} pick="side-left"
        cam={view}
        faces={{ front: true }}
      />
      {topInner && (
        <Board
          x={0}
          y={topY}
          z={zSide}
          w={T}
          h={T}
          d={m.sideD}
          color={wood.side} pick="side-left"
          cam={view}
          faces={SIDE_LEFT_TOP}
        />
      )}

      {!p.useLegs && (
        <>
          {(!bottomSpans ? [{ x: T, w: m.bottomW }] : []).map((span) => (
            <React.Fragment key={`bottom-${span.x}`}>
              <Board
                x={span.x}
                y={bottomY}
                z={zSide}
                w={span.w}
                h={T}
                d={m.bottomD}
                color={wood.bottom} pick="bottom"
                cam={view}
                faces={{ top: true }}
                strokeWidth={0}
              />
              <Board
                x={span.x}
                y={bottomY}
                z={zSide}
                w={span.w}
                h={T}
                d={1}
                color={wood.bottom} pick="bottom"
                cam={view}
                faces={{ front: true }}
              />
            </React.Fragment>
          ))}
        </>
      )}

      {layout.columns.map((col, i) => {
        const inThisBay = (x: number, w: number) => {
          const mid = x + w / 2
          return mid >= T + col.x0 - 1 && mid <= T + col.x1 + 1
        }
        return (
        <g key={`ns-bay-${i}`}>
          {fascia && inThisBay(fascia.x, fascia.w) && (
            <Board
              x={fascia.x}
              y={sideY}
              z={zSide + m.sideD - T}
              w={fascia.w}
              h={Math.min(fascia.h, Math.max(T, m.sideH))}
              d={T}
              color={wood.rail} pick="fascia-knee"
              cam={view}
              faces={{ front: true }}
            />
          )}
          {bottomSpans &&
            !p.useLegs &&
            bottomSpans.filter((span) => inThisBay(span.x, span.w)).map((span) => {
              const meetsLeft = Math.abs(span.x - T) < 1
              const meetsRight = Math.abs(span.x + span.w - (W - T)) < 1
              return (
                <React.Fragment key={`bay-base-${span.x}`}>
                  {p.plinthCount === 2 && (
                    <Board
                      x={span.x}
                      y={floor - p.plinthHeight}
                      z={m.backPlinthZ}
                      w={span.w}
                      h={p.plinthHeight}
                      d={T}
                      color={wood.bottom} pick={`plinth-${Math.round(span.x)}`}
                      cam={view}
                      faces={{ front: true, top: true, right: !meetsRight, left: !meetsLeft }}
                    />
                  )}
                  <Board
                    x={span.x}
                    y={floor - p.plinthHeight}
                    z={m.plinthZ}
                    w={span.w}
                    h={p.plinthHeight}
                    d={T}
                    color={wood.bottom} pick={`plinth-${Math.round(span.x)}`}
                    cam={view}
                    faces={{
                      front: true,
                      top: true,
                      right: !meetsRight,
                      left: !meetsLeft,
                    }}
                  />
                  <Board
                    x={span.x}
                    y={bottomY}
                    z={zSide}
                    w={span.w}
                    h={T}
                    d={m.bottomD}
                    color={wood.bottom} pick={`bottom-${Math.round(span.x)}`}
                    cam={view}
                    faces={{ top: true }}
                    strokeWidth={0}
                  />
                  <Board
                    x={span.x}
                    y={bottomY}
                    z={zSide}
                    w={span.w}
                    h={T}
                    d={1}
                    color={wood.bottom} pick={`bottom-${Math.round(span.x)}`}
                    cam={view}
                    faces={{ front: true }}
                  />
                </React.Fragment>
              )
            })}
          <BayShelvesAndPartials
            layout={layout}
            colIndex={i}
            T={T}
            innerFloorY={innerFloorY}
            cam={view}
            shelfColor={wood.shelf}
            sideColor={wood.side}
            fixedZ={zShelfFront}
            fixedD={shelfDepth}
            adjZ={zShelfFront}
            adjD={shelfDepth}
            pinMark={shelfPinMark(vbH)}
            clothesTrackMm={m.sliding ? SLIDING_UPPER_TRACK_HEIGHT_MM : 0}
            railSideZ={m.sliding ? zPartition : zSide}
            railPartitionZ={m.sliding ? zPartition : zSide}
            railDepth={m.sliding ? m.partitionD : m.sideD}
            between={(x0, x1, includeFull, zoneId) => (
              <>
                <DrawerSlidesOnCabinet
                  layout={layout}
                  T={T}
                  cam={view}
                  z0={m.sliding ? zPartition + SLIDE_FRONT_INSET : zSide + SLIDE_FRONT_INSET}
                  zLimit={zSide + m.sideD}
                  partitionFrontZ={m.sliding ? zPartition + SLIDE_FRONT_INSET : undefined}
                  width={p.width}
                  thickness={p.thickness}
                  slideLength={p.slideLength}
                  slideKind={p.slideKind}
                  innerFloorY={innerFloorY}
                  carcassTopY={frontTopY}
                  carcassBotY={frontBotY}
                  innerTopY={leftInnerY}
                  innerBotY={bottomY}
                  insetFronts={p.innerDrawerFronts === true}
                  fontScale={fontScale}
                  clearanceBottom={m.sliding ? SLIDING_DRAWER_FROM_BOTTOM_MM : 0}
                  opening={{ x0, x1, includeFull, zoneId }}
                  seatPageZ={m.sliding ? zPartition : zSide}
                  seatShelfZ={zShelfFront}
                  hangFromTop={kneeInner}
                />
                {showFronts && (
                  <FrontsOnCabinet
                    layout={layout}
                    W={W}
                    T={T}
                    innerFloorY={innerFloorY}
                    carcassTopY={m.sliding ? leftInnerY : frontTopY}
                    carcassBotY={m.sliding ? bottomY : frontBotY}
                    innerTopY={leftInnerY}
                    innerBotY={bottomY}
                    z={0}
                    d={T}
                    cam={view}
                    clearanceBottom={m.sliding ? SLIDING_DRAWER_FROM_BOTTOM_MM : 0}
                    insetFronts={m.sliding}
                    innerDrawerFronts={p.innerDrawerFronts === true}
                    pageFrontZ={m.sliding ? zPartition : zSide}
                    shelfFrontZ={zShelfFront}
                    insetFrontZ={
                      m.sliding
                        ? zPartition
                        : p.innerDrawerFronts
                          ? Math.max(x0 <= 0.5 ? zSide : zPartition, x1 >= m.innerW - 0.5 ? zSide : zPartition)
                          : undefined
                    }
                    innerDoors={p.innerDoors === true}
                    layer="inset"
                    fontScale={fontScale}
                    opening={{ x0, x1, includeFull, zoneId }}
                    openDoors={openDoors}
                    frontColor={frontColor}
                    hangFromTop={kneeInner}
                  />
                )}
              </>
            )}
          />
          {layout.partitions[i] && layout.partitions[i].riseMm == null && (
            <Board
              x={T + layout.partitions[i].xLeft}
              y={dividersToFloor ? sideY : leftInnerY}
              z={zPartition}
              w={T}
              h={dividersToFloor ? m.sideH : leftInnerH}
              d={m.partitionD}
              color={wood.side} pick={`divider-${layout.partitions[i].specIndex}`}
              cam={view}
              faces={SIDE_LEFT_BODY}
            />
          )}
        </g>
        )
      })}

      {m.sliding && (
        <>
          <Board
            x={T}
            y={leftInnerY}
            z={zSide}
            w={m.innerW}
            h={SLIDING_UPPER_TRACK_HEIGHT_MM}
            d={SLIDING_UPPER_TRACK_DEPTH_MM}
            color="#8a9199"
            cam={view}
            faces={BETWEEN_FACES}
          />
          <Board
            x={T}
            y={bottomY - SLIDING_BOTTOM_TRACK_MM}
            z={zSide + SLIDING_LOWER_TRACK_INSET_MM}
            w={m.innerW}
            h={SLIDING_BOTTOM_TRACK_MM}
            d={SLIDING_LOWER_TRACK_DEPTH_MM}
            color="#6b7280"
            cam={view}
            faces={BETWEEN_FACES}
          />
          <Board
            x={T}
            y={bottomY - SLIDING_BOTTOM_TRACK_MM}
            z={zSide + SLIDING_LOWER_TRACK_INSET_MM + 10}
            w={m.innerW}
            h={1}
            d={18}
            color="#374151"
            cam={view}
            faces={BETWEEN_FACES}
          />
          <Board
            x={T}
            y={bottomY - SLIDING_BOTTOM_TRACK_MM}
            z={zSide + SLIDING_LOWER_TRACK_INSET_MM + 34}
            w={m.innerW}
            h={1}
            d={18}
            color="#374151"
            cam={view}
            faces={BETWEEN_FACES}
          />
        </>
      )}

      <Board
        x={W - T}
        y={sideY}
        z={zSide}
        w={T}
        h={m.sideH}
        d={m.sideD}
        color={wood.side} pick="side-right"
        cam={view}
        faces={topInner ? SIDE_RIGHT : SIDE_LEFT_BODY}
      />
      {p.topStyle === 'fascia' &&
        layout.columns.map((col, i) => (
          <Board
            key={`fascia-${i}`}
            x={T + col.x0}
            y={topY}
            z={zSide + FASCIA_SETBACK_MM}
            w={col.innerW}
            h={p.railWidth}
            d={T}
            color={wood.rail} pick={`fascia-${i}`}
            cam={view}
            faces={BETWEEN_FACES}
          />
        ))}

      {innerTopPanel ? (
        <Board
          x={T}
          y={topY}
          z={zSide}
          w={m.topW}
          h={T}
          d={m.topD}
          color={wood.rail} pick="top"
          cam={view}
          faces={BETWEEN_FACES}
        />
      ) : coveringTop ? (
        <Board
          x={0}
          y={topY}
          z={0}
          w={m.topW}
          h={T}
          d={m.topD}
          color={wood.rail} pick="top"
          cam={view}
          faces={BOX_FACES}
        />
      ) : null}

      {marks && m.sliding && showDimLines && (
        <>
          <DimLine
            x1={view.proj(T + m.innerW * 0.72, leftInnerY + 12, zSide).x}
            y1={view.proj(T + m.innerW * 0.72, leftInnerY + 12, zSide).y}
            x2={view.proj(T + m.innerW * 0.72, leftInnerY + 12, zSide + SLIDING_UPPER_TRACK_DEPTH_MM).x}
            y2={view.proj(T + m.innerW * 0.72, leftInnerY + 12, zSide + SLIDING_UPPER_TRACK_DEPTH_MM).y}
          />
          <DimText
            x={view.proj(T + m.innerW * 0.72, leftInnerY + 12, zSide + SLIDING_UPPER_TRACK_DEPTH_MM / 2).x}
            y={view.proj(T + m.innerW * 0.72, leftInnerY + 12, zSide + SLIDING_UPPER_TRACK_DEPTH_MM / 2).y - small * 0.35}
            label={mm(SLIDING_UPPER_TRACK_DEPTH_MM)}
            fontSize={small}
          />
          <DimLine
            x1={view.proj(T + m.innerW * 0.72, bottomY - 18, zSide + SLIDING_LOWER_TRACK_INSET_MM).x}
            y1={view.proj(T + m.innerW * 0.72, bottomY - 18, zSide + SLIDING_LOWER_TRACK_INSET_MM).y}
            x2={view.proj(T + m.innerW * 0.72, bottomY - 18, zSide + SLIDING_LOWER_TRACK_INSET_MM + SLIDING_LOWER_TRACK_DEPTH_MM).x}
            y2={view.proj(T + m.innerW * 0.72, bottomY - 18, zSide + SLIDING_LOWER_TRACK_INSET_MM + SLIDING_LOWER_TRACK_DEPTH_MM).y}
          />
          <DimText
            x={
              view.proj(
                T + m.innerW * 0.72,
                bottomY - 18,
                zSide + SLIDING_LOWER_TRACK_INSET_MM + SLIDING_LOWER_TRACK_DEPTH_MM / 2,
              ).x
            }
            y={
              view.proj(
                T + m.innerW * 0.72,
                bottomY - 18,
                zSide + SLIDING_LOWER_TRACK_INSET_MM + SLIDING_LOWER_TRACK_DEPTH_MM / 2,
              ).y - small * 0.35
            }
            label={mm(SLIDING_LOWER_TRACK_DEPTH_MM)}
            fontSize={small}
          />
          <DimLine
            x1={view.proj(T + m.innerW * 0.55, bottomY - 8, zSide).x}
            y1={view.proj(T + m.innerW * 0.55, bottomY - 8, zSide).y}
            x2={view.proj(T + m.innerW * 0.55, bottomY - 8, zSide + SLIDING_LOWER_TRACK_INSET_MM).x}
            y2={view.proj(T + m.innerW * 0.55, bottomY - 8, zSide + SLIDING_LOWER_TRACK_INSET_MM).y}
          />
          <DimText
            x={view.proj(T + m.innerW * 0.55, bottomY - 8, zSide + SLIDING_LOWER_TRACK_INSET_MM / 2).x}
            y={view.proj(T + m.innerW * 0.55, bottomY - 8, zSide + SLIDING_LOWER_TRACK_INSET_MM / 2).y - small * 0.35}
            label={mm(SLIDING_LOWER_TRACK_INSET_MM)}
            fontSize={small}
          />
        </>
      )}

      {showFronts && !hideDoors &&
        slidingLeaves
          .slice()
          .sort((a, b) => (a.side === 'middle' ? 1 : 0) - (b.side === 'middle' ? 1 : 0))
          .map((leaf) => {
          const zDoor =
            leaf.side === 'middle' || (p.slidingEdges.length < 3 && leaf.side === 'right')
              ? zSide + SLIDING_LOWER_TRACK_INSET_MM
              : zSide + SLIDING_LOWER_TRACK_INSET_MM + 32
          const doorX = openDoors
            ? leaf.side === 'right'
              ? W + 36
              : leaf.side === 'left'
                ? -leaf.gabaritW - 36
                : T + leaf.x
            : T + leaf.x
          return (
            <g key={`slide-door-${leaf.index}`}>
              <Board
                x={doorX}
                y={bottomY - SLIDING_DOOR_BOTTOM_CLEAR_MM - leaf.gabaritH}
                z={zDoor}
                w={leaf.gabaritW}
                h={leaf.gabaritH}
                d={T}
                color={frontColor || FRONT_FILL}
                cam={view}
                faces={{ front: true, top: true, right: true }}
                opacity={0.88}
                pick={`door-slide-${leaf.index}`}
              />
              {(() => {
                const pick = `door-slide-${leaf.index}`
                const glass = doorMirror && mirrorCoversDoor(doorMirror, pick) ? mirrorGlass(leaf.cutW, leaf.cutH, doorMirror) : null
                if (!glass) return null
                const boardX = doorX + slidingProfileMm(leaf.edges.left)
                const boardY = bottomY - SLIDING_DOOR_BOTTOM_CLEAR_MM - leaf.cutH
                return (
                  <Board
                    x={boardX + glass.x}
                    y={boardY + glass.y}
                    z={zDoor - 6}
                    w={glass.width}
                    h={glass.height}
                    d={4}
                    color={MIRROR_GLASS_COLOR}
                    cam={view}
                    faces={{ front: true }}
                    mirrorGlass
                  />
                )
              })()}
              {(['left', 'right'] as const).map((edge) =>
                leaf.edges[edge] === 'handle' ? (
                  <Board
                    key={`${edge}-pull`}
                    x={edge === 'left' ? doorX : doorX + leaf.gabaritW - 18}
                    y={bottomY - SLIDING_DOOR_BOTTOM_CLEAR_MM - leaf.gabaritH}
                    z={zDoor - 8}
                    w={18}
                    h={leaf.gabaritH}
                    d={8}
                    color="#c5cad3"
                    cam={view}
                    faces={{ front: true, top: true, right: true }}
                  />
                ) : null,
              )}
            </g>
          )
        })}

      {showFronts && (
        <FrontsOnCabinet
          layout={layout}
          W={W}
          T={T}
          innerFloorY={innerFloorY}
          carcassTopY={m.sliding ? leftInnerY : frontTopY}
          carcassBotY={m.sliding ? bottomY : frontBotY}
          innerTopY={leftInnerY}
          innerBotY={bottomY}
          z={0}
          d={T}
          cam={view}
          clearanceBottom={m.sliding ? SLIDING_DRAWER_FROM_BOTTOM_MM : 0}
          insetFronts={m.sliding}
          innerDrawerFronts={p.innerDrawerFronts === true}
          pageFrontZ={m.sliding ? zPartition : zSide}
          shelfFrontZ={zShelfFront}
          insetFrontZ={m.sliding ? zPartition : undefined}
          innerDoors={p.innerDoors === true}
          layer="overlay"
          openDoors={openDoors}
          frontColor={frontColor}
          fontScale={fontScale}
          hangFromTop={kneeInner}
        />
      )}

      {marks && (
      <>
      <InteriorHeightDimLines
        layout={layout}
        innerFloorY={innerFloorY}
        T={T}
        fontSize={small}
        cam={view}
        originZ={m.sliding ? zShelfFront : zSide}
        shelfZ={m.sliding ? zShelfFront : zSide}
        railZ={zSide}
      />
      {(layout.partitions.length > 0 || doorWidthSpans.length > 0) && (
        <PartitionDimLines
          partitions={layout.partitions.map((part) =>
            m.sliding && p.slidingEdges.length >= 3
              ? {
                  ...part,
                  offsetMm: doorAlignedOpeningMm(part.startX, part.endX, part.offsetMm, m.innerW, T),
                }
              : part,
          )}
          leftovers={(showOpeningDims ? [...leftovers, ...openingWidths, ...doorWidthSpans] : [...leftovers, ...doorWidthSpans]).map(
            (part) =>
              m.sliding && p.slidingEdges.length >= 3
                ? {
                    ...part,
                    offsetMm: doorAlignedOpeningMm(part.startX, part.endX, part.offsetMm, m.innerW, T),
                  }
                : part,
          )}
          cam={view}
          innerLeft={T}
          insideY={widthInsideY}
          outsideY={widthOutsideY}
          ceilingWorldY={topY + T}
          anchorY={innerFloorY}
          belowAnchorY={floor}
          z={zPartition}
          leftoverZ={zSide}
          zAtX={widthZAtX}
          fontSize={small}
          obstacles={widthAvoid}
          shelves={shelfSeats(layout, T, innerFloorY, zShelfFront)}
        />
      )}
      {showOpeningDims && openingHeights.length > 0 && (
        <RemainingHeightDimLines
          spans={openingHeights}
          innerFloorY={innerFloorY}
          innerLeft={T}
          fontSize={small}
          cam={view}
          originZ={zSide}
        />
      )}

      {fascia && (() => {
        const zMirror = zSide + m.sideD
        const fasciaDrawn = Math.min(fascia.h, Math.max(T, m.sideH))
        const mirrorTop = view.proj(0, sideY - VANITY_MIRROR_BOARD_MM, zMirror)
        const mirrorBot = view.proj(0, sideY + fasciaDrawn, zMirror)
        const mirrorX = heightX - font * 0.85
        return (
          <g stroke={DRAW_DIM} fill={DRAW_DIM}>
            <DimLine x1={mirrorX} y1={mirrorTop.y} x2={mirrorX} y2={mirrorBot.y} />
            <DimText
              x={mirrorX - font * 0.7}
              y={(mirrorTop.y + mirrorBot.y) / 2}
              label={mm(VANITY_MIRROR_BOARD_MM + fasciaDrawn)}
              fontSize={font}
              rotate={-90}
              fill={DRAW_DIM}
            />
          </g>
        )
      })()}
      {!suppressOuter.height && <DimText x={heightX} y={heightY} label={mm(H)} fontSize={font} rotate={-90} />}
      {!suppressOuter.height && <WorldDim label={mm(H)} x0={-36} y0={topY} z0={0} x1={-36} y1={floor} z1={0} />}
      <DimText x={depthMx} y={depthMy} label={mm(D)} fontSize={font} rotate={depthRot} />
      <WorldDim label={mm(D)} x0={W + 36} y0={topY} z0={0} x1={W + 36} y1={topY} z1={D} />
      {!suppressOuter.width && <DimText x={backMx} y={backMy} label={mm(W)} fontSize={font} />}
      {!suppressOuter.width && <WorldDim label={mm(W)} x0={0} y0={topY - 110} z0={zSide} x1={W} y1={topY - 110} z1={zSide} />}
      <DimText x={sideDepthLabel.x + 10} y={sideDepthLabel.y} label={mm(m.sideD)} fontSize={small} rotate={depthRot} />
      <WorldDim
        label={mm(m.sideD)}
        x0={W + 16}
        y0={sideY + m.sideH * 0.4}
        z0={zSide}
        x1={W + 16}
        y1={sideY + m.sideH * 0.4}
        z1={zSide + m.sideD}
      />
      {partitionDepthDim && (
        <g stroke={DRAW_DIM} fill={DRAW_DIM}>
          <DimLine
            x1={partitionDepthDim.a.x}
            y1={partitionDepthDim.a.y}
            x2={partitionDepthDim.b.x}
            y2={partitionDepthDim.b.y}
          />
          <DimText
            x={partitionDepthDim.mid.x + 12}
            y={partitionDepthDim.mid.y}
            label={mm(m.partitionD)}
            fontSize={small}
            rotate={depthRot}
            fill={DRAW_DIM}
          />
          <WorldDim
            label={mm(m.partitionD)}
            x0={T + layout.partitions[layout.partitions.length - 1]!.xRight}
            y0={leftInnerY + Math.max(56, leftInnerH * 0.16)}
            z0={zPartition}
            x1={T + layout.partitions[layout.partitions.length - 1]!.xRight}
            y1={leftInnerY + Math.max(56, leftInnerH * 0.16)}
            z1={zPartition + m.partitionD}
          />
        </g>
      )}
      {!splitBottom && <DimText x={bottomLabelX} y={bottomFrontLabel.y} label={mm(m.bottomW)} fontSize={small} />}
      {!splitBottom && (
        <WorldDim
          label={mm(m.bottomW)}
          x0={T}
          y0={bottomY + T / 2}
          z0={zSide}
          x1={T + m.bottomW}
          y1={bottomY + T / 2}
          z1={zSide}
        />
      )}
      {kneeSpan && (
        <DimText
          x={view.proj(kneeSpan.x + kneeSpan.w / 2, (sideY + floor) / 2, zSide).x}
          y={view.proj(kneeSpan.x + kneeSpan.w / 2, (sideY + floor) / 2, zSide).y}
          label={`отвор ${mm(kneeSpan.w)}`}
          fontSize={small}
        />
      )}
      {kneeSpan && (
        <WorldDim
          label={`отвор ${mm(kneeSpan.w)}`}
          x0={kneeSpan.x}
          y0={(sideY + floor) / 2}
          z0={zSide}
          x1={kneeSpan.x + kneeSpan.w}
          y1={(sideY + floor) / 2}
          z1={zSide}
        />
      )}
      <g stroke={DRAW_DIM} fill={DRAW_DIM}>
        <line
          x1={supportLineX - supportTick}
          y1={floor - supportH}
          x2={supportLineX + supportTick}
          y2={floor - supportH}
          strokeWidth={2}
        />
        <line
          x1={supportLineX - supportTick}
          y1={floor}
          x2={supportLineX + supportTick}
          y2={floor}
          strokeWidth={2}
        />
        <DimLine x1={supportLineX} y1={floor - supportH} x2={supportLineX} y2={floor} />
        <DimText
          x={supportLabelX}
          y={supportLabelY}
          label={mm(supportH)}
          fontSize={supportFont}
          rotate={-90}
          fill={DRAW_DIM}
        />
        <WorldDim label={mm(supportH)} x0={-28} y0={floor - supportH} z0={legZ} x1={-28} y1={floor} z1={legZ} />
      </g>

      {showDimLines && (
        <g>
          {!suppressOuter.height && <DimLine x1={heightX + font * 0.22} y1={topY} x2={heightX + font * 0.22} y2={floor} />}
          <DimLine x1={depth.x1} y1={depth.y1} x2={depth.x2} y2={depth.y2} />
          {!suppressOuter.width && (
            <DimLine
              x1={coveredTop ? ox : ox + dx}
              y1={coveredTop ? backMy : topY + dy - font * 0.2}
              x2={coveredTop ? ox + W : ox + W + dx}
              y2={coveredTop ? backMy : topY + dy - font * 0.2}
            />
          )}
        </g>
      )}
      </>
      )}
    </SketchSvg>
    </PlacedSketch>
  )
}

