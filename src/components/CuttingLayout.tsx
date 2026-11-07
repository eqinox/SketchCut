import { FileDown, Printer, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BoardFinish } from '@/lib/board-finishes'
import { decorSheetFor, type DecorSheet } from '@/lib/finish-photo'
import { SheetSvg, formatDim, labelableWasteRects, type SheetGrain } from '@/lib/layout-drawing'
import { updatePackingResultPart } from '@/lib/layout-edit'
import { exportCuttingPlanPdf, printCuttingPlan } from '@/lib/pdf-export'
import type { PackedSheet, PackingResult } from '@/types'
import { useEffect, useState } from 'react'

interface CuttingLayoutProps {
  result: PackingResult
  title?: string
  finishes?: BoardFinish[]
  onResultChange?: (result: PackingResult) => void
  onClear?: () => void
}

function finishOf(sheet: PackedSheet, finishes: BoardFinish[]): BoardFinish | undefined {
  if (sheet.finishId) return finishes.find((finish) => finish.id === sheet.finishId)
  if (sheet.boardName) return finishes.find((finish) => finish.name === sheet.boardName)
  return undefined
}

export function CuttingLayout({
  result,
  title = 'Разкрой',
  finishes = [],
  onResultChange,
  onClear,
}: CuttingLayoutProps) {
  const [exporting, setExporting] = useState(false)
  const [colored, setColored] = useState(false)
  const [sheetsReady, setSheetsReady] = useState<Record<string, DecorSheet>>({})
  const { sheets, totalWastePercent } = result

  useEffect(() => {
    if (!colored) return
    let cancel = false
    const urls = new Set<string>()
    for (const sheet of result.sheets) {
      const image = finishOf(sheet, finishes)?.image
      if (image) urls.add(image)
    }
    for (const url of urls) {
      void decorSheetFor(url).then((built) => {
        if (cancel) return
        setSheetsReady((prev) => (prev[url] ? prev : { ...prev, [url]: built }))
      })
    }
    return () => {
      cancel = true
    }
  }, [colored, finishes, result])

  const grainFor = (sheet: PackedSheet): SheetGrain | null => {
    if (!colored) return null
    const finish = finishOf(sheet, finishes)
    if (!finish) return null
    if (sheet.hasGrain === false) {
      return { href: undefined, acrossMm: 0, alongMm: 0, color: finish.color }
    }
    const built = finish.image ? sheetsReady[finish.image] : undefined
    return {
      href: built?.url,
      acrossMm: built?.acrossMm ?? 0,
      alongMm: built?.alongMm ?? 0,
      color: finish.color,
    }
  }

  const grains = sheets.map(grainFor)
  const coloredFinishes = colored
    ? sheets.map((sheet) => finishOf(sheet, finishes)).filter((finish): finish is BoardFinish => !!finish)
    : []

  if (sheets.length === 0) return null

  const groups: { name?: string; items: { sheet: PackedSheet; sheetIdx: number }[] }[] = []
  sheets.forEach((sheet, sheetIdx) => {
    const last = groups[groups.length - 1]
    if (last && last.name === sheet.boardName) last.items.push({ sheet, sheetIdx })
    else groups.push({ name: sheet.boardName, items: [{ sheet, sheetIdx }] })
  })
  const singleColor = groups.length === 1

  const handlePartMove = (sheetIdx: number, partIdx: number, x: number, y: number) => {
    if (!onResultChange) return
    const updated = updatePackingResultPart(result, sheetIdx, partIdx, x, y)
    if (updated) onResultChange(updated)
  }

  const handlePdf = async () => {
    setExporting(true)
    try {
      await exportCuttingPlanPdf(result, grains)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {title}
          {singleColor && groups[0]?.name ? ` · ${groups[0].name}` : ''}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[var(--color-secondary)] px-2 py-1 text-sm">
            Фира: <strong>{totalWastePercent.toFixed(1)}%</strong>
          </span>
          <Button
            variant={colored ? 'default' : 'outline'}
            size="sm"
            aria-pressed={colored}
            onClick={() => setColored((on) => !on)}
          >
            Цветен
          </Button>
          <Button variant="outline" size="sm" onClick={() => printCuttingPlan(result, grains)}>
            <Printer className="h-4 w-4" />
            Принтирай
          </Button>
          <Button variant="outline" size="sm" onClick={handlePdf} disabled={exporting}>
            <FileDown className="h-4 w-4" />
            {exporting ? 'Експорт...' : 'PDF'}
          </Button>
          {onClear && (
            <Button variant="outline" size="sm" onClick={onClear}>
              <Trash2 className="h-4 w-4" />
              Изчисти
            </Button>
          )}
        </div>
      </div>

      {colored && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {coloredFinishes.some((finish) => finish.image)
            ? 'Фладерът тече по дългата страна на плочата.'
            : 'Няма снимка на цвета — вижда се само боята, без посока на фладера.'}
          {coloredFinishes.some((finish) => finish.image) &&
            coloredFinishes.some((finish) => !finish.image) &&
            ' Цвят без снимка е само боя.'}
        </p>
      )}

      <p className="text-xs text-[var(--color-muted-foreground)]">
        Задръж детайл, докато се маркира, после влачи — приближават се автоматично към разрез
        (±3 см) · разрез: 3 мм
      </p>

      {groups.map((group) => {
        const area = group.items.reduce((sum, item) => sum + item.sheet.sheetWidth * item.sheet.sheetHeight, 0)
        const waste = group.items.reduce((sum, item) => sum + item.sheet.wasteArea, 0)
        const groupWaste = area > 0 ? (waste / area) * 100 : 0
        return (
          <section key={group.name ?? 'plain'} className="space-y-4">
            {!singleColor && (
              <h3 className="text-base font-semibold">
                {group.name ?? title}
                <span className="ml-2 text-sm font-normal text-[var(--color-muted-foreground)]">
                  Фира: {groupWaste.toFixed(1)}%
                </span>
              </h3>
            )}
            <div className="grid gap-6 lg:grid-cols-2">
              {group.items.map(({ sheet, sheetIdx }, index) => {
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
                        Плоча {index + 1}
                        {sheet.boardName ? ` · ${sheet.boardName}` : ''}: {sheet.sheetWidth} × {sheet.sheetHeight} мм
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
                        grain={grainFor(sheet)}
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
          </section>
        )
      })}
    </div>
  )
}
