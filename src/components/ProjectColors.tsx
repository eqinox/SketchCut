import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { KronospanColorGrid, KronospanFinishOptions } from '@/components/KronospanColors'
import type { BoardFinish } from '@/lib/board-finishes'
import { formatEur, type CabinetInstance } from '@/lib/cabinets'
import { kronospanBoardId, kronospanCodeFromFinish, resolveBoardFinish } from '@/lib/kronospan-color'
import { colorsInUse, PLAIN_BOARD, type ColorUse } from '@/lib/project-colors'

function cabinetsWord(n: number): string {
  return n === 1 ? '1 шкаф' : `${n} шкафа`
}

function usesText(use: ColorUse): string {
  const parts: string[] = []
  if (use.carcass > 0) parts.push(`корпус: ${cabinetsWord(use.carcass)}`)
  if (use.fronts > 0) parts.push(`врати и чела: ${cabinetsWord(use.fronts)}`)
  if (use.pieces > 0) parts.push(use.pieces === 1 ? '1 отделен детайл' : `${use.pieces} отделни детайла`)
  return parts.join(' · ')
}

/**
 * The colours the whole project is made of, numbered. Changing one puts the new colour on every
 * carcass, door and single piece that had the old one, and shows what that does to the price.
 */
export function ProjectColors({
  cabinets,
  finishes,
  priceEur,
  onSwap,
}: {
  cabinets: CabinetInstance[]
  finishes: BoardFinish[]
  priceEur: number | null
  onSwap: (from: string, to: string) => void
}) {
  const uses = colorsInUse(cabinets)
  const [open, setOpen] = useState<string | null>(null)
  // The price before the last change, so the difference can be read off.
  const [before, setBefore] = useState<number | null>(null)

  const swap = (from: string, to: string) => {
    if (from === to) return
    setBefore(priceEur)
    onSwap(from, to)
    setOpen(null)
  }

  if (uses.length === 0) {
    return <p className="text-xs text-[var(--color-muted-foreground)]">Още няма шкафове, затова няма и цветове.</p>
  }
  const diff = before != null && priceEur != null ? priceEur - before : null
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="rounded-md border border-[var(--color-border)] p-2">
        <div className="flex items-baseline justify-between gap-2">
          <span>Цена на проекта</span>
          <strong className="tabular-nums">{priceEur != null ? formatEur(priceEur) : '—'}</strong>
        </div>
        {diff != null && before != null && (
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Преди смяната: {formatEur(before)} ·{' '}
            <span className={diff > 0.005 ? 'text-red-600' : diff < -0.005 ? 'text-emerald-600' : ''}>
              {diff > 0.005 ? '+' : diff < -0.005 ? '−' : '±'}
              {formatEur(Math.abs(diff))}
            </span>
          </p>
        )}
      </div>
      <p className="text-xs text-[var(--color-muted-foreground)]">
        Смени един цвят и той се сменя навсякъде в проекта: в корпусите, вратите и отделните детайли, които са от него.
      </p>
      <ul className="flex flex-col gap-2">
        {uses.map((use, index) => {
          const finish = use.finishId ? resolveBoardFinish(finishes, use.finishId) : undefined
          const name = use.finishId === PLAIN_BOARD ? 'Обикновена плоча' : (finish?.name ?? use.finishId)
          const isOpen = open === use.finishId
          return (
            <li key={use.finishId || 'plain'} className="rounded-md border border-[var(--color-border)] p-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-8 w-8 shrink-0 overflow-hidden rounded border border-[var(--color-border)]"
                  style={{ background: finish?.color ?? '#c4a574' }}
                >
                  {finish?.image ? <img src={finish.image} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    Цвят {index + 1}: <span className="font-normal">{name}</span>
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">{usesText(use)}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isOpen ? 'default' : 'outline'}
                  aria-expanded={isOpen}
                  aria-label={`Смени цвят ${index + 1}`}
                  onClick={() => setOpen(isOpen ? null : use.finishId)}
                >
                  {isOpen ? 'Затвори' : 'Смени'}
                </Button>
              </div>
              {isOpen && (
                <div className="mt-2 flex flex-col gap-2">
                  <select
                    aria-label={`Нов цвят вместо цвят ${index + 1}`}
                    className="h-9 rounded-md border border-[var(--color-border)] bg-transparent px-2 text-sm"
                    value={use.finishId}
                    onChange={(event) => swap(use.finishId, event.target.value)}
                  >
                    <option value={PLAIN_BOARD}>Обикновена плоча</option>
                    <KronospanFinishOptions finishes={finishes} />
                  </select>
                  <div className="max-h-72 overflow-y-auto rounded border border-[var(--color-border)] p-1.5">
                    <KronospanColorGrid
                      finishes={finishes}
                      selectedCode={kronospanCodeFromFinish({ id: use.finishId })}
                      selectedId={use.finishId}
                      onPick={(board) => swap(use.finishId, kronospanBoardId(board))}
                    />
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
