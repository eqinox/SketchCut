import type { BoardFinish } from '@/lib/board-finishes'
import {
  KRONOSPAN_BOARDS,
  KRONOSPAN_GROUP_ORDER,
  defaultKronospanBoard,
  kronospanBoardId,
  kronospanBoardsFor,
  kronospanCodeFromFinish,
  kronospanColor,
  kronospanPriceLabel,
  type KronospanBoard,
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
      {swatch.image ? (
        <img src={swatch.image} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="block h-full w-full" style={{ background: swatch.color }} />
      )}
      {added ? (
        <span className="absolute right-0 bottom-0 bg-black/55 px-0.5 text-[9px] leading-none text-white">✓</span>
      ) : null}
    </button>
  )
}

function optionLabel(board: KronospanBoard): string {
  return `${board.code} ${board.name} · ${board.surfaceLabel} · ${kronospanPriceLabel(board.priceEur)}`
}

export function KronospanFinishOptions({ finishes }: { finishes: BoardFinish[] }) {
  const saved = new Set(finishes.map((finish) => finish.id))
  return (
    <>
      {finishes.map((finish) => (
        <option key={finish.id} value={finish.id}>
          {finish.name} · {kronospanPriceLabel(finish.sheetPriceEur)}
        </option>
      ))}
      {KRONOSPAN_GROUP_ORDER.map((group) => {
        const boards = KRONOSPAN_BOARDS.filter((board) => board.group === group && !saved.has(kronospanBoardId(board)))
        if (boards.length === 0) return null
        return (
          <optgroup key={group} label={group}>
            {boards.map((board) => (
              <option key={kronospanBoardId(board)} value={kronospanBoardId(board)}>
                {optionLabel(board)}
              </option>
            ))}
          </optgroup>
        )
      })}
    </>
  )
}

export function KronospanColorGrid({
  finishes,
  selectedCode,
  selectedId,
  note,
  onPick,
}: {
  finishes: BoardFinish[]
  selectedCode?: string | null
  selectedId?: string
  note?: string
  onPick: (board: KronospanBoard) => void
}) {
  const added = new Set(
    finishes.map((finish) => kronospanCodeFromFinish(finish)).filter((code): code is string => code != null),
  )
  const seen = new Set<string>()
  const swatches: KronospanBoard[] = []
  for (const board of KRONOSPAN_BOARDS) {
    if (seen.has(board.code)) continue
    if (!board.image) continue
    seen.add(board.code)
    swatches.push(board)
  }
  const surfaces = kronospanBoardsFor(selectedCode)
  return (
    <div>
      <p className="text-xs text-[var(--color-muted-foreground)]">
        Kronospan, плоча 2800×2070×18. Цената е за тази плоча. Повърхността е до името: шагре, гладко, офисна, пясъчна.
        {note ? ` ${note}` : ''}
      </p>
      {KRONOSPAN_GROUP_ORDER.map((group) => {
        const items = swatches.filter((swatch) => swatch.group === group)
        if (items.length === 0) return null
        return (
          <div key={group} className="mt-2">
            <p className="mb-1 text-xs font-medium">{group}</p>
            <div className="flex flex-wrap gap-1">
              {items.map((swatch) => (
                <SwatchButton
                  key={swatch.code}
                  swatch={swatch}
                  chosen={selectedCode === swatch.code}
                  added={added.has(swatch.code)}
                  onPick={() => onPick(defaultKronospanBoard(swatch.code) ?? swatch)}
                />
              ))}
            </div>
          </div>
        )
      })}
      {surfaces.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {surfaces.map((board) => {
            const id = kronospanBoardId(board)
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPick(board)}
                className={cn(
                  'rounded border border-[var(--color-border)] px-2 py-1 text-xs',
                  selectedId === id && 'ring-2 ring-[var(--color-foreground)]',
                )}
              >
                {board.surfaceLabel} · {kronospanPriceLabel(board.priceEur)}
              </button>
            )
          })}
        </div>
      ) : null}
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
