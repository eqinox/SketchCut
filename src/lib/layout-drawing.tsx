import { useRef, useState } from 'react'
import type { PackedSheet, PlacedPart } from '@/types'
import { resolvePartPosition, type SnapGuide } from '@/lib/layout-edit'

export const HATCH_PATTERN_ID = 'waste-hatch'

/** Minimum side length (mm) to show a waste label */
const MIN_WASTE_LABEL_SIDE = 80

export function getPartLabelFontSize(width: number, height: number): number {
  const minDim = Math.min(width, height)
  return Math.max(36, Math.min(minDim * 0.14, 120))
}

/** Returns null if the waste pocket is too small for a readable label */
export function getWasteLabelFontSize(width: number, height: number): number | null {
  const minDim = Math.min(width, height)
  if (minDim < MIN_WASTE_LABEL_SIDE) return null
  return Math.max(44, Math.min(minDim * 0.16, 110))
}

export function formatDim(w: number, h: number): string {
  return `${Math.round(w)}×${Math.round(h)}`
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

/** SVG diagonal hatch for waste */
export function WasteHatchPattern() {
  return (
    <pattern
      id={HATCH_PATTERN_ID}
      patternUnits="userSpaceOnUse"
      width="16"
      height="16"
      patternTransform="rotate(45)"
    >
      <rect width="16" height="16" fill="#f1f5f9" />
      <line x1="0" y1="0" x2="0" y2="16" stroke="#94a3b8" strokeWidth="1.2" />
    </pattern>
  )
}

/** Each waste pocket with hatch fill + border (like parts) */
export function WasteRects({
  rects,
}: {
  rects: { x: number; y: number; width: number; height: number }[]
}) {
  return (
    <>
      {visibleWasteRects(rects).map((r, i) => (
        <rect
          key={`waste-rect-${i}`}
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          fill={`url(#${HATCH_PATTERN_ID})`}
          stroke="#64748b"
          strokeWidth={2}
        />
      ))}
    </>
  )
}

export function WasteLabels({
  rects,
}: {
  rects: { x: number; y: number; width: number; height: number }[]
}) {
  return (
    <>
      {labelableWasteRects(rects).map((r, i) => {
        const fontSize = getWasteLabelFontSize(r.width, r.height)!
        const cx = r.x + r.width / 2
        const cy = r.y + r.height / 2
        const narrow = r.width < r.height * 0.5

        return (
          <text
            key={`waste-label-${i}`}
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#475569"
            fontSize={fontSize}
            fontWeight="600"
            fontFamily="system-ui, sans-serif"
            transform={narrow ? `rotate(-90 ${cx} ${cy})` : undefined}
          >
            {formatDim(r.width, r.height)}
          </text>
        )
      })}
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
  const captureRef = useRef<Element | null>(null)
  const [dragging, setDragging] = useState<{
    partIndex: number
    offsetX: number
    offsetY: number
    originX: number
    originY: number
    x: number
    y: number
    valid: boolean
    snapped: boolean
    guides: SnapGuide[]
  } | null>(null)

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

  const resolveDrag = (partIndex: number, rawX: number, rawY: number) => {
    if (!sheetWidth || !sheetHeight) {
      return { x: rawX, y: rawY, valid: false, snapped: false, guides: [] as SnapGuide[] }
    }
    return resolvePartPosition(sheetWidth, sheetHeight, parts, partIndex, rawX, rawY)
  }

  const handlePointerDown = (e: React.PointerEvent, partIndex: number) => {
    if (!editable || !onPartMove || !sheetWidth || !sheetHeight) return
    e.preventDefault()
    e.stopPropagation()
    const part = parts[partIndex]
    const svgPt = clientToSvg(e.clientX, e.clientY)
    captureRef.current = e.currentTarget as Element
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    setDragging({
      partIndex,
      offsetX: svgPt.x - part.x,
      offsetY: svgPt.y - part.y,
      originX: part.x,
      originY: part.y,
      x: part.x,
      y: part.y,
      valid: true,
      snapped: false,
      guides: [],
    })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const svgPt = clientToSvg(e.clientX, e.clientY)
    const rawX = svgPt.x - dragging.offsetX
    const rawY = svgPt.y - dragging.offsetY
    const resolved = resolveDrag(dragging.partIndex, rawX, rawY)
    setDragging((prev) =>
      prev
        ? {
            ...prev,
            x: resolved.x,
            y: resolved.y,
            valid: resolved.valid,
            snapped: resolved.snapped,
            guides: resolved.guides,
          }
        : null,
    )
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging || !onPartMove) return
    if (dragging.valid) {
      onPartMove(dragging.partIndex, dragging.x, dragging.y)
    }
    setDragging(null)
    try {
      captureRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      // already released
    }
    captureRef.current = null
  }

  const dragIndex = dragging?.partIndex ?? -1

  return (
    <g
      ref={svgRef}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {dragging && sheetWidth && sheetHeight && (
        <SnapGuides guides={dragging.guides} sheetWidth={sheetWidth} sheetHeight={sheetHeight} />
      )}

      {parts.map((part, i) => {
        const isDragging = dragIndex === i
        const hiddenWhileDrag = dragIndex >= 0 && !isDragging
        const displayPart = isDragging ? { ...part, x: dragging!.x, y: dragging!.y } : part
        const label = formatDim(displayPart.width, displayPart.height)
        const fontSize = getPartLabelFontSize(displayPart.width, displayPart.height)
        const cx = displayPart.x + displayPart.width / 2
        const cy = displayPart.y + displayPart.height / 2
        const narrow = displayPart.width < displayPart.height * 0.45
        const invalid = isDragging && !dragging!.valid
        const snapped = isDragging && dragging!.snapped && dragging!.valid

        let strokeColor = stroke
        let fillColor = fill
        if (isDragging) {
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
            {isDragging && (
              <rect
                x={dragging!.originX}
                y={dragging!.originY}
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
              opacity={hiddenWhileDrag ? 0.35 : 1}
              onPointerDown={(e) => handlePointerDown(e, i)}
              style={{
                cursor: editable ? (isDragging ? 'grabbing' : 'grab') : undefined,
                touchAction: editable ? 'none' : undefined,
              }}
            >
              {isDragging && (
                <rect
                  x={displayPart.x + 4}
                  y={displayPart.y + 4}
                  width={displayPart.width}
                  height={displayPart.height}
                  fill="#00000018"
                  pointerEvents="none"
                />
              )}
              <rect
                x={displayPart.x}
                y={displayPart.y}
                width={displayPart.width}
                height={displayPart.height}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isDragging ? 4 : 2}
                rx={isDragging ? 2 : 0}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={textFill}
                fontSize={fontSize}
                fontWeight="600"
                fontFamily="system-ui, sans-serif"
                transform={narrow ? `rotate(-90 ${cx} ${cy})` : undefined}
                pointerEvents="none"
                opacity={isDragging ? 0.9 : 1}
              >
                {label}
              </text>
            </g>
          </g>
        )
      })}
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
  return (
    <svg
      width={displayWidth + 2}
      height={displayHeight + 2}
      viewBox={`0 0 ${sheet.sheetWidth} ${sheet.sheetHeight}`}
      className={className}
      style={{ width: displayWidth, height: displayHeight }}
    >
      <defs>
        <WasteHatchPattern />
      </defs>
      <rect x={0} y={0} width={sheet.sheetWidth} height={sheet.sheetHeight} fill="#ffffff" />
      <WasteRects rects={sheet.wasteRects} />
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
  spacing: number,
) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.fillStyle = '#f1f5f9'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 0.8
  for (let d = -h; d < w + h; d += spacing) {
    ctx.beginPath()
    ctx.moveTo(x + d, y)
    ctx.lineTo(x + d + h, y + h)
    ctx.stroke()
  }
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
    drawHatchInRect(ctx, rx, ry, rw, rh, 10)
    ctx.strokeStyle = '#64748b'
    ctx.lineWidth = 1.5
    ctx.strokeRect(rx, ry, rw, rh)

    const fontSize = getWasteLabelFontSize(r.width, r.height)
    if (fontSize !== null) {
      ctx.fillStyle = '#475569'
      ctx.font = `600 ${fontSize * scale}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(formatDim(r.width, r.height), rx + rw / 2, ry + rh / 2)
    }
  }

  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 2
  ctx.strokeRect(ox, oy, w, h)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

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

    const fontSize = getPartLabelFontSize(part.width, part.height) * scale
    ctx.fillStyle = '#1e293b'
    ctx.font = `600 ${Math.max(fontSize, 6)}px system-ui, sans-serif`
    ctx.fillText(formatDim(part.width, part.height), px + pw / 2, py + ph / 2)
  }
}
