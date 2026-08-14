import type { Part, PartEdgeBanding, Sheet } from '@/types'
import { generateId } from '@/lib/utils'

const DRAFT_KEY = 'sketchcut:draft'
const LAST_PROJECT_KEY = 'sketchcut:lastProjectId'

export interface DraftData {
  version: 1
  sheets: Sheet[]
  parts: Part[]
  edgeBanding: PartEdgeBanding[]
  updatedAt: number
}

const DEFAULT_SHEET = (): Sheet => ({
  id: generateId(),
  width: 2780,
  height: 2040,
  quantity: 1,
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
      sheets: parsed.sheets.map((s) => ({ ...s, quantity: s.quantity ?? 1 })),
      edgeBanding: parsed.edgeBanding ?? [],
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
} {
  const draft = loadDraft()
  if (!draft) {
    return { sheets: [DEFAULT_SHEET()], parts: [], edgeBanding: [] }
  }
  return {
    sheets: draft.sheets.length > 0 ? draft.sheets : [DEFAULT_SHEET()],
    parts: draft.parts,
    edgeBanding: draft.edgeBanding,
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
