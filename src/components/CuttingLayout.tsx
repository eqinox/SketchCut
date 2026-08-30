import { FileDown, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VariantPicker } from '@/components/VariantPicker'
import { SheetSvg, formatDim, labelableWasteRects } from '@/lib/layout-drawing'
import { updatePackingResultPart } from '@/lib/layout-edit'
import { exportCuttingPlanPdf, printCuttingPlan } from '@/lib/pdf-export'
import type { PackingResult } from '@/types'
import { useState } from 'react'

interface CuttingLayoutProps {
  result: PackingResult
  variantLabel: string
  title?: string
  variants?: { label: string; wastePercent: number }[]
  selectedVariantIndex?: number
  onVariantSelect?: (index: number) => void
  onResultChange?: (result: PackingResult) => void
}

export function CuttingLayout({
  result,
  variantLabel,
  title = 'Разкрой',
  variants,
  selectedVariantIndex = 0,
  onVariantSelect,
  onResultChange,
}: CuttingLayoutProps) {
  const [exporting, setExporting] = useState(false)
  const { sheets, totalWastePercent } = result

  if (sheets.length === 0) return null

  const handlePartMove = (sheetIdx: number, partIdx: number, x: number, y: number) => {
    if (!onResultChange) return
    const updated = updatePackingResultPart(result, sheetIdx, partIdx, x, y)
    if (updated) onResultChange(updated)
  }

  const handlePdf = async () => {
    setExporting(true)
    try {
      await exportCuttingPlanPdf(result, variantLabel)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[var(--color-secondary)] px-2 py-1 text-sm">
            Фира: <strong>{totalWastePercent.toFixed(1)}%</strong>
          </span>
          <span className="text-sm text-[var(--color-muted-foreground)]">{variantLabel}</span>
          <Button variant="outline" size="sm" onClick={() => printCuttingPlan(result, variantLabel)}>
            <Printer className="h-4 w-4" />
            Принтирай
          </Button>
          <Button variant="outline" size="sm" onClick={handlePdf} disabled={exporting}>
            <FileDown className="h-4 w-4" />
            {exporting ? 'Експорт...' : 'PDF'}
          </Button>
        </div>
      </div>

      {variants && variants.length > 1 && onVariantSelect && (
        <VariantPicker
          variants={variants}
          selectedIndex={selectedVariantIndex}
          onSelect={onVariantSelect}
        />
      )}

      <p className="text-xs text-[var(--color-muted-foreground)]">
        Задръж детайл, докато се маркира, после влачи — приближават се автоматично към разрез
        (±3 см) · разрез: 3 мм
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {sheets.map((sheet, sheetIdx) => {
          const scale = Math.min(600 / sheet.sheetWidth, 400 / sheet.sheetHeight, 0.25)
          const displayW = sheet.sheetWidth * scale
          const displayH = sheet.sheetHeight * scale

          return (
            <div
              key={`${sheet.sheetId}-${sheetIdx}`}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-medium">
                  Плоча {sheetIdx + 1}: {sheet.sheetWidth} × {sheet.sheetHeight} мм
                </span>
                <span className="text-[var(--color-muted-foreground)]">
                  Фира: {sheet.wastePercent.toFixed(1)}%
                </span>
              </div>

              <div className="overflow-x-auto rounded border border-[var(--color-border)] bg-white">
                <SheetSvg
                  sheet={sheet}
                  displayWidth={displayW}
                  displayHeight={displayH}
                  editable={!!onResultChange}
                  onPartMove={(partIdx, x, y) => handlePartMove(sheetIdx, partIdx, x, y)}
                />
              </div>

              <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
                {sheet.placed.length} детайла · Разрез: 3 мм
                {labelableWasteRects(sheet.wasteRects).length > 0 && (
                  <>
                    {' '}
                    · Фири:{' '}
                    {labelableWasteRects(sheet.wasteRects)
                      .map((r) => formatDim(r.width, r.height))
                      .join(', ')}{' '}
                    мм
                  </>
                )}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
