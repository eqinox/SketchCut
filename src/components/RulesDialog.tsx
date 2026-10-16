import { useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cabinetRuleSections } from '@/lib/cabinets/rules-catalog'

export function RulesDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const sections = useMemo(() => cabinetRuleSections(), [])
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? 'sliding')
  const current = sections.find((s) => s.id === sectionId) ?? sections[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Правила за сметката
          </DialogTitle>
          <DialogDescription>
            Така се режат детайлите и се брои обковът. Числата са същите, с които се смята шкафът. Цените и
            времената, които си променяш, са в Настройки.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1">
          {sections.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={s.id === current?.id ? 'default' : 'outline'}
              onClick={() => setSectionId(s.id)}
            >
              {s.title}
            </Button>
          ))}
        </div>
        {current && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {current.blocks.map((block) => (
              <section key={block.title}>
                <h3 className="text-sm font-medium">{block.title}</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted-foreground)]">
                  {block.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
