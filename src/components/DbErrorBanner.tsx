import { AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface DbErrorDetails {
  title: string
  message: string
  source?: string
}

interface DbErrorBannerProps {
  error: DbErrorDetails | null
  onDismiss: () => void
}

export function DbErrorBanner({ error, onDismiss }: DbErrorBannerProps) {
  if (!error) return null

  return (
    <div
      role="alert"
      className="border-b border-red-300 bg-red-50 px-4 py-3 text-red-950"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold">{error.title}</p>
          <p className="break-words text-sm">{error.message}</p>
          {error.source && (
            <p className="text-xs text-red-700/80">Източник: {error.source}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 text-red-700" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
