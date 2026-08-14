import { useRef, useState } from 'react'
import { GripVertical, Plus, RotateCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type { Part } from '@/types'
import { generateId } from '@/lib/utils'
import { reorderItems } from '@/lib/reorder'

interface PartsPanelProps {
  parts: Part[]
  onChange: (parts: Part[]) => void
}

export function PartsPanel({ parts, onChange }: PartsPanelProps) {
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [quantity, setQuantity] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const widthRef = useRef<HTMLInputElement>(null)
  const heightRef = useRef<HTMLInputElement>(null)
  const quantityRef = useRef<HTMLInputElement>(null)

  const allRotatable = parts.length > 0 && parts.every((p) => p.canRotate)

  const focusAndSelect = (ref: React.RefObject<HTMLInputElement | null>) => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.select()
  }

  const addPart = () => {
    const w = parseInt(width, 10)
    const h = parseInt(height, 10)
    const qRaw = quantity.trim()
    const q = qRaw === '' ? 1 : parseInt(qRaw, 10)
    if (!w || !h || w <= 0 || h <= 0 || !q || q <= 0) return

    onChange([
      ...parts,
      {
        id: generateId(),
        width: w,
        height: h,
        quantity: q,
        canRotate: false,
        label: `${w}×${h}`,
      },
    ])

    setQuantity('')
    focusAndSelect(widthRef)
  }

  const handleKeyDown = (e: React.KeyboardEvent, field: 'width' | 'height' | 'quantity') => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      if (field === 'width') focusAndSelect(heightRef)
      else if (field === 'height') focusAndSelect(quantityRef)
      else focusAndSelect(widthRef)
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      addPart()
    }
  }

  const toggleRotate = (id: string) => {
    onChange(parts.map((p) => (p.id === id ? { ...p, canRotate: !p.canRotate } : p)))
  }

  const toggleAllRotate = (checked: boolean) => {
    onChange(parts.map((p) => ({ ...p, canRotate: checked })))
  }

  const removePart = (id: string) => {
    onChange(parts.filter((p) => p.id !== id))
  }

  const updatePart = (id: string, field: 'width' | 'height' | 'quantity', value: number) => {
    if (value <= 0) return
    onChange(
      parts.map((p) => {
        if (p.id !== id) return p
        const updated = { ...p, [field]: value }
        if (field === 'width' || field === 'height') {
          updated.label = `${updated.width}×${updated.height}`
        }
        return updated
      }),
    )
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
    onChange(reorderItems(parts, dragIndex, index))
    setDragIndex(null)
    setDropIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDropIndex(null)
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div>
        <h2 className="text-lg font-semibold">Детайли</h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">Tab за смяна · Enter за добавяне · влачи за пренареждане</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label htmlFor="part-width">Ширина</Label>
          <Input
            id="part-width"
            ref={widthRef}
            type="number"
            inputMode="numeric"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => handleKeyDown(e, 'width')}
          />
        </div>
        <div>
          <Label htmlFor="part-height">Дължина</Label>
          <Input
            id="part-height"
            ref={heightRef}
            type="number"
            inputMode="numeric"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => handleKeyDown(e, 'height')}
          />
        </div>
        <div>
          <Label htmlFor="part-qty">Брой</Label>
          <Input
            id="part-qty"
            ref={quantityRef}
            type="number"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => handleKeyDown(e, 'quantity')}
          />
        </div>
      </div>

      <Button onClick={addPart} className="w-full">
        <Plus className="h-4 w-4" />
        Добави
      </Button>

      {parts.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2">
          <Checkbox
            id="rotate-all"
            checked={allRotatable}
            onCheckedChange={(c) => toggleAllRotate(c === true)}
          />
          <Label htmlFor="rotate-all" className="cursor-pointer text-sm">
            Въртене на всички детайли
          </Label>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {parts.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">Няма добавени детайли</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted-foreground)]">
                <th className="pb-2 w-6"></th>
                <th className="pb-2 pr-1">Ширина</th>
                <th className="pb-2 pr-1">Дължина</th>
                <th className="pb-2 pr-1">Брой</th>
                <th className="pb-2 pr-1">Върти</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {parts.map((part, index) => (
                <tr
                  key={part.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`border-b border-[var(--color-border)]/50 ${
                    dragIndex === index ? 'opacity-40' : ''
                  } ${dropIndex === index && dragIndex !== index ? 'border-t-2 border-t-[var(--color-primary)]' : ''}`}
                >
                  <td className="py-2 pr-1">
                    <GripVertical className="h-4 w-4 cursor-grab text-[var(--color-muted-foreground)] active:cursor-grabbing" />
                  </td>
                  <td className="py-2 pr-1">
                    <Input
                      type="number"
                      className="h-7 w-[4.5rem]"
                      value={part.width}
                      onChange={(e) => updatePart(part.id, 'width', parseInt(e.target.value, 10))}
                    />
                  </td>
                  <td className="py-2 pr-1">
                    <Input
                      type="number"
                      className="h-7 w-[4.5rem]"
                      value={part.height}
                      onChange={(e) => updatePart(part.id, 'height', parseInt(e.target.value, 10))}
                    />
                  </td>
                  <td className="py-2 pr-1">
                    <Input
                      type="number"
                      className="h-7 w-14"
                      value={part.quantity}
                      onChange={(e) => updatePart(part.id, 'quantity', parseInt(e.target.value, 10))}
                    />
                  </td>
                  <td className="py-2 pr-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-7 w-7"
                      onClick={() => toggleRotate(part.id)}
                      title={part.canRotate ? 'Може да се върти' : 'Без въртене'}
                    >
                      <RotateCw
                        className={`h-4 w-4 ${part.canRotate ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]'}`}
                      />
                      {!part.canRotate && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <span className="h-[2px] w-5 rotate-45 bg-[var(--color-destructive)]" />
                        </span>
                      )}
                    </Button>
                  </td>
                  <td className="py-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePart(part.id)}>
                      <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-[var(--color-muted-foreground)]">
        Общо: {parts.reduce((s, p) => s + p.quantity, 0)} бр.
      </p>
    </div>
  )
}
