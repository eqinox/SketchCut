import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { Sparkles, Layers, Settings, Trash2, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SheetsPanel } from '@/components/SheetsPanel'
import { PartsPanel } from '@/components/PartsPanel'
import { CuttingLayout } from '@/components/CuttingLayout'
import { EdgeBandingDialog } from '@/components/EdgeBandingDialog'
import { AuthDialog, HeaderActions, ProjectDialog } from '@/components/AuthDialog'
import { CabinetsPanel } from '@/components/CabinetsPanel'
import { RoomPlanView } from '@/components/RoomPlan'
import { SettingsDialog } from '@/components/SettingsDialog'
import { RulesDialog } from '@/components/RulesDialog'
import { optimizeAllVariants, raiseSheetQuantities } from '@/lib/packing/optimizer'
import { syncEdgeBanding } from '@/lib/edge-banding'
import {
  addCabinetAndLabel,
  removeCabinetAndLabel,
  updateCabinetAndLabel,
  rebuildCabinets,
  saveCabinetGroup,
  createHardboardSheet,
  firstSheetOfKind,
  partKind,
  sheetKind,
  normalizeSheet,
} from '@/lib/cabinets'
import { subscribeAuth, saveProject, loadProjects, deleteProject, loadUserSettings, saveUserSettings, getFirebaseInitError } from '@/lib/firebase'
import { saveDraft, readInitialDraft, setOpenProject, getOpenProject, type OpenProjectRef } from '@/lib/draft-storage'
import { loadSettings, saveSettings, resetSettings, type HardwareSettings } from '@/lib/settings'
import { ensureFinishSheets, ensurePackingSheets, finishById, type BoardFinish } from '@/lib/board-finishes'
import { kronospanBoardByFinishId, withKronospanBoard } from '@/lib/kronospan-color'
import { swapColor } from '@/lib/project-colors'
import { projectPriceEur } from '@/lib/project-price'
import { isCombinationType } from '@/lib/cabinets/compose'
import {
  loadAssemblyTimeSettings,
  saveAssemblyTimeSettings,
  resetAssemblyTimeSettings,
  type AssemblyTimeSettings,
} from '@/lib/assembly-time'
import { generateId } from '@/lib/utils'
import { formatFirebaseError } from '@/lib/firebase-errors'
import { getMissingClientEnvKeys } from '@/lib/env'
import { DbErrorBanner, type DbErrorDetails } from '@/components/DbErrorBanner'
import type { CabinetInstance, Part, PartEdgeBanding, PackingResult, SavedProject, Sheet } from '@/types'
import { parseRoomPlan, type RoomPiece, type RoomPlan } from '@/lib/room'

const initialDraft = readInitialDraft()

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [sheets, setSheets] = useState<Sheet[]>(initialDraft.sheets)
  const [parts, setParts] = useState<Part[]>(initialDraft.parts)
  const [edgeBanding, setEdgeBanding] = useState<PartEdgeBanding[]>(initialDraft.edgeBanding)
  const [cabinets, setCabinets] = useState<CabinetInstance[]>(initialDraft.cabinets)
  const [dailyRateEur, setDailyRateEur] = useState(initialDraft.dailyRateEur)
  const [room, setRoom] = useState<RoomPlan>(initialDraft.room)
  const [editRequest, setEditRequest] = useState<{ cabinetId: string; nonce: number } | null>(null)
  const [packingResult, setPackingResult] = useState<PackingResult | null>(null)
  const [hardboardResult, setHardboardResult] = useState<PackingResult | null>(null)
  const saveReadyRef = useRef(false)

  const [authOpen, setAuthOpen] = useState(false)
  const [edgeOpen, setEdgeOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [projectMode, setProjectMode] = useState<'save' | 'load'>('save')
  const [openProject, setOpenProjectState] = useState<OpenProjectRef | null>(() => getOpenProject())
  const [projectDirty, setProjectDirty] = useState(false)
  const [projectSaving, setProjectSaving] = useState(false)
  const [projectSavedFlash, setProjectSavedFlash] = useState(false)
  // A short line at the bottom of the screen that says a save went through, or why it did not.
  const [notice, setNotice] = useState<{ text: string; ok: boolean; id: number } | null>(null)
  const say = useCallback((text: string, ok = true) => {
    const id = Date.now()
    setNotice({ text, ok, id })
    window.setTimeout(() => setNotice((now) => (now?.id === id ? null : now)), ok ? 2500 : 6000)
  }, [])
  const projectBaseline = useRef<string | null>(null)
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])
  const [dbError, setDbError] = useState<DbErrorDetails | null>(null)
  const [settings, setSettings] = useState<HardwareSettings>(loadSettings())
  const [assemblyTimeSettings, setAssemblyTimeSettings] = useState<AssemblyTimeSettings>(
    loadAssemblyTimeSettings(),
  )

  const showDbError = useCallback((title: string, message: string, source?: string) => {
    setDbError({ title, message, source })
  }, [])

  const workspaceKey = useCallback(
    (data: { sheets: Sheet[]; parts: Part[]; edgeBanding: PartEdgeBanding[]; cabinets: CabinetInstance[]; dailyRateEur: number; room: RoomPlan }) =>
      JSON.stringify(data),
    [],
  )

  const rememberOpenProject = useCallback(
    (project: OpenProjectRef, data: { sheets: Sheet[]; parts: Part[]; edgeBanding: PartEdgeBanding[]; cabinets: CabinetInstance[]; dailyRateEur: number; room: RoomPlan }) => {
      projectBaseline.current = workspaceKey(data)
      setOpenProject(project)
      setOpenProjectState(project)
      setProjectDirty(false)
    },
    [workspaceKey],
  )

  const forgetOpenProject = useCallback(() => {
    projectBaseline.current = null
    setOpenProject(null)
    setOpenProjectState(null)
    setProjectDirty(false)
  }, [])

  const applyProjectData = useCallback((project: SavedProject) => {
    setSheets(project.sheets.map(normalizeSheet))
    setParts(project.parts)
    setEdgeBanding(project.edgeBanding)
    setCabinets(project.cabinets ?? [])
    setDailyRateEur(project.dailyRateEur ?? 0)
    setRoom(parseRoomPlan(project.room))
    setPackingResult(null)
    setHardboardResult(null)
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
    setEdgeBanding((prev) => {
      const next = syncEdgeBanding(parts, prev)
      if (next.length === prev.length && next.every((item, index) => item === prev[index])) return prev
      return next
    })
  }, [parts])

  useEffect(() => {
    if (!saveReadyRef.current) return
    saveDraft({ sheets, parts, edgeBanding, cabinets, dailyRateEur, room })
  }, [sheets, parts, edgeBanding, cabinets, dailyRateEur, room])

  useEffect(() => {
    if (!openProject) {
      setProjectDirty(false)
      return
    }
    const key = workspaceKey({ sheets, parts, edgeBanding, cabinets, dailyRateEur, room })
    if (projectBaseline.current == null) {
      projectBaseline.current = key
      setProjectDirty(false)
      return
    }
    setProjectDirty(key !== projectBaseline.current)
  }, [openProject, sheets, parts, edgeBanding, cabinets, dailyRateEur, room, workspaceKey])

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

  useEffect(() => {
    if (!user) return
    let cancelled = false
    loadUserSettings(user.uid)
      .then((remote) => {
        if (cancelled) return
        if (remote) {
          setSettings(remote.hardware)
          saveSettings(remote.hardware)
          setAssemblyTimeSettings(remote.assemblyTime)
          saveAssemblyTimeSettings(remote.assemblyTime)
          return
        }
        return saveUserSettings(user.uid, {
          hardware: loadSettings(),
          assemblyTime: loadAssemblyTimeSettings(),
        })
      })
      .catch((e) => {
        if (cancelled) return
        showDbError('Грешка при зареждане на настройките', formatFirebaseError(e), 'loadUserSettings')
      })
    return () => {
      cancelled = true
    }
  }, [user, showDbError])

  const handleGenerate = () => {
    if (parts.length === 0) return
    const stock = ensurePackingSheets(sheets, parts, settings.boardFinishes, {
      chipboardPriceEur: settings.chipboardPriceEur,
      hardboardPriceEur: settings.hardboardPriceEur,
    })
    const chipboardParts = parts.filter((p) => partKind(p) === 'chipboard')
    const hardboardParts = parts.filter((p) => partKind(p) === 'hardboard')
    const chipboardSheets = stock.filter((s) => sheetKind(s) === 'chipboard')
    const hardboardSheets = stock.filter((s) => sheetKind(s) === 'hardboard')

    const chipResult =
      chipboardParts.length > 0 ? packChipboard(chipboardSheets, chipboardParts, settings.boardFinishes) : null
    const boardResult =
      hardboardParts.length > 0 ? (optimizeAllVariants(hardboardSheets, hardboardParts)[0]?.result ?? null) : null

    setSheets(
      raiseSheetQuantities(stock, [...(chipResult?.sheets ?? []), ...(boardResult?.sheets ?? [])]),
    )
    setPackingResult(chipResult)
    setHardboardResult(boardResult)
  }

  const handleHardboardLayoutChange = useCallback((updated: PackingResult) => {
    setHardboardResult(updated)
  }, [])

  const handleLayoutChange = useCallback((updated: PackingResult) => {
    setPackingResult(updated)
  }, [])

  const handleSaveProject = async (name: string, existingId?: string) => {
    if (!user) return
    setProjectSaving(true)
    setProjectSavedFlash(false)
    try {
      const byId = existingId ? savedProjects.find((p) => p.id === existingId) : undefined
      const byName = savedProjects.find((p) => p.name === name)
      const data = { sheets, parts, edgeBanding, cabinets, dailyRateEur, room }
      const project: SavedProject = {
        id: existingId ?? byId?.id ?? byName?.id ?? generateId(),
        name,
        ...data,
        updatedAt: Date.now(),
      }
      await saveProject(user.uid, project)
      rememberOpenProject({ id: project.id, name: project.name }, data)
      saveDraft(data)
      await loadUserProjects()
      setDbError(null)
      setProjectSavedFlash(true)
      window.setTimeout(() => setProjectSavedFlash(false), 2500)
      say(`Проектът „${name}“ е записан`)
    } catch (e) {
      showDbError('Грешка при запазване в Firestore', formatFirebaseError(e), 'saveProject')
      say(`Проектът не се записа: ${formatFirebaseError(e)}`, false)
      throw e
    } finally {
      setProjectSaving(false)
    }
  }

  const handleSaveOpenProject = () => {
    if (!openProject) {
      setProjectMode('save')
      setProjectOpen(true)
      return
    }
    // The error is already on screen; nothing else waits for this promise.
    handleSaveProject(openProject.name, openProject.id).catch(() => {})
  }

  const handleDeleteProject = async (id: string) => {
    if (!user) return
    try {
      await deleteProject(user.uid, id)
      setSavedProjects((prev) => prev.filter((p) => p.id !== id))
      if (openProject?.id === id) forgetOpenProject()
      setDbError(null)
    } catch (e) {
      showDbError('Грешка при изтриване от Firestore', formatFirebaseError(e), 'deleteProject')
      throw e
    }
  }

  const handleLoadProject = (id: string) => {
    const project = savedProjects.find((p) => p.id === id)
    if (!project) return
    const data = {
      sheets: project.sheets.map(normalizeSheet),
      parts: project.parts,
      edgeBanding: project.edgeBanding,
      cabinets: project.cabinets ?? [],
      dailyRateEur: project.dailyRateEur ?? 0,
      room: parseRoomPlan(project.room),
    }
    applyProjectData(project)
    rememberOpenProject({ id: project.id, name: project.name }, data)
    saveDraft(data)
  }

  const cabinetState = { cabinets, parts, edgeBanding }
  // The whole project's price, shown in the design view next to the project colours.
  const projectPrice = useMemo(
    () => projectPriceEur(cabinets, sheets, { hardware: settings, assemblyTime: assemblyTimeSettings }, dailyRateEur),
    [cabinets, sheets, settings, assemblyTimeSettings, dailyRateEur],
  )

  const resetPacking = () => {
    setPackingResult(null)
    setHardboardResult(null)
  }

  const clearChipboardSheets = () => {
    setSheets((prev) => prev.filter((s) => sheetKind(s) !== 'chipboard'))
    setPackingResult(null)
  }

  const clearHardboardSheets = () => {
    setSheets((prev) => prev.filter((s) => sheetKind(s) !== 'hardboard'))
    setHardboardResult(null)
  }

  const clearParts = () => {
    setParts([])
    setEdgeBanding([])
    setCabinets((prev) => prev.map((c) => ({ ...c, partIds: [] })))
    resetPacking()
  }

  const clearCabinets = () => {
    const keep = parts.filter((p) => !p.cabinetId)
    const keepIds = new Set(keep.map((p) => p.id))
    setCabinets([])
    setParts(keep)
    setEdgeBanding((prev) => prev.filter((b) => keepIds.has(b.partId)))
    resetPacking()
  }

  const clearAll = () => {
    setSheets([])
    setParts([])
    setEdgeBanding([])
    setCabinets([])
    setRoom(parseRoomPlan(undefined))
    resetPacking()
    forgetOpenProject()
  }

  const ensureHardboardSheet = (params: Record<string, unknown>) => {
    if (params.hasBack !== true) return
    setSheets((prev) => {
      if (firstSheetOfKind(prev, 'hardboard')) return prev
      return [...prev, createHardboardSheet(generateId(), settings.hardboardPriceEur)]
    })
  }

  const handleAddCabinet = (input: {
    typeId: string
    params: Record<string, unknown>
    quantity: number
  }) => {
    const next = addCabinetAndLabel(cabinetState, input, { hardware: settings, assemblyTime: assemblyTimeSettings })
    setCabinets(next.cabinets)
    setParts(next.parts)
    setEdgeBanding(next.edgeBanding)
    ensureHardboardSheet(input.params)
    setSheets((prev) => ensureFinishSheets(prev, next.parts, settings.boardFinishes))
    resetPacking()
  }

  /** A cabinet drawn on the room plan: add it to the project and stand it where it was drawn. */
  const handleDrawCabinet = (
    input: { typeId: string; params: Record<string, unknown> },
    piece: Omit<RoomPiece, 'cabinetId'>,
  ) => {
    const before = new Set(cabinetState.cabinets.map((cabinet) => cabinet.id))
    const next = addCabinetAndLabel(cabinetState, { ...input, quantity: 1 }, { hardware: settings, assemblyTime: assemblyTimeSettings })
    const made = next.cabinets.find((cabinet) => !before.has(cabinet.id))
    setCabinets(next.cabinets)
    setParts(next.parts)
    setEdgeBanding(next.edgeBanding)
    ensureHardboardSheet(input.params)
    setSheets((prev) => ensureFinishSheets(prev, next.parts, settings.boardFinishes))
    resetPacking()
    if (made) setRoom((prev) => ({ ...prev, pieces: [...prev.pieces, { ...piece, cabinetId: made.id }] }))
  }

  const handleUpdateCabinet = (
    cabinetId: string,
    input: { typeId: string; params: Record<string, unknown>; quantity: number },
  ) => {
    const next = updateCabinetAndLabel(cabinetState, cabinetId, input, { hardware: settings, assemblyTime: assemblyTimeSettings })
    setCabinets(next.cabinets)
    setParts(next.parts)
    setEdgeBanding(next.edgeBanding)
    ensureHardboardSheet(input.params)
    setSheets((prev) => ensureFinishSheets(prev, next.parts, settings.boardFinishes))
    resetPacking()
    say(openProject ? 'Шкафът е записан. Натисни „Запази“ горе, за да влезе и в проекта.' : 'Шкафът е записан')
  }

  const handleSaveGroup = (group: Parameters<typeof saveCabinetGroup>[1]) => {
    const next = saveCabinetGroup(cabinetState, group, { hardware: settings, assemblyTime: assemblyTimeSettings })
    setCabinets(next.cabinets)
    setParts(next.parts)
    setEdgeBanding(next.edgeBanding)
    ensureHardboardSheet(group.host.params)
    for (const guest of group.guests) ensureHardboardSheet(guest.params)
    setSheets((prev) => ensureFinishSheets(prev, next.parts, settings.boardFinishes))
    resetPacking()
  }

  const handleRemoveCabinet = (cabinetId: string) => {
    const next = removeCabinetAndLabel(cabinetState, cabinetId, { hardware: settings, assemblyTime: assemblyTimeSettings })
    setCabinets(next.cabinets)
    setParts(next.parts)
    setEdgeBanding(next.edgeBanding)
    resetPacking()
  }

  const persistAccountSettings = useCallback(
    (hardware: HardwareSettings, assemblyTime: AssemblyTimeSettings) => {
      if (!user) return
      saveUserSettings(user.uid, { hardware, assemblyTime }).catch((e) => {
        showDbError('Грешка при запазване на настройките', formatFirebaseError(e), 'saveUserSettings')
      })
    },
    [user, showDbError],
  )

  /** Puts `to` everywhere the project uses `from`: carcasses, doors and single pieces. */
  const handleSwapColor = (from: string, to: string) => {
    let hardware = settings
    const board = to ? kronospanBoardByFinishId(to) : undefined
    if (board) {
      const finishes = withKronospanBoard(settings.boardFinishes, board)
      if (finishes !== settings.boardFinishes) {
        hardware = { ...settings, boardFinishes: finishes }
        setSettings(hardware)
        saveSettings(hardware)
        persistAccountSettings(hardware, assemblyTimeSettings)
      }
    }
    let state = cabinetState
    let count = 0
    for (const cabinet of cabinets) {
      if (isCombinationType(cabinet.typeId)) continue
      const params = swapColor(cabinet.params, from, to)
      if (!params) continue
      state = updateCabinetAndLabel(
        state,
        cabinet.id,
        { typeId: cabinet.typeId, params, quantity: cabinet.quantity },
        { hardware, assemblyTime: assemblyTimeSettings },
      )
      count += 1
    }
    if (count === 0) return
    setCabinets(state.cabinets)
    setParts(state.parts)
    setEdgeBanding(state.edgeBanding)
    setSheets((prev) => ensureFinishSheets(prev, state.parts, hardware.boardFinishes))
    resetPacking()
    say(count === 1 ? 'Цветът е сменен в 1 шкаф' : `Цветът е сменен в ${count} шкафа`)
  }

  const applyCabinetRebuild = (
    hardware: HardwareSettings,
    assemblyTime: AssemblyTimeSettings,
  ) => {
    const next = rebuildCabinets(cabinetState, { hardware, assemblyTime })
    setCabinets(next.cabinets)
    setParts(next.parts)
    setEdgeBanding(next.edgeBanding)
    resetPacking()
  }

  const handleSaveSettings = (newSettings: HardwareSettings) => {
    const oldSettings = settings
    setSettings(newSettings)
    saveSettings(newSettings)
    persistAccountSettings(newSettings, assemblyTimeSettings)
    
    // Актуализирай съществуващите плочи ако цената се е променила
    if (newSettings.chipboardPriceEur !== oldSettings.chipboardPriceEur || 
        newSettings.hardboardPriceEur !== oldSettings.hardboardPriceEur) {
      setSheets((prev) => prev.map((sheet) => {
        if (sheet.finishId) {
          const finish = newSettings.boardFinishes.find((item) => item.id === sheet.finishId)
          return finish ? { ...sheet, priceEur: finish.sheetPriceEur } : sheet
        }
        const kind = sheetKind(sheet)
        if (kind === 'chipboard' && sheet.priceEur === oldSettings.chipboardPriceEur) {
          return { ...sheet, priceEur: newSettings.chipboardPriceEur }
        }
        if (kind === 'hardboard' && sheet.priceEur === oldSettings.hardboardPriceEur) {
          return { ...sheet, priceEur: newSettings.hardboardPriceEur }
        }
        return sheet
      }))
    }

    if (newSettings.externalDoors !== oldSettings.externalDoors && cabinets.length > 0) {
      applyCabinetRebuild(newSettings, assemblyTimeSettings)
      return
    }
    
    resetPacking()
  }

  const handleResetSettings = () => {
    const defaults = resetSettings()
    const doorsChanged = defaults.externalDoors !== settings.externalDoors
    setSettings(defaults)
    persistAccountSettings(defaults, assemblyTimeSettings)
    if (doorsChanged && cabinets.length > 0) {
      applyCabinetRebuild(defaults, assemblyTimeSettings)
    } else {
      resetPacking()
    }
    return defaults
  }

  const handleSaveAssemblyTimeSettings = (newSettings: AssemblyTimeSettings) => {
    setAssemblyTimeSettings(newSettings)
    saveAssemblyTimeSettings(newSettings)
    persistAccountSettings(settings, newSettings)
    resetPacking()
  }

  const handleResetAssemblyTimeSettings = () => {
    const defaults = resetAssemblyTimeSettings()
    setAssemblyTimeSettings(defaults)
    persistAccountSettings(settings, defaults)
    resetPacking()
    return defaults
  }

  const canGenerate = parts.length > 0

  return (
    <div className="flex min-h-dvh flex-col">
      <DbErrorBanner error={dbError} onDismiss={() => setDbError(null)} />
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-md px-4 py-2 text-sm font-medium shadow-lg ${
            notice.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
          style={{ bottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          {notice.ok ? '✓ ' : '✕ '}
          {notice.text}
        </div>
      )}
      <header className="sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] border-[var(--color-border)] bg-[var(--color-background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex shrink-0 items-center gap-2">
              <Layers className="h-6 w-6 text-[var(--color-primary)]" />
              <h1 className="text-xl font-bold">SketchCut</h1>
            </div>
            {openProject && (
              <p className="truncate text-sm text-[var(--color-muted-foreground)]" title={openProject.name}>
                Отворен: <span className="font-medium text-[var(--color-foreground)]">{openProject.name}</span>
                {projectDirty ? ' · има промени' : ''}
              </p>
            )}
          </div>
          <HeaderActions
            user={user}
            openProjectName={openProject?.name ?? null}
            projectDirty={projectDirty}
            projectSaving={projectSaving}
            projectSaved={projectSavedFlash}
            onAuthClick={() => setAuthOpen(true)}
            onSaveClick={handleSaveOpenProject}
            onSaveAsClick={() => {
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
          <SheetsPanel 
            sheets={sheets} 
            onChange={setSheets}
            chipboardPriceEur={settings.chipboardPriceEur}
            hardboardPriceEur={settings.hardboardPriceEur}
            finishes={settings.boardFinishes}
            onClearChipboard={clearChipboardSheets}
            onClearHardboard={clearHardboardSheets}
          />
          <PartsPanel parts={parts} onChange={setParts} onClear={clearParts} />
        </div>

        <CabinetsPanel
          cabinets={cabinets}
          sheets={sheets}
          dailyRateEur={dailyRateEur}
          settings={{ hardware: settings, assemblyTime: assemblyTimeSettings }}
          onDailyRateChange={setDailyRateEur}
          onHardwareSettingsChange={(hardware) => {
            const doorsChanged = hardware.externalDoors !== settings.externalDoors
            setSettings(hardware)
            saveSettings(hardware)
            persistAccountSettings(hardware, assemblyTimeSettings)
            if (doorsChanged && cabinets.length > 0) {
              const next = rebuildCabinets(cabinetState, {
                hardware,
                assemblyTime: assemblyTimeSettings,
              })
              setCabinets(next.cabinets)
              setParts(next.parts)
              setEdgeBanding(next.edgeBanding)
            }
            resetPacking()
          }}
          applyAdd={handleAddCabinet}
          applyUpdate={handleUpdateCabinet}
          applyRemove={handleRemoveCabinet}
          onSaveGroup={handleSaveGroup}
          onClear={clearCabinets}
          room={room}
          editRequest={editRequest}
        />

        <RoomPlanView
          room={room}
          cabinets={cabinets}
          finishes={settings.boardFinishes}
          userId={user?.uid ?? null}
          onChange={setRoom}
          onEditCabinet={(cabinetId) => setEditRequest({ cabinetId, nonce: Date.now() })}
          onCreateCabinet={handleDrawCabinet}
          onRemoveCabinet={handleRemoveCabinet}
          onSwapColor={handleSwapColor}
          projectPriceEur={projectPrice}
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

          <Button size="lg" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
            Настройки
          </Button>

          <Button size="lg" variant="outline" onClick={() => setRulesOpen(true)}>
            <BookOpen className="h-4 w-4" />
            Правила
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={resetPacking}
            disabled={!packingResult && !hardboardResult}
          >
            <Trash2 className="h-4 w-4" />
            Изчисти разкроя
          </Button>

          <Button
            size="lg"
            variant="destructive"
            onClick={clearAll}
            disabled={
              sheets.length === 0 &&
              parts.length === 0 &&
              cabinets.length === 0 &&
              !packingResult &&
              !hardboardResult
            }
          >
            <Trash2 className="h-4 w-4" />
            Изчисти всичко
          </Button>

          {packingResult && packingResult.unplacedCount > 0 && (
            <p className="self-center text-sm text-[var(--color-destructive)]">
              {oversizedPartsSentence(packingResult, 'ПДЧ')}
            </p>
          )}
          {hardboardResult && hardboardResult.unplacedCount > 0 && (
            <p className="self-center text-sm text-[var(--color-destructive)]">
              {oversizedPartsSentence(hardboardResult, 'фазер')}
            </p>
          )}
        </div>

        <Separator />

        {packingResult && packingResult.sheets.length > 0 && (
          <CuttingLayout
            title="Разкрой ПДЧ"
            result={packingResult}
            finishes={settings.boardFinishes}
            onResultChange={handleLayoutChange}
            onClear={() => setPackingResult(null)}
          />
        )}

        {hardboardResult && hardboardResult.sheets.length > 0 && (
          <CuttingLayout
            title="Разкрой фазер"
            result={hardboardResult}
            finishes={settings.boardFinishes}
            onResultChange={handleHardboardLayoutChange}
            onClear={() => setHardboardResult(null)}
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

      <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSave={handleSaveSettings}
        onReset={handleResetSettings}
        assemblyTimeSettings={assemblyTimeSettings}
        onSaveAssemblyTime={handleSaveAssemblyTimeSettings}
        onResetAssemblyTime={handleResetAssemblyTimeSettings}
        signedIn={user != null}
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
        onSave={(name) => handleSaveProject(name)}
        onLoad={handleLoadProject}
        openProjectId={openProject?.id ?? null}
        onDelete={handleDeleteProject}
        onError={(msg) => showDbError('Проект', msg, 'ProjectDialog')}
      />
    </div>
  )
}

function stampBoard(
  result: PackingResult,
  board: { name?: string; id?: string },
): PackingResult {
  if (!board.name && !board.id) return result
  return {
    ...result,
    sheets: result.sheets.map((sheet) => ({
      ...sheet,
      ...(board.name ? { boardName: board.name } : {}),
      ...(board.id ? { finishId: board.id } : {}),
    })),
    unplaced: result.unplaced?.map((item) => (board.name ? { ...item, boardName: board.name } : item)),
  }
}

function mergePacked(results: PackingResult[]): PackingResult {
  if (results.length === 1) return results[0]!
  const packed = results.flatMap((result) => result.sheets)
  const unplaced = results.flatMap((result) => result.unplaced ?? [])
  const unplacedCount = results.reduce((sum, result) => sum + result.unplacedCount, 0)
  const used = packed.reduce((sum, sheet) => sum + sheet.usedArea, 0)
  const waste = packed.reduce((sum, sheet) => sum + sheet.wasteArea, 0)
  return {
    success: unplacedCount === 0,
    sheets: packed,
    totalWastePercent: used + waste > 0 ? (waste / (used + waste)) * 100 : 0,
    unplacedCount,
    unplaced,
    variantKey: 'finishes',
  }
}

function packChipboard(sheets: Sheet[], parts: Part[], finishes: BoardFinish[]): PackingResult | null {
  if (!parts.some((part) => part.finishId)) {
    return optimizeAllVariants(sheets, parts)[0]?.result ?? null
  }
  const keys = [...new Set(parts.map((part) => part.finishId ?? ''))]
  const results: PackingResult[] = []
  for (const key of keys) {
    const group = parts.filter((part) => (part.finishId ?? '') === key)
    const pool = sheets.filter((sheet) => (sheet.finishId ?? '') === key)
    const hit = optimizeAllVariants(pool, group)[0]?.result
    if (!hit) continue
    const finish = key ? finishById(finishes, key) : undefined
    results.push(stampBoard(hit, { name: finish?.name ?? (key ? 'Цвят' : undefined), id: key || undefined }))
  }
  if (results.length === 0) return null
  return mergePacked(results)
}

function oversizedPartsSentence(result: PackingResult, material: string): string {
  const items = result.unplaced ?? []
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item.boardName ?? '', (counts.get(item.boardName ?? '') ?? 0) + 1)
  if (counts.size === 0) {
    const n = result.unplacedCount
    return `${n} ${material} ${n === 1 ? 'детайл е по-голям' : 'детайла са по-големи'} от плочата и ${n === 1 ? 'не може' : 'не могат'} да се ${n === 1 ? 'нареже' : 'нарежат'}.`
  }
  return [...counts.entries()]
    .map(([name, n]) => {
      const color = name ? ` (${name})` : ''
      const piece = n === 1 ? 'детайл е по-голям' : 'детайла са по-големи'
      const verb = n === 1 ? 'не може да се нареже' : 'не могат да се нарежат'
      return `${n} ${material} ${piece} от плочата${color} и ${verb}`
    })
    .join('. ')
}

export default App
