import { jsPDF } from 'jspdf'
import type { PackedSheet, PackingResult } from '@/types'
import {
  drawSheetToCanvas,
  formatDim,
  labelableWasteRects,
  visibleWasteRects,
  edgeLabelsSvgMarkup,
  wasteRectsSvgMarkup,
  grainFollowsWidth,
  type SheetGrain,
} from '@/lib/layout-drawing'

const PAGE_W = 297
const PAGE_H = 210
const MARGIN = 10

function sheetNumber(sheets: PackedSheet[], index: number): number {
  const name = sheets[index]?.boardName
  let n = 0
  for (let i = 0; i <= index; i++) {
    if (sheets[i]?.boardName === name) n++
  }
  return n
}

function sheetHeading(sheets: PackedSheet[], index: number): string {
  const sheet = sheets[index]!
  const color = sheet.boardName ? ` · ${sheet.boardName}` : ''
  return `Плоча ${sheetNumber(sheets, index)}${color}: ${sheet.sheetWidth} × ${sheet.sheetHeight} мм`
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('grain'))
    img.src = url
  })
}

export async function exportCuttingPlanPdf(
  result: PackingResult,
  grains?: (SheetGrain | null)[],
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const photos = await Promise.all(
    (grains ?? []).map(async (grain) => {
      if (!grain?.href) return grain ? { ...grain, image: null } : null
      try {
        const image = await loadImage(grain.href)
        return { ...grain, image }
      } catch {
        return { ...grain, image: null }
      }
    }),
  )

  for (let i = 0; i < result.sheets.length; i++) {
    if (i > 0) pdf.addPage()

    const sheet = result.sheets[i]
    const titleY = MARGIN

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(30, 41, 59)
    pdf.text(sheetHeading(result.sheets, i), MARGIN, titleY)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(100, 116, 139)
    pdf.text(
      `Фира: ${sheet.wastePercent.toFixed(1)}% · ${sheet.placed.length} детайла`,
      MARGIN,
      titleY + 5,
    )

    const availW = PAGE_W - MARGIN * 2
    const availH = PAGE_H - MARGIN * 2 - 12
    const scale = Math.min(availW / sheet.sheetWidth, availH / sheet.sheetHeight)
    const drawW = sheet.sheetWidth * scale
    const drawH = sheet.sheetHeight * scale
    const offsetX = MARGIN + (availW - drawW) / 2
    const offsetY = MARGIN + 12 + (availH - drawH) / 2

    const canvas = document.createElement('canvas')
    const pixelScale = 2
    canvas.width = drawW * pixelScale
    canvas.height = drawH * pixelScale
    const ctx = canvas.getContext('2d')!
    ctx.scale(pixelScale, pixelScale)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, drawW, drawH)

    const photo = photos[i]
    drawSheetToCanvas(
      ctx,
      sheet,
      0,
      0,
      scale,
      photo
        ? { image: photo.image, acrossMm: photo.acrossMm, alongMm: photo.alongMm, color: photo.color }
        : null,
    )

    const imgData = canvas.toDataURL('image/png')
    pdf.addImage(imgData, 'PNG', offsetX, offsetY, drawW, drawH)

    pdf.setFontSize(8)
    pdf.setTextColor(148, 163, 184)
    pdf.text('Размери в мм · Разрез: 3 мм', MARGIN, PAGE_H - MARGIN)
  }

  pdf.save(`sketchcut-razkroi-${Date.now()}.pdf`)
}

export function printCuttingPlan(result: PackingResult, grains?: (SheetGrain | null)[]): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const sheetsHtml = result.sheets
    .map((sheet, i) => {
      const scale = Math.min(700 / sheet.sheetWidth, 500 / sheet.sheetHeight, 0.22)
      const displayW = sheet.sheetWidth * scale
      const displayH = sheet.sheetHeight * scale

      const grain = grains?.[i]
      const wasteFill = grain ? 'rgba(255,255,255,0.62)' : '#f8fafc'
      const wasteRects = wasteRectsSvgMarkup(sheet.wasteRects, `waste-${i}`, wasteFill)

      const wasteLabels = visibleWasteRects(sheet.wasteRects)
        .map((r) => edgeLabelsSvgMarkup(r.x, r.y, r.width, r.height, '#475569'))
        .join('')

      const partFill = grain ? 'rgba(255,255,255,0.12)' : '#fff'
      const partText = '#1e293b'
      const parts = sheet.placed
        .map((p) => {
          return `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" fill="${partFill}" stroke="#1e293b" stroke-width="2"/>${edgeLabelsSvgMarkup(p.x, p.y, p.width, p.height, partText, !!grain)}`
        })
        .join('')
      const grainTurn = grain && grainFollowsWidth(sheet.sheetWidth, sheet.sheetHeight)
        ? ` transform="translate(${grain.alongMm} 0) rotate(90)"`
        : ''
      const grainImage = grain?.href
        ? `<image href="${grain.href}" x="0" y="0" width="${grain.acrossMm}" height="${grain.alongMm}" preserveAspectRatio="none"${grainTurn}/>`
        : ''

      const wasteSummary = labelableWasteRects(sheet.wasteRects)
        .map((r) => formatDim(r.width, r.height))
        .join(', ')

      return `
        <div class="sheet-page">
          <h2>${sheetHeading(result.sheets, i)}</h2>
          <p class="meta">Фира: ${sheet.wastePercent.toFixed(1)}% · ${sheet.placed.length} детайла</p>
          ${wasteSummary ? `<p class="meta">Фири: ${wasteSummary} мм</p>` : ''}
          <svg width="${displayW}" height="${displayH}" viewBox="0 0 ${sheet.sheetWidth} ${sheet.sheetHeight}">
            <rect width="${sheet.sheetWidth}" height="${sheet.sheetHeight}" fill="${grain?.color ?? '#fff'}"/>
            ${grainImage}
            ${wasteRects}
            ${wasteLabels}
            <rect width="${sheet.sheetWidth}" height="${sheet.sheetHeight}" fill="none" stroke="#1e293b" stroke-width="3"/>
            ${parts}
          </svg>
        </div>
      `
    })
    .join('')

  printWindow.document.write(`<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8"/>
  <title>SketchCut — Разкрой</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; color: #1e293b; background: #fff; }
    .sheet-page { page-break-after: always; padding: 20px; text-align: center; }
    .sheet-page:last-child { page-break-after: auto; }
    h2 { font-size: 16px; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
    svg { border: 1px solid #e2e8f0; margin: 0 auto; display: block; }
    @media print {
      .sheet-page { padding: 10mm; }
      @page { size: landscape; margin: 10mm; }
    }
  </style>
</head>
<body>${sheetsHtml}</body>
</html>`)
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
  }
}
