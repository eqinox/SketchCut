import {
  cabinetSizeExplainLines,
  cabinetSizeTierLabel,
  classifyCabinetSize,
  type AssemblyTimeSettings,
} from '@/lib/assembly-time'
import { cn } from '@/lib/utils'

export function CabinetSizeBadge({
  width,
  height,
  depth,
  settings,
  className,
  showInlineDetail = false,
}: {
  width: number
  height: number
  depth: number
  settings: AssemblyTimeSettings
  className?: string
  showInlineDetail?: boolean
}) {
  const dims = { width, height, depth }
  const classified = classifyCabinetSize(dims, settings)
  const label = cabinetSizeTierLabel(classified.tier)
  const lines = cabinetSizeExplainLines(dims, classified)
  const title = lines.join(' · ')

  return (
    <span className={cn('group/size relative inline-flex max-w-full shrink-0 items-center gap-2', className)}>
      <button
        type="button"
        title={title}
        aria-label={`Този шкаф се брои за ${label.toLowerCase()}. ${title}`}
        className="cursor-help rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-0.5 text-[11px] font-medium leading-none text-[var(--color-foreground)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      >
        {label}
      </button>
      {showInlineDetail ? (
        <span className="text-xs text-[var(--color-muted-foreground)]">{title}</span>
      ) : (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-max max-w-[18rem] rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1.5 text-left text-xs shadow-md group-hover/size:block group-focus-within/size:block"
        >
          <span className="font-medium">{label} шкаф</span>
          <span className="mt-1 block space-y-0.5 text-[var(--color-muted-foreground)]">
            {lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  )
}
