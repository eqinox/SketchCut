import type { BoardFinish } from '@/lib/board-finishes'
import {
  KRONOSPAN_COLOR_COLLECTION,
  kronospanCodeFromFinish,
  kronospanColor,
  kronospanFinishId,
  type KronospanSwatch,
} from '@/lib/kronospan-color'
import { cn } from '@/lib/utils'

function SwatchButton({
  swatch,
  chosen,
  added,
  onPick,
}: {
  swatch: KronospanSwatch
  chosen?: boolean
  added?: boolean
  onPick: (swatch: KronospanSwatch) => void
}) {
  return (
    <button
      type="button"
      title={`${swatch.code} ${swatch.name}`}
      aria-label={`${swatch.code} ${swatch.name}`}
      onClick={() => onPick(swatch)}
      className={cn(
        'relative h-9 w-9 overflow-hidden rounded border border-[var(--color-border)]',
        chosen && 'ring-2 ring-[var(--color-foreground)]',
      )}
    >
      <img src={swatch.image} alt="" className="h-full w-full object-cover" />
      {added ? (
        <span className="absolute right-0 bottom-0 bg-black/55 px-0.5 text-[9px] leading-none text-white">✓</span>
      ) : null}
    </button>
  )
}

export function KronospanFinishOptions({ finishes }: { finishes: BoardFinish[] }) {
  const saved = new Set(finishes.map((finish) => finish.id))
  const rest = KRONOSPAN_COLOR_COLLECTION.filter((color) => !saved.has(kronospanFinishId(color.code)))
  return (
    <>
      {finishes.map((finish) => (
        <option key={finish.id} value={finish.id}>
          {finish.name} · {finish.sheetPriceEur} €
        </option>
      ))}
      {rest.length > 0 ? (
        <optgroup label="Kronospan Color">
          {rest.map((swatch) => (
            <option key={swatch.code} value={kronospanFinishId(swatch.code)}>
              {swatch.code} {swatch.name} · 0 €
            </option>
          ))}
        </optgroup>
      ) : null}
    </>
  )
}

export function KronospanColorGrid({
  finishes,
  selectedCode,
  note,
  onPick,
}: {
  finishes: BoardFinish[]
  selectedCode?: string | null
  note?: string
  onPick: (swatch: KronospanSwatch) => void
}) {
  const added = new Set(
    finishes.map((finish) => kronospanCodeFromFinish(finish)).filter((code): code is string => code != null),
  )
  return (
    <div>
      <p className="text-xs text-[var(--color-muted-foreground)]">
        Kronospan Color. Натисни цвят, за да го добавиш. Цената е 0, докато не я напишеш.
        {note ? ` ${note}` : ''}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {KRONOSPAN_COLOR_COLLECTION.map((swatch) => (
          <SwatchButton
            key={swatch.code}
            swatch={swatch}
            chosen={selectedCode === swatch.code}
            added={added.has(swatch.code)}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  )
}

export function KronospanCombinationRow({
  code,
  hint,
  onPick,
}: {
  code: string | null
  hint?: string
  onPick: (swatch: KronospanSwatch) => void
}) {
  const color = kronospanColor(code)
  if (!color || color.combinations.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-[var(--color-muted-foreground)]">
        Върви с{hint ? `. ${hint}` : ''}
      </span>
      {color.combinations.map((swatch) => (
        <SwatchButton key={swatch.code} swatch={swatch} onPick={onPick} />
      ))}
    </div>
  )
}
