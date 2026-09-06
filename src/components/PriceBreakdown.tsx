import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatEur, type PriceBreakdown } from '@/lib/cabinets'
import { cn } from '@/lib/utils'

function money(value: number | null): string {
  if (value == null) return '—'
  return formatEur(value)
}

export function PriceBreakdownView({
  breakdown,
  className,
}: {
  breakdown: PriceBreakdown
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const compact = breakdown.sections.filter((s) => s.id !== 'cabinets')

  return (
    <div className={cn('rounded-md bg-secondary px-3 py-2 text-sm', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
          {compact.map((section) => {
            if (section.id !== 'labor' && (section.subtotalEur == null || section.subtotalEur <= 0)) return null
            return (
              <span key={section.id}>
                {section.title}: <strong>{money(section.subtotalEur)}</strong>
              </span>
            )
          })}
          <span>
            Обща цена: <strong>{formatEur(breakdown.totalEur)}</strong>
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {open ? 'Скрий информацията' : 'Повече информация'}
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-4">
          <Separator />
          {breakdown.sections.map((section) => (
            <section key={section.id} className="space-y-2">
              <h3 className="font-medium">{section.title}</h3>
              {section.intro && (
                <p className="text-xs text-muted-foreground">{section.intro}</p>
              )}
              <Table>
                <TableHeader>
                  <TableRow className="hover:[&>th]:bg-transparent">
                    <TableHead className="w-[38%]">Позиция</TableHead>
                    <TableHead>Бележка</TableHead>
                    <TableHead className="w-24 text-right">Сума</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.lines.map((line, i) => (
                    <TableRow key={`${section.id}-${i}`}>
                      <TableCell className="whitespace-normal font-medium">{line.label}</TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {line.hint ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{money(line.amountEur)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="hover:[&>td]:bg-transparent">
                    <TableCell colSpan={2}>Общо {section.title}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(section.subtotalEur)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
