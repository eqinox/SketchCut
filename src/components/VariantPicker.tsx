import { cn } from '@/lib/utils'

interface VariantPickerProps {
  variants: { label: string; wastePercent: number }[]
  selectedIndex: number
  onSelect: (index: number) => void
}

export function VariantPicker({ variants, selectedIndex, onSelect }: VariantPickerProps) {
  if (variants.length <= 1) return null

  return (
    <div className="flex flex-wrap gap-2">
      {variants.map((v, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          className={cn(
            'rounded-md border px-3 py-1.5 text-sm transition-colors',
            i === selectedIndex
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]'
              : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-muted-foreground)] hover:border-[var(--color-primary)]/50',
          )}
        >
          {v.label}
          <span className="ml-1.5 text-xs opacity-80">({v.wastePercent.toFixed(1)}%)</span>
        </button>
      ))}
    </div>
  )
}
