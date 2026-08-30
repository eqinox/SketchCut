import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { Sparkles, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SheetsPanel } from '@/components/SheetsPanel'
import { PartsPanel } from '@/components/PartsPanel'
import { CuttingLayout } from '@/components/CuttingLayout'
import { EdgeBandingDialog } from '@/components/EdgeBandingDialog'
import { AuthDialog, HeaderActions, ProjectDialog } from '@/components/AuthDialog'
import { CabinetsPanel } from '@/components/CabinetsPanel'
import { optimizeAllVariants, type PackingVariantOption } from '@/lib/packing/optimizer'
import { syncEdgeBanding } from '@/lib/edge-banding'
import {
  addCabinetAndLabel,
  removeCabinetAndLabel,
  updateCabinetAndLabel,
  createHardboardSheet,
  firstSheetOfKind,
  parseKitchenBaseParams,
  partKind,
  sheetKind,
  normalizeSheet,
} from '@/lib/cabinets'
import { subscribeAuth, saveProject, loadProjects, getFirebaseInitError } from '@/lib/firebase'
import { saveDraft, readInitialDraft, setLastProjectId } from '@/lib/draft-storage'
import { generateId } from '@/lib/utils'
import { formatFirebaseError } from '@/lib/firebase-errors'
import { getMissingClientEnvKeys } from '@/lib/env'
import { DbErrorBanner, type DbErrorDetails } from '@/components/DbErrorBanner'
import type { CabinetInstance, Part, PartEdgeBanding, PackingResult, SavedProject, Sheet } from '@/types'

const initialDraft = readInitialDraft()

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [sheets, setSheets] = useState<Sheet[]>(initialDraft.sheets)
  const [parts, setParts] = useState<Part[]>(initialDraft.parts)
  const [edgeBanding, setEdgeBanding] = useState<PartEdgeBanding[]>(initialDraft.edgeBanding)
  const [cabinets, setCabinets] = useState<CabinetInstance[]>(initialDraft.cabinets)
  const [dailyRateEur, setDailyRateEur] = useState(initialDraft.dailyRateEur)
  const [packingVariants, setPackingVariants] = useState<PackingVariantOption[]>([])
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0)
  const [packingResult, setPackingResult] = useState<PackingResult | null>(null)
  const [hardboardVariants, setHardboardVariants] = useState<PackingVariantOption[]>([])
  const [hardboardVariantIndex, setHardboardVariantIndex] = useState(0)
  const [hardboardResult, setHardboardResult] = useState<PackingResult | null>(null)
  const saveReadyRef = useRef(false)

  const [authOpen, setAuthOpen] = useState(false)
  const [edgeOpen, setEdgeOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [projectMode, setProjectMode] = useState<'save' | 'load'>('save')
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])
  const [dbError, setDbError] = useState<DbErrorDetails | null>(null)

  const showDbError = useCallback((title: string, message: string, source?: string) => {
    setDbError({ title, message, source })
  }, [])

  const applyProjectData = useCallback((project: SavedProject) => {
    setSheets(project.sheets.map(normalizeSheet))
    setParts(project.parts)
    setEdgeBanding(project.edgeBanding)
    setCabinets(project.cabinets ?? [])
    setDailyRateEur(project.dailyRateEur ?? 0)
    setPackingResult(null)
    setPackingVariants([])
    setSelectedVariantIndex(0)
    setHardboardResult(null)
    setHardboardVariants([])
    setHardboardVariantIndex(0)
  }, [])

  useEffect(() => {
    return subscribeAuth(setUser)
  }, [])

  useEffect(() => {
    const initError = getFirebaseInitError()
    if (initError) {
      showDbError('Firebase не е конфигуриран', initError, 'инициализация')
      return
    }

    const missing = getMissingClientEnvKeys()
    if (missing.length > 0) {
      showDbError(
        'Липсват environment variables',
        missing.join(', '),
        '.env.local',
      )
    }
  }, [showDbError])

  useEffect(() => {
    if (!import.meta.env.DEV) return

    fetch('/api/firebase/status')
      .then((r) => r.json())
      .then((data: {
        client: { ok: boolean; missing: string[] }
        admin: { ok: boolean; error?: string; missing?: string[] }
      }) => {
        if (!data.client.ok) {
          showDbError(
            'Firebase клиент — липсващи променливи',
            data.client.missing.join(', '),
            'VITE_* в .env.local',
          )
        }
        if (!data.admin.ok) {
          const msg =
            data.admin.missing?.length
              ? `Липсват: ${data.admin.missing.join(', ')}`
              : (data.admin.error ?? 'Admin SDK не се свърза')
          showDbError('Firebase Admin / база данни', msg, 'FIREBASE_* в .env.local')
        }
      })
      .catch((e) => {
        showDbError(
          'Неуспешна проверка на Firebase',
          e instanceof Error ? e.message : String(e),
          '/api/firebase/status',
        )
      })
  }, [showDbError])

  // Enable auto-save only after mount so we never overwrite draft with stale initial state
  useEffect(() => {
    saveReadyRef.current = true
  }, [])

  useEffect(() => {
    setEdgeBanding((prev) => syncEdgeBanding(parts, prev))
  }, [parts])

  useEffect(() => {
    if (!saveReadyRef.current) return
    saveDraft({ sheets, parts, edgeBanding, cabinets, dailyRateEur })
  }, [sheets, parts, edgeBanding, cabinets, dailyRateEur])

  const loadUserProjects = useCallback(async () => {
    if (!user) return
    try {
      const projects = await loadProjects(user.uid)
      setSavedProjects(projects)
      setDbError(null)
      return projects
    } catch (e) {
      showDbError('Грешка при зареждане от Firestore', formatFirebaseError(e), 'loadProjects')
      throw e
    }
  }, [user, showDbError])

  useEffect(() => {
    if (!user) return
    loadUserProjects().catch(() => {})
  }, [user, loadUserProjects])

  const handleGenerate = () => {
    if (parts.length === 0) return
    const chipboardParts = parts.filter((p) => partKind(p) === 'chipboard')
    const hardboardParts = parts.filter((p) => partKind(p) === 'hardboard')
    const chipboardSheets = sheets.filter((s) => sheetKind(s) === 'chipboard')
    const hardboardSheets = sheets.filter((s) => sheetKind(s) === 'hardboard')

    if (chipboardParts.length > 0) {
      const variants = optimizeAllVariants(chipboardSheets, chipboardParts)
      setPackingVariants(variants)
      setSelectedVariantIndex(0)
      setPackingResult(variants[0]?.result ?? null)
    } else {
      setPackingVariants([])
      setPackingResult(null)
    }

    if (hardboardParts.length > 0) {
      const variants = optimizeAllVariants(hardboardSheets, hardboardParts)
      setHardboardVariants(variants)
      setHardboardVariantIndex(0)
      setHardboardResult(variants[0]?.result ?? null)
    } else {
      setHardboardVariants([])
      setHardboardResult(null)
    }
  }

  const handleVariantSelect = (index: number) => {
    setSelectedVariantIndex(index)
    setPackingResult(packingVariants[index]?.result ?? null)
  }

  const handleHardboardVariantSelect = (index: number) => {
    setHardboardVariantIndex(index)
    setHardboardResult(hardboardVariants[index]?.result ?? null)
  }

  const handleHardboardLayoutChange = useCallback(
    (updated: PackingResult) => {
      setHardboardResult(updated)
      setHardboardVariants((prev) =>
        prev.map((v, i) => (i === hardboardVariantIndex ? { ...v, result: updated } : v)),
      )
    },
    [hardboardVariantIndex],
  )

  const handleLayoutChange = useCallback(
    (updated: PackingResult) => {
      setPackingResult(updated)
      setPackingVariants((prev) =>
        prev.map((v, i) => (i === selectedVariantIndex ? { ...v, result: updated } : v)),
      )
    },
    [selectedVariantIndex],
  )

  const handleSaveProject = async (name: string) => {
    if (!user) return
    try {
      const existing = savedProjects.find((p) => p.name === name)
      const project: SavedProject = {
        id: existing?.id ?? generateId(),
        name,
        sheets,
        parts,
        edgeBanding,
        cabinets,
        dailyRateEur,
        updatedAt: Date.now(),
      }
      await saveProject(user.uid, project)
      setLastProjectId(project.id)
      saveDraft({ sheets, parts, edgeBanding, cabinets, dailyRateEur })
      await loadUserProjects()
      setDbError(null)
    } catch (e) {
      showDbError('Грешка при запазване в Firestore', formatFirebaseError(e), 'saveProject')
      throw e
    }
  }

  const handleLoadProject = (id: string) => {
    const project = savedProjects.find((p) => p.id === id)
    if (!project) return
    applyProjectData(project)
    setLastProjectId(id)
    saveDraft({
      sheets: project.sheets,
      parts: project.parts,
      edgeBanding: project.edgeBanding,
      cabinets: project.cabinets ?? [],
      dailyRateEur: project.dailyRateEur ?? 0,
    })
  }

  const cabinetState = { cabinets, parts, edgeBanding }

  const resetPacking = () => {
    setPackingResult(null)
    setPackingVariants([])
    setHardboardResult(null)
    setHardboardVariants([])
  }

  const ensureHardboardSheet = (params: Record<string, unknown>) => {
    if (!parseKitchenBaseParams(params).hasBack) return
    setSheets((prev) => {
      if (firstSheetOfKind(prev, 'hardboard')) return prev
      return [...prev, createHardboardSheet(generateId())]
    })
  }

  const handleAddCabinet = (input: {
    typeId: string
    params: Record<string, unknown>
    quantity: number
  }) => {
    const next = addCabinetAndLabel(cabinetState, input)
    setCabinets(next.cabinets)
    setParts(next.parts)
    setEdgeBanding(next.edgeBanding)
    ensureHardboardSheet(input.params)
    resetPacking()
  }

  const handleUpdateCabinet = (
    cabinetId: string,
    input: { typeId: string; params: Record<string, unknown>; quantity: number },
  ) => {
    const next = updateCabinetAndLabel(cabinetState, cabinetId, input)
    setCabinets(next.cabinets)
    setParts(next.parts)
    setEdgeBanding(next.edgeBanding)
    ensureHardboardSheet(input.params)
    resetPacking()
  }

  const handleRemoveCabinet = (cabinetId: string) => {
    const next = removeCabinetAndLabel(cabinetState, cabinetId)
    setCabinets(next.cabinets)
    setParts(next.parts)
    setEdgeBanding(next.edgeBanding)
    resetPacking()
  }

  const variantLabel = packingVariants[selectedVariantIndex]?.label ?? ''
  const variantOptions = packingVariants.map((v) => ({
    label: v.label.replace('Разкрой · ', ''),
    wastePercent: v.result.totalWastePercent,
  }))
  const hardboardVariantLabel = hardboardVariants[hardboardVariantIndex]?.label ?? ''
  const hardboardVariantOptions = hardboardVariants.map((v) => ({
    label: v.label.replace('Разкрой · ', ''),
    wastePercent: v.result.totalWastePercent,
  }))
  const chipboardPartCount = parts.filter((p) => partKind(p) === 'chipboard').length
  const hardboardPartCount = parts.filter((p) => partKind(p) === 'hardboard').length
  const chipboardSheetCount = sheets.filter((s) => sheetKind(s) === 'chipboard').reduce((s, sh) => s + sh.quantity, 0)
  const hardboardSheetCount = sheets.filter((s) => sheetKind(s) === 'hardboard').reduce((s, sh) => s + sh.quantity, 0)
  const canGenerate =
    parts.length > 0 &&
    (chipboardPartCount === 0 || chipboardSheetCount > 0) &&
    (hardboardPartCount === 0 || hardboardSheetCount > 0)

  return (
    <div className="flex min-h-dvh flex-col">
      <DbErrorBanner error={dbError} onDismiss={() => setDbError(null)} />
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-[var(--color-primary)]" />
            <h1 className="text-xl font-bold">SketchCut</h1>
          </div>
          <HeaderActions
            user={user}
            onAuthClick={() => setAuthOpen(true)}
            onSaveClick={() => {
              setProjectMode('save')
              setProjectOpen(true)
            }}
            onLoadClick={() => {
              setProjectMode('load')
              setProjectOpen(true)
            }}
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4">
        <div className="grid min-h-[400px] grid-cols-1 gap-4 lg:grid-cols-2">
          <SheetsPanel sheets={sheets} onChange={setSheets} />
          <PartsPanel parts={parts} onChange={setParts} />
        </div>

        <CabinetsPanel
          cabinets={cabinets}
          sheets={sheets}
          dailyRateEur={dailyRateEur}
          onDailyRateChange={setDailyRateEur}
          applyAdd={handleAddCabinet}
          applyUpdate={handleUpdateCabinet}
          applyRemove={handleRemoveCabinet}
        />

        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={handleGenerate} disabled={!canGenerate}>
            <Sparkles className="h-4 w-4" />
            Генерирай разкрой
          </Button>

          {parts.length > 0 && (
            <Button size="lg" variant="secondary" onClick={() => setEdgeOpen(true)}>
              Кантиране
            </Button>
          )}

          {hardboardPartCount > 0 && hardboardSheetCount === 0 && (
            <p className="self-center text-sm text-[var(--color-destructive)]">
              Има фазер, но няма плоча фазер — добавете от панела Плочи
            </p>
          )}

          {packingResult && !packingResult.success && (
            <p className="self-center text-sm text-[var(--color-destructive)]">
              {packingResult.unplacedCount} ПДЧ детайла не се побират в наличните {chipboardSheetCount} плочи
            </p>
          )}
          {hardboardResult && !hardboardResult.success && (
            <p className="self-center text-sm text-[var(--color-destructive)]">
              {hardboardResult.unplacedCount} фазер детайла не се побират в наличните {hardboardSheetCount} плочи
            </p>
          )}
        </div>

        <Separator />

        {packingResult && packingResult.sheets.length > 0 && (
          <CuttingLayout
            title="Разкрой ПДЧ"
            result={packingResult}
            variantLabel={variantLabel}
            variants={variantOptions}
            selectedVariantIndex={selectedVariantIndex}
            onVariantSelect={handleVariantSelect}
            onResultChange={handleLayoutChange}
          />
        )}

        {hardboardResult && hardboardResult.sheets.length > 0 && (
          <CuttingLayout
            title="Разкрой фазер"
            result={hardboardResult}
            variantLabel={hardboardVariantLabel}
            variants={hardboardVariantOptions}
            selectedVariantIndex={hardboardVariantIndex}
            onVariantSelect={handleHardboardVariantSelect}
            onResultChange={handleHardboardLayoutChange}
          />
        )}
      </main>

      <EdgeBandingDialog
        open={edgeOpen}
        onOpenChange={setEdgeOpen}
        parts={parts}
        edgeBanding={edgeBanding}
        onChange={setEdgeBanding}
      />

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} user={user} />

      <ProjectDialog
        open={projectOpen}
        onOpenChange={setProjectOpen}
        mode={projectMode}
        projectNames={savedProjects.map((p) => ({
          id: p.id,
          name: p.name,
          updatedAt: p.updatedAt,
        }))}
        onSave={handleSaveProject}
        onLoad={handleLoadProject}
        onError={(msg) => showDbError('Проект', msg, 'ProjectDialog')}
      />
    </div>
  )
}

export default App
