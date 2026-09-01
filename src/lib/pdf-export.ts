import { jsPDF } from 'jspdf'
import type { PackingResult } from '@/types'
import {
  drawSheetToCanvas,
  formatDim,
  labelableWasteRects,
  visibleWasteRects,
  edgeLabelsSvgMarkup,
  wasteRectsSvgMarkup,
} from '@/lib/layout-drawing'

const PAGE_W = 297
const PAGE_H = 210
const MARGIN = 10

export async function exportCuttingPlanPdf(result: PackingResult, variantLabel: string): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  for (let i = 0; i < result.sheets.length; i++) {
    if (i > 0) pdf.addPage()

    const sheet = result.sheets[i]
    const titleY = MARGIN

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(30, 41, 59)
    pdf.text(`Плоча ${i + 1}: ${sheet.sheetWidth} × ${sheet.sheetHeight} мм`, MARGIN, titleY)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(100, 116, 139)
    pdf.text(
      `Фира: ${sheet.wastePercent.toFixed(1)}% · ${sheet.placed.length} детайла · ${variantLabel}`,
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

    drawSheetToCanvas(ctx, sheet, 0, 0, scale)

    const imgData = canvas.toDataURL('image/png')
    pdf.addImage(imgData, 'PNG', offsetX, offsetY, drawW, drawH)

    pdf.setFontSize(8)
    pdf.setTextColor(148, 163, 184)
    pdf.text('Размери в мм · Разрез: 3 мм', MARGIN, PAGE_H - MARGIN)
  }

  pdf.save(`sketchcut-razkroi-${Date.now()}.pdf`)
}

export function printCuttingPlan(result: PackingResult, variantLabel: string): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const sheetsHtml = result.sheets
    .map((sheet, i) => {
      const scale = Math.min(700 / sheet.sheetWidth, 500 / sheet.sheetHeight, 0.22)
      const displayW = sheet.sheetWidth * scale
      const displayH = sheet.sheetHeight * scale

      const wasteRects = wasteRectsSvgMarkup(sheet.wasteRects, `waste-${i}`)

      const wasteLabels = visibleWasteRects(sheet.wasteRects)
        .map((r) => edgeLabelsSvgMarkup(r.x, r.y, r.width, r.height, '#475569'))
        .join('')

      const parts = sheet.placed
        .map((p) => {
          return `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" fill="#fff" stroke="#1e293b" stroke-width="2"/>${edgeLabelsSvgMarkup(p.x, p.y, p.width, p.height, '#1e293b')}`
        })
        .join('')

      const wasteSummary = labelableWasteRects(sheet.wasteRects)
        .map((r) => formatDim(r.width, r.height))
        .join(', ')

      return `
        <div class="sheet-page">
          <h2>Плоча ${i + 1}: ${sheet.sheetWidth} × ${sheet.sheetHeight} мм</h2>
          <p class="meta">Фира: ${sheet.wastePercent.toFixed(1)}% · ${sheet.placed.length} детайла · ${variantLabel}</p>
          ${wasteSummary ? `<p class="meta">Фири: ${wasteSummary} мм</p>` : ''}
          <svg width="${displayW}" height="${displayH}" viewBox="0 0 ${sheet.sheetWidth} ${sheet.sheetHeight}">
            <rect width="${sheet.sheetWidth}" height="${sheet.sheetHeight}" fill="#fff"/>
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
