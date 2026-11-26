import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { usePhoneFold } from '@/lib/phone-fold'

/** The section title: a button that folds the section. */
export function FoldTitle({
  fold,
  children,
  as = 'h2',
  className,
}: {
  fold: ReturnType<typeof usePhoneFold>
  children: ReactNode
  as?: 'h2' | 'h3'
  className?: string
}) {
  const Tag = as
  return (
    <Tag className={className ?? (as === 'h2' ? 'text-lg font-semibold' : 'text-base font-semibold')}>
      <button
        type="button"
        aria-expanded={fold.open}
        className="inline-flex items-center gap-1.5 text-left hover:opacity-80"
        onClick={fold.toggle}
      >
        {children}
        <ChevronDown
          aria-hidden
          className={`h-5 w-5 shrink-0 transition-transform ${fold.open ? '' : '-rotate-90'}`}
        />
      </button>
    </Tag>
  )
}
