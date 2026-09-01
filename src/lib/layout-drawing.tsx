import { useEffect, useId, useRef, useState } from 'react'
import type { PackedSheet, PlacedPart } from '@/types'
import { resolvePartPosition, type SnapGuide } from '@/lib/layout-edit'

export const WASTE_HATCH_SPACING = 150
export const WASTE_HATCH_STROKE = 7
export const WASTE_HATCH_DASH = 30
export const WASTE_HATCH_GAP = 34
export const WASTE_HATCH_COLOR = '#cbd5e1'


/** Minimum side length (mm) to show a waste label */
const MIN_WASTE_LABEL_SIDE = 80

/** Returns null if the waste pocket is too small for a readable label */
export function getWasteLabelFontSize(width: number, height: number): number | null {
  const minDim = Math.min(width, height)
  if (minDim < MIN_WASTE_LABEL_SIDE) return null
  return Math.max(44, Math.min(minDim * 0.16, 110))
}

export function formatDim(w: number, h: number): string {
  return `${Math.round(w)}×${Math.round(h)}`
}

export type EdgeLabel = {
  x: number
  y: number
  text: string
  fontSize: number
  rotate: boolean
}

const MIN_EDGE_FONT = 12
const MAX_EDGE_FONT = 78
const CHAR_WIDTH = 0.62

function estimateTextLen(text: string, fontSize: number) {
  return text.length * fontSize * CHAR_WIDTH
}

function maxFontAlongSide(along: number, across: number, text: string) {
  if (along < 24 || across < 18) return 0
  const byAlong = (along * 0.82) / Math.max(text.length * CHAR_WIDTH, CHAR_WIDTH)
  const byAcross = across * 0.3
  const font = Math.min(MAX_EDGE_FONT, byAlong, byAcross)
  return font >= MIN_EDGE_FONT ? font : 0
}

function labelBoxes(
  width: number,
  height: number,
  wFont: number,
  hFont: number,
  wText: string,
  hText: string,
) {
  const wInset = wFont * 0.52
  const hInset = hFont * 0.52
  const wBox =
    wFont > 0
      ? {
          l: width / 2 - estimateTextLen(wText, wFont) / 2,
          r: width / 2 + estimateTextLen(wText, wFont) / 2,
          t: wInset - wFont / 2,
          b: wInset + wFont / 2,
        }
      : null
  const hBox =
    hFont > 0
      ? {
          l: hInset - hFont / 2,
          r: hInset + hFont / 2,
          t: height / 2 - estimateTextLen(hText, hFont) / 2,
          b: height / 2 + estimateTextLen(hText, hFont) / 2,
        }
      : null
  return { wBox, hBox }
}

function boxesOverlap(
  a: { l: number; r: number; t: number; b: number } | null,
  b: { l: number; r: number; t: number; b: number } | null,
  pad: number,
) {
  if (!a || !b) return false
  return a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad
}

/** Width on the top edge, length on the left edge. Font shrinks on small parts. */
export function getRectEdgeLabels(
  x: number,
  y: number,
  width: number,
  height: number,
): EdgeLabel[] {
  const wText = `${Math.round(width)}`
  const hText = `${Math.round(height)}`

  let wFont = maxFontAlongSide(width, height, wText)
  let hFont = maxFontAlongSide(height, width, hText)

  for (let i = 0; i < 14; i++) {
    const { wBox, hBox } = labelBoxes(width, height, wFont, hFont, wText, hText)
    const pad = Math.max(4, 0.18 * Math.max(wFont, hFont))
    if (!boxesOverlap(wBox, hBox, pad)) break
    if (wFont > 0) wFont = wFont * 0.84
    if (hFont > 0) hFont = hFont * 0.84
    if (wFont > 0 && wFont < MIN_EDGE_FONT) wFont = 0
    if (hFont > 0 && hFont < MIN_EDGE_FONT) hFont = 0
  }

  const { wBox, hBox } = labelBoxes(width, height, wFont, hFont, wText, hText)
  if (boxesOverlap(wBox, hBox, 3)) {
    if (width >= height) hFont = 0
    else wFont = 0
  }

  const labels: EdgeLabel[] = []
  if (wFont > 0) {
    labels.push({
      x: x + width / 2,
      y: y + wFont * 0.52,
      text: wText,
      fontSize: wFont,
      rotate: false,
    })
  }
  if (hFont > 0) {
    labels.push({
      x: x + hFont * 0.52,
      y: y + height / 2,
      text: hText,
      fontSize: hFont,
      rotate: true,
    })
  }

  return labels
}

export function EdgeDimensionLabels({
  x,
  y,
  width,
  height,
  fill,
  opacity = 1,
}: {
  x: number
  y: number
  width: number
  height: number
  fill: string
  opacity?: number
}) {
  return (
    <g pointerEvents="none" opacity={opacity}>
      {getRectEdgeLabels(x, y, width, height).map((label, i) => (
        <text
          key={i}
          x={label.x}
          y={label.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={fill}
          fontSize={label.fontSize}
          fontWeight="600"
          fontFamily="system-ui, sans-serif"
          transform={label.rotate ? `rotate(-90 ${label.x} ${label.y})` : undefined}
        >
          {label.text}
        </text>
      ))}
    </g>
  )
}

export function edgeLabelsSvgMarkup(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
): string {
  return getRectEdgeLabels(x, y, width, height)
    .map((label) => {
      const rot = label.rotate ? ` transform="rotate(-90 ${label.x} ${label.y})"` : ''
      return `<text x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="middle" font-size="${label.fontSize}" font-weight="600" fill="${fill}"${rot}>${label.text}</text>`
    })
    .join('')
}

export function drawEdgeDimensionLabels(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
  fill: string,
  offsetX = 0,
  offsetY = 0,
) {
  ctx.save()
  ctx.fillStyle = fill
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const label of getRectEdgeLabels(x, y, width, height)) {
    ctx.save()
    ctx.font = `600 ${Math.max(label.fontSize * scale, 5)}px system-ui, sans-serif`
    const lx = offsetX + label.x * scale
    const ly = offsetY + label.y * scale
    if (label.rotate) {
      ctx.translate(lx, ly)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(label.text, 0, 0)
    } else {
      ctx.fillText(label.text, lx, ly)
    }
    ctx.restore()
  }
  ctx.restore()
}

export function visibleWasteRects(
  rects: { x: number; y: number; width: number; height: number }[],
) {
  return rects.filter((r) => r.width >= 8 && r.height >= 8)
}

export function labelableWasteRects(
  rects: { x: number; y: number; width: number; height: number }[],
) {
  return visibleWasteRects(rects).filter(
    (r) => getWasteLabelFontSize(r.width, r.height) !== null,
  )
}

export function wasteHatchLineEnds(
  x: number,
  y: number,
  w: number,
  h: number,
): { x1: number; y1: number; x2: number; y2: number }[] {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (let d = 0; d < w + h; d += WASTE_HATCH_SPACING) {
    lines.push({ x1: x + d, y1: y, x2: x + d - h, y2: y + h })
  }
  return lines
}

/** Each waste pocket: light fill + dashed diagonals + border */
export function WasteRects({
  rects,
  idPrefix,
}: {
  rects: { x: number; y: number; width: number; height: number }[]
  idPrefix: string
}) {
  const pockets = visibleWasteRects(rects)
  return (
    <>
      <defs>
        {pockets.map((r, i) => (
          <clipPath key={`clip-${i}`} id={`${idPrefix}-clip-${i}`}>
            <rect x={r.x} y={r.y} width={r.width} height={r.height} />
          </clipPath>
        ))}
      </defs>
      {pockets.map((r, i) => {
        const clipId = `${idPrefix}-clip-${i}`
        return (
          <g key={`waste-rect-${i}`}>
            <rect
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill="#f8fafc"
            />
            <g clipPath={`url(#${clipId})`}>
              {wasteHatchLineEnds(r.x, r.y, r.width, r.height).map((l, li) => (
                <line
                  key={li}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke={WASTE_HATCH_COLOR}
                  strokeWidth={WASTE_HATCH_STROKE}
                  strokeDasharray={`${WASTE_HATCH_DASH} ${WASTE_HATCH_GAP}`}
                  strokeLinecap="butt"
                />
              ))}
            </g>
            <rect
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill="none"
              stroke="#64748b"
              strokeWidth={2}
            />
          </g>
        )
      })}
    </>
  )
}

export function wasteRectsSvgMarkup(
  rects: { x: number; y: number; width: number; height: number }[],
  idPrefix: string,
): string {
  const pockets = visibleWasteRects(rects)
  const clips = pockets
    .map(
      (r, j) =>
        `<clipPath id="${idPrefix}-c${j}"><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"/></clipPath>`,
    )
    .join('')
  const bodies = pockets
    .map((r, j) => {
      const clipId = `${idPrefix}-c${j}`
      const lines = wasteHatchLineEnds(r.x, r.y, r.width, r.height)
        .map(
          (l) =>
            `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${WASTE_HATCH_COLOR}" stroke-width="${WASTE_HATCH_STROKE}" stroke-dasharray="${WASTE_HATCH_DASH} ${WASTE_HATCH_GAP}" stroke-linecap="butt"/>`,
        )
        .join('')
      return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="#f8fafc"/><g clip-path="url(#${clipId})">${lines}</g><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="none" stroke="#64748b" stroke-width="2"/>`
    })
    .join('')
  return `<defs>${clips}</defs>${bodies}`
}

export function WasteLabels({
  rects,
}: {
  rects: { x: number; y: number; width: number; height: number }[]
}) {
  return (
    <>
      {visibleWasteRects(rects).map((r, i) => (
        <EdgeDimensionLabels
          key={`waste-label-${i}`}
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          fill="#475569"
        />
      ))}
    </>
  )
}

export function SnapGuides({
  guides,
  sheetWidth,
  sheetHeight,
}: {
  guides: SnapGuide[]
  sheetWidth: number
  sheetHeight: number
}) {
  if (guides.length === 0) return null
  return (
    <>
      {guides.map((g, i) =>
        g.orientation === 'vertical' ? (
          <line
            key={`vg-${i}`}
            x1={g.position}
            y1={0}
            x2={g.position}
            y2={sheetHeight}
            stroke="#22c55e"
            strokeWidth={3}
            strokeDasharray="12 8"
            opacity={0.85}
            pointerEvents="none"
          />
        ) : (
          <line
            key={`hg-${i}`}
            x1={0}
            y1={g.position}
            x2={sheetWidth}
            y2={g.position}
            stroke="#22c55e"
            strokeWidth={3}
            strokeDasharray="12 8"
            opacity={0.85}
            pointerEvents="none"
          />
        ),
      )}
    </>
  )
}

const HOLD_MS_TOUCH = 400
const HOLD_MS_MOUSE = 160
const TOUCH_CANCEL_PX = 14
const MOUSE_GRAB_PX = 5

type PartInteraction = {
  pointerId: number
  pointerType: string
  partIndex: number
  startClientX: number
  startClientY: number
  offsetX: number
  offsetY: number
  originX: number
  originY: number
  x: number
  y: number
  valid: boolean
  snapped: boolean
  guides: SnapGuide[]
  phase: 'holding' | 'dragging'
}

function isCoarsePointer(pointerType: string) {
  return pointerType === 'touch' || pointerType === 'pen'
}

function PartGrabBadge({
  x,
  y,
  width,
  height,
  sheetWidth,
  sheetHeight,
  text,
  accent,
}: {
  x: number
  y: number
  width: number
  height: number
  sheetWidth: number
  sheetHeight: number
  text: string
  accent: string
}) {
  const fontSize = Math.max(
    72,
    Math.min(200, Math.min(width * 0.2, height * 0.28, sheetWidth * 0.055)),
  )
  const padX = fontSize * 0.55
  const padY = fontSize * 0.32
  const textW = text.length * fontSize * 0.58
  const badgeW = textW + padX * 2
  const badgeH = fontSize + padY * 2
  const gap = fontSize * 0.25

  let bx = x + width / 2 - badgeW / 2
  let by = y - badgeH - gap
  if (by < 8) by = Math.min(y + gap, Math.max(8, sheetHeight - badgeH - 8))
  if (by + badgeH > sheetHeight - 8) by = Math.max(8, sheetHeight - badgeH - 8)
  bx = Math.max(8, Math.min(bx, sheetWidth - badgeW - 8))

  return (
    <g pointerEvents="none" className="sketchcut-grab-badge">
      <rect
        x={bx}
        y={by}
        width={badgeW}
        height={badgeH}
        rx={badgeH / 2}
        fill="#0f172a"
        opacity={0.92}
      />
      <rect
        x={bx}
        y={by}
        width={badgeW}
        height={badgeH}
        rx={badgeH / 2}
        fill="none"
        stroke={accent}
        strokeWidth={Math.max(4, fontSize * 0.06)}
      />
      <text
        x={bx + badgeW / 2}
        y={by + badgeH / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#ffffff"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {text}
      </text>
    </g>
  )
}

export function PlacedParts({
  parts,
  fill = '#ffffff',
  stroke = '#1e293b',
  textFill = '#1e293b',
  sheetWidth,
  sheetHeight,
  editable = false,
  onPartMove,
}: {
  parts: PlacedPart[]
  fill?: string
  stroke?: string
  textFill?: string
  sheetWidth?: number
  sheetHeight?: number
  editable?: boolean
  onPartMove?: (partIndex: number, x: number, y: number) => void
}) {
  const svgRef = useRef<SVGGElement>(null)
  const captureElRef = useRef<Element | null>(null)
  const timersRef = useRef<number[]>([])
  const preventScrollRef = useRef(false)
  const interactionRef = useRef<PartInteraction | null>(null)
  const partsRef = useRef(parts)
  const sheetSizeRef = useRef({ sheetWidth, sheetHeight })
  const onPartMoveRef = useRef(onPartMove)
  const shadowId = useId().replace(/:/g, '')
  const [interaction, setInteraction] = useState<PartInteraction | null>(null)

  partsRef.current = parts
  sheetSizeRef.current = { sheetWidth, sheetHeight }
  onPartMoveRef.current = onPartMove

  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current?.closest('svg')
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const svgPt = pt.matrixTransform(ctm.inverse())
    return { x: svgPt.x, y: svgPt.y }
  }

  const syncInteraction = (next: PartInteraction | null) => {
    interactionRef.current = next
    setInteraction(next)
  }

  const clearTimers = () => {
    for (const id of timersRef.current) window.clearTimeout(id)
    timersRef.current = []
  }

  const releaseCapture = (pointerId: number) => {
    try {
      captureElRef.current?.releasePointerCapture(pointerId)
    } catch {
      // already released
    }
    captureElRef.current = null
  }

  const activateGrab = () => {
    const cur = interactionRef.current
    if (!cur || cur.phase === 'dragging') return
    clearTimers()
    preventScrollRef.current = true
    try {
      captureElRef.current?.setPointerCapture(cur.pointerId)
    } catch {
      // capture not available
    }
    try {
      navigator.vibrate?.(12)
    } catch {
      // vibration not supported
    }
    syncInteraction({ ...cur, phase: 'dragging' })
  }

  const cancelInteraction = (pointerId?: number) => {
    const cur = interactionRef.current
    if (!cur) return
    if (pointerId != null && cur.pointerId !== pointerId) return
    clearTimers()
    preventScrollRef.current = false
    releaseCapture(cur.pointerId)
    syncInteraction(null)
  }

  const commitDrag = () => {
    const cur = interactionRef.current
    if (!cur) return
    const moved = cur.x !== cur.originX || cur.y !== cur.originY
    if (cur.phase === 'dragging' && cur.valid && moved) {
      onPartMoveRef.current?.(cur.partIndex, cur.x, cur.y)
    }
    cancelInteraction(cur.pointerId)
  }

  const handlePointerDown = (e: React.PointerEvent, partIndex: number) => {
    if (!editable || !onPartMove || !sheetWidth || !sheetHeight) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (interactionRef.current) return

    e.stopPropagation()
    if (e.pointerType === 'mouse') e.preventDefault()

    const part = parts[partIndex]
    const svgPt = clientToSvg(e.clientX, e.clientY)
    captureElRef.current = e.currentTarget as Element

    const next: PartInteraction = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      partIndex,
      startClientX: e.clientX,
      startClientY: e.clientY,
      offsetX: svgPt.x - part.x,
      offsetY: svgPt.y - part.y,
      originX: part.x,
      originY: part.y,
      x: part.x,
      y: part.y,
      valid: true,
      snapped: false,
      guides: [],
      phase: 'holding',
    }
    syncInteraction(next)

    const coarse = isCoarsePointer(e.pointerType)
    if (coarse) {
      timersRef.current.push(
        window.setTimeout(() => {
          const cur = interactionRef.current
          if (cur?.phase !== 'holding' || cur.pointerId !== next.pointerId) return
          preventScrollRef.current = true
          try {
            captureElRef.current?.setPointerCapture(cur.pointerId)
          } catch {
            // capture not available
          }
        }, 180),
      )
    }

    const holdMs = coarse ? HOLD_MS_TOUCH : HOLD_MS_MOUSE
    timersRef.current.push(
      window.setTimeout(() => {
        if (interactionRef.current?.pointerId === next.pointerId) activateGrab()
      }, holdMs),
    )
  }

  const isInteracting = interaction !== null

  useEffect(() => {
    if (!isInteracting) return

    const onMove = (e: PointerEvent) => {
      const cur = interactionRef.current
      if (!cur || e.pointerId !== cur.pointerId) return

      const dist = Math.hypot(e.clientX - cur.startClientX, e.clientY - cur.startClientY)

      if (cur.phase === 'holding') {
        if (isCoarsePointer(cur.pointerType)) {
          if (dist > TOUCH_CANCEL_PX) {
            if (preventScrollRef.current) activateGrab()
            else {
              cancelInteraction(cur.pointerId)
              return
            }
          } else {
            return
          }
        } else if (dist > MOUSE_GRAB_PX) {
          activateGrab()
        } else {
          return
        }
      }

      const active = interactionRef.current
      if (!active || active.phase !== 'dragging') return

      const { sheetWidth: w, sheetHeight: h } = sheetSizeRef.current
      if (!w || !h) return

      const svgPt = clientToSvg(e.clientX, e.clientY)
      const resolved = resolvePartPosition(
        w,
        h,
        partsRef.current,
        active.partIndex,
        svgPt.x - active.offsetX,
        svgPt.y - active.offsetY,
      )
      syncInteraction({
        ...active,
        x: resolved.x,
        y: resolved.y,
        valid: resolved.valid,
        snapped: resolved.snapped,
        guides: resolved.guides,
      })
    }

    const onUp = (e: PointerEvent) => {
      const cur = interactionRef.current
      if (!cur || e.pointerId !== cur.pointerId) return
      if (cur.phase === 'dragging') commitDrag()
      else cancelInteraction(cur.pointerId)
    }

    const onCancel = (e: PointerEvent) => {
      cancelInteraction(e.pointerId)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (preventScrollRef.current || interactionRef.current?.phase === 'dragging') {
        e.preventDefault()
      }
    }

    const onContextMenu = (e: Event) => e.preventDefault()

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('contextmenu', onContextMenu)

    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('contextmenu', onContextMenu)
    }
  }, [isInteracting])

  useEffect(() => {
    if (interaction?.phase !== 'dragging') return
    const svg = svgRef.current?.closest('svg')
    const parent = svg?.parentElement
    const prevOverflow = parent?.style.overflow
    const prevTouch = parent?.style.touchAction
    const prevSvgTouch = svg?.style.touchAction
    if (svg) svg.style.touchAction = 'none'
    if (parent) {
      parent.style.overflow = 'hidden'
      parent.style.touchAction = 'none'
    }
    document.body.style.overscrollBehavior = 'none'
    document.body.style.cursor = 'grabbing'
    return () => {
      if (svg) svg.style.touchAction = prevSvgTouch ?? ''
      if (parent) {
        parent.style.overflow = prevOverflow ?? ''
        parent.style.touchAction = prevTouch ?? ''
      }
      document.body.style.overscrollBehavior = ''
      document.body.style.cursor = ''
    }
  }, [interaction?.phase])

  useEffect(() => () => clearTimers(), [])

  const activeIndex = interaction?.partIndex ?? -1
  const isDragging = interaction?.phase === 'dragging'
  const isHolding = interaction?.phase === 'holding'

  return (
    <g ref={svgRef}>
      <defs>
        <filter id={`part-drag-shadow-${shadowId}`} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="10" dy="16" stdDeviation="14" floodColor="#0f172a" floodOpacity="0.4" />
        </filter>
      </defs>

      {isDragging && sheetWidth && sheetHeight && (
        <SnapGuides guides={interaction.guides} sheetWidth={sheetWidth} sheetHeight={sheetHeight} />
      )}

      {parts.map((part, i) => {
        const isActive = activeIndex === i
        const faded = activeIndex >= 0 && !isActive
        const displayPart =
          isActive && isDragging ? { ...part, x: interaction.x, y: interaction.y } : part
        const invalid = isActive && isDragging && !interaction.valid
        const snapped = isActive && isDragging && interaction.snapped && interaction.valid

        let strokeColor = stroke
        let fillColor = fill
        if (isActive) {
          if (invalid) {
            strokeColor = '#dc2626'
            fillColor = '#fef2f2'
          } else if (snapped) {
            strokeColor = '#16a34a'
            fillColor = '#f0fdf4'
          } else {
            strokeColor = '#2563eb'
            fillColor = '#eff6ff'
          }
        }

        return (
          <g key={`${part.partId}-${i}`}>
            {isActive && isDragging && (
              <rect
                x={interaction.originX}
                y={interaction.originY}
                width={part.width}
                height={part.height}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="10 6"
                opacity={0.6}
                pointerEvents="none"
              />
            )}

            <g
              opacity={faded ? 0.35 : 1}
              onPointerDown={(e) => handlePointerDown(e, i)}
              style={{
                cursor: editable ? (isDragging && isActive ? 'grabbing' : 'grab') : undefined,
                touchAction: editable ? (isActive ? 'none' : 'manipulation') : undefined,
                userSelect: editable ? 'none' : undefined,
              }}
            >
              {isActive && isDragging && (
                <rect
                  x={displayPart.x + 6}
                  y={displayPart.y + 8}
                  width={displayPart.width}
                  height={displayPart.height}
                  fill="#00000022"
                  rx={4}
                  pointerEvents="none"
                />
              )}
              <rect
                className={isActive && isHolding ? 'sketchcut-part-holding' : undefined}
                x={displayPart.x}
                y={displayPart.y}
                width={displayPart.width}
                height={displayPart.height}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isActive ? 6 : 2}
                rx={isActive ? 4 : 0}
                filter={
                  isActive && isDragging ? `url(#part-drag-shadow-${shadowId})` : undefined
                }
              />
              <EdgeDimensionLabels
                x={displayPart.x}
                y={displayPart.y}
                width={displayPart.width}
                height={displayPart.height}
                fill={textFill}
                opacity={isActive ? 0.9 : 1}
              />
            </g>
          </g>
        )
      })}

      {interaction && sheetWidth && sheetHeight && parts[interaction.partIndex] && (
        <PartGrabBadge
          x={isDragging ? interaction.x : interaction.originX}
          y={isDragging ? interaction.y : interaction.originY}
          width={parts[interaction.partIndex].width}
          height={parts[interaction.partIndex].height}
          sheetWidth={sheetWidth}
          sheetHeight={sheetHeight}
          text="Задръж и влачи"
          accent={
            isDragging && !interaction.valid
              ? '#dc2626'
              : isDragging && interaction.snapped
                ? '#16a34a'
                : '#3b82f6'
          }
        />
      )}
    </g>
  )
}

export function SheetSvg({
  sheet,
  displayWidth,
  displayHeight,
  className,
  editable = false,
  onPartMove,
}: {
  sheet: PackedSheet
  displayWidth: number
  displayHeight: number
  className?: string
  editable?: boolean
  onPartMove?: (partIndex: number, x: number, y: number) => void
}) {
  const hatchId = `wh${useId().replace(/:/g, '')}`
  return (
    <svg
      width={displayWidth + 2}
      height={displayHeight + 2}
      viewBox={`0 0 ${sheet.sheetWidth} ${sheet.sheetHeight}`}
      className={[className, editable ? 'sketchcut-sheet-editable' : null].filter(Boolean).join(' ')}
      onContextMenu={editable ? (e) => e.preventDefault() : undefined}
      style={{ width: displayWidth, height: displayHeight }}
    >
      <rect x={0} y={0} width={sheet.sheetWidth} height={sheet.sheetHeight} fill="#ffffff" />
      <WasteRects rects={sheet.wasteRects} idPrefix={hatchId} />
      <WasteLabels rects={sheet.wasteRects} />
      <rect
        x={0}
        y={0}
        width={sheet.sheetWidth}
        height={sheet.sheetHeight}
        fill="none"
        stroke="#1e293b"
        strokeWidth={3}
      />
      <PlacedParts
        parts={sheet.placed}
        sheetWidth={sheet.sheetWidth}
        sheetHeight={sheet.sheetHeight}
        editable={editable}
        onPartMove={onPartMove}
      />
    </svg>
  )
}

export function drawHatchInRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number,
) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = WASTE_HATCH_COLOR
  ctx.lineWidth = Math.max(0.4, WASTE_HATCH_STROKE * scale)
  ctx.setLineDash([WASTE_HATCH_DASH * scale, WASTE_HATCH_GAP * scale])
  ctx.lineCap = 'butt'
  const spacing = WASTE_HATCH_SPACING * scale
  for (let d = 0; d < w + h; d += spacing) {
    ctx.beginPath()
    ctx.moveTo(x + d, y)
    ctx.lineTo(x + d - h, y + h)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.restore()
}

export function drawSheetToCanvas(
  ctx: CanvasRenderingContext2D,
  sheet: PackedSheet,
  offsetX: number,
  offsetY: number,
  scale: number,
) {
  const w = sheet.sheetWidth * scale
  const h = sheet.sheetHeight * scale
  const ox = offsetX
  const oy = offsetY

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(ox, oy, w, h)

  for (const r of visibleWasteRects(sheet.wasteRects)) {
    const rx = ox + r.x * scale
    const ry = oy + r.y * scale
    const rw = r.width * scale
    const rh = r.height * scale
    drawHatchInRect(ctx, rx, ry, rw, rh, scale)
    ctx.strokeStyle = '#64748b'
    ctx.lineWidth = 1.5
    ctx.strokeRect(rx, ry, rw, rh)
    drawEdgeDimensionLabels(ctx, r.x, r.y, r.width, r.height, scale, '#475569', ox, oy)
  }

  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 2
  ctx.strokeRect(ox, oy, w, h)

  for (const part of sheet.placed) {
    const px = ox + part.x * scale
    const py = oy + part.y * scale
    const pw = part.width * scale
    const ph = part.height * scale

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(px, py, pw, ph)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1.5
    ctx.strokeRect(px, py, pw, ph)
    drawEdgeDimensionLabels(ctx, part.x, part.y, part.width, part.height, scale, '#1e293b', ox, oy)
  }
}
