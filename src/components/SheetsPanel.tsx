import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Sheet } from '@/types'
import { generateId } from '@/lib/utils'
import { reorderItems } from '@/lib/reorder'
import { useState } from 'react'

interface SheetsPanelProps {
  sheets: Sheet[]
  onChange: (sheets: Sheet[]) => void
}

export function SheetsPanel({ sheets, onChange }: SheetsPanelProps) {
  const [width, setWidth] = useState('2780')
  const [height, setHeight] = useState('2040')
  const [quantity, setQuantity] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const addSheet = () => {
    const w = parseInt(width, 10)
    const h = parseInt(height, 10)
    const qRaw = quantity.trim()
    const q = qRaw === '' ? 1 : parseInt(qRaw, 10)
    if (!w || !h || w <= 0 || h <= 0 || !q || q <= 0) return
    onChange([...sheets, { id: generateId(), width: w, height: h, quantity: q }])
    setQuantity('')
  }

  const removeSheet = (id: string) => {
    onChange(sheets.filter((s) => s.id !== id))
  }

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) return
    onChange(sheets.map((s) => (s.id === id ? { ...s, quantity: qty } : s)))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSheet()
    }
  }

  const handleDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDropIndex(index)
  }

  const handleDrop = (index: number) => {
    if (dragIndex === null) return
    onChange(reorderItems(sheets, dragIndex, index))
    setDragIndex(null)
    setDropIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDropIndex(null)
  }

  const totalAvailable = sheets.reduce((sum, s) => sum + s.quantity, 0)

  return (
    <div className="flex h-full flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div>
        <h2 className="text-lg font-semibold">Плочи</h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">Размери в мм · влачи за пренареждане</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label htmlFor="sheet-width">Ширина</Label>
          <Input
            id="sheet-width"
            type="number"
            inputMode="numeric"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div>
          <Label htmlFor="sheet-height">Дължина</Label>
          <Input
            id="sheet-height"
            type="number"
            inputMode="numeric"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div>
          <Label htmlFor="sheet-qty">Брой</Label>
          <Input
            id="sheet-qty"
            type="number"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <Button onClick={addSheet} className="w-full">
        <Plus className="h-4 w-4" />
        Добави плоча
      </Button>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {sheets.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">Няма добавени плочи</p>
        ) : (
          sheets.map((sheet, index) => (
            <div
              key={sheet.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 ${
                dragIndex === index ? 'opacity-40' : ''
              } ${dropIndex === index && dragIndex !== index ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[var(--color-muted-foreground)] active:cursor-grabbing" />
                <span className="text-sm font-medium">#{index + 1}</span>
                <span className="truncate text-sm text-[var(--color-muted-foreground)]">
                  {sheet.width} × {sheet.height} мм
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className="h-7 w-14"
                  value={sheet.quantity}
                  onChange={(e) => updateQuantity(sheet.id, parseInt(e.target.value, 10))}
                  title="Брой плочи"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeSheet(sheet.id)}>
                  <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-[var(--color-muted-foreground)]">
        Общо: {totalAvailable} плочи · Диск: 3 мм
      </p>
    </div>
  )
}
