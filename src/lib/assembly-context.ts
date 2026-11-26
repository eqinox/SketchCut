import { createContext } from 'react'
import type { AssemblyStep } from '@/lib/assembly-time'
import type { SlideKind } from '@/lib/settings'

/**
 * When set, the cabinet's 3D picture plays the assembly film instead of the plain model:
 * the cabinet's assembly steps and the day rate they are priced at (0 when not set).
 */
export const AssemblyFilmContext = createContext<{
  steps: AssemblyStep[]
  dailyRateEur: number
  /** Which drawer slides are drawn on the bench. */
  slideKind?: SlideKind
} | null>(null)
