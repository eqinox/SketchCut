import type { CabinetInstance, Part, PartEdgeBanding, Sheet } from '@/types'
import { generateId } from '@/lib/utils'
import {
  DEFAULT_CHIPBOARD_HEIGHT,
  DEFAULT_CHIPBOARD_PRICE_EUR,
  DEFAULT_CHIPBOARD_WIDTH,
  normalizeSheet,
} from '@/lib/cabinets/materials'

const DRAFT_KEY = 'sketchcut:draft'
const LAST_PROJECT_KEY = 'sketchcut:lastProjectId'

export interface DraftData {
  version: 1
  sheets: Sheet[]
  parts: Part[]
  edgeBanding: PartEdgeBanding[]
  cabinets: CabinetInstance[]
  dailyRateEur: number
  updatedAt: number
}

const DEFAULT_SHEET = (): Sheet => ({
  id: generateId(),
  width: DEFAULT_CHIPBOARD_WIDTH,
  height: DEFAULT_CHIPBOARD_HEIGHT,
  quantity: 1,
  kind: 'chipboard',
  priceEur: DEFAULT_CHIPBOARD_PRICE_EUR,
})

export function saveDraft(data: Omit<DraftData, 'version' | 'updatedAt'>): void {
  try {
    const draft: DraftData = {
      version: 1,
      ...data,
      updatedAt: Date.now(),
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // quota exceeded or private browsing — ignore
  }
}

export function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftData
    if (parsed.version !== 1) return null
    if (!Array.isArray(parsed.sheets) || !Array.isArray(parsed.parts)) return null
    return {
      ...parsed,
      sheets: parsed.sheets.map(normalizeSheet),
      edgeBanding: parsed.edgeBanding ?? [],
      cabinets: parsed.cabinets ?? [],
      dailyRateEur: parsed.dailyRateEur ?? 0,
    }
  } catch {
    return null
  }
}

/** Read draft once for initial React state (avoids race with auto-save). */
export function readInitialDraft(): {
  sheets: Sheet[]
  parts: Part[]
  edgeBanding: PartEdgeBanding[]
  cabinets: CabinetInstance[]
  dailyRateEur: number
} {
  const draft = loadDraft()
  if (!draft) {
    return { sheets: [DEFAULT_SHEET()], parts: [], edgeBanding: [], cabinets: [], dailyRateEur: 0 }
  }
  return {
    sheets: draft.sheets.length > 0 ? draft.sheets : [DEFAULT_SHEET()],
    parts: draft.parts,
    edgeBanding: draft.edgeBanding,
    cabinets: draft.cabinets ?? [],
    dailyRateEur: draft.dailyRateEur ?? 0,
  }
}

export function setLastProjectId(id: string): void {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, id)
  } catch {
    // ignore
  }
}

export function getLastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY)
  } catch {
    return null
  }
}
