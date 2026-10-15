import { useEffect, useState } from 'react'
import { LogIn, LogOut, Save, FolderOpen, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { login, logout, register } from '@/lib/firebase'
import { formatFirebaseError } from '@/lib/firebase-errors'
import type { User } from 'firebase/auth'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
}

export function AuthDialog({ open, onOpenChange, user }: AuthDialogProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAuth = async (mode: 'login' | 'register') => {
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
      onOpenChange(false)
      setEmail('')
      setPassword('')
    } catch (e) {
      setError(formatFirebaseError(e))
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? 'Акаунт' : 'Вход / Регистрация'}</DialogTitle>
          <DialogDescription>
            {user
              ? `Логнат като ${user.email}`
              : 'Регистрирайте се за да запазвате проекти. Без вход работи само локално.'}
          </DialogDescription>
        </DialogHeader>

        {user ? (
          <Button variant="destructive" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Изход
          </Button>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="auth-email">Имейл</Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="auth-password">Парола</Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
            <div className="flex gap-2">
              <Button className="flex-1" disabled={loading} onClick={() => handleAuth('login')}>
                <LogIn className="h-4 w-4" />
                Вход
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                disabled={loading}
                onClick={() => handleAuth('register')}
              >
                Регистрация
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'save' | 'load'
  projectNames: { id: string; name: string; updatedAt: number }[]
  onSave: (name: string) => Promise<void>
  onLoad: (id: string) => void
  onDelete: (id: string) => Promise<void>
  onError?: (message: string) => void
}

export function ProjectDialog({
  open,
  onOpenChange,
  mode,
  projectNames,
  onSave,
  onLoad,
  onDelete,
  onError,
}: ProjectDialogProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open) return
    setPendingDeleteId(null)
    setError('')
    setDeleting(false)
  }, [open])

  const handleDelete = async (id: string) => {
    setError('')
    setDeleting(true)
    try {
      await onDelete(id)
      setPendingDeleteId(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Грешка при изтриване'
      setError(msg)
      onError?.(msg)
    } finally {
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setError('')
    setSaving(true)
    try {
      await onSave(name.trim())
      onOpenChange(false)
      setName('')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Грешка при запазване'
      setError(msg)
      onError?.(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'save' ? 'Запази проект' : 'Зареди проект'}</DialogTitle>
        </DialogHeader>

        {mode === 'save' ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="project-name">Име на проект</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim() && !saving) {
                    void handleSave()
                  }
                }}
              />
            </div>
            {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
            <Button className="w-full" disabled={!name.trim() || saving} onClick={() => void handleSave()}>
              <Save className="h-4 w-4" />
              {saving ? 'Запазване...' : 'Запази'}
            </Button>
          </div>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {projectNames.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">Няма запазени проекти</p>
            ) : (
              projectNames.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center justify-between text-left text-sm hover:underline"
                    onClick={() => {
                      onLoad(p.id)
                      onOpenChange(false)
                    }}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="ml-2 shrink-0 text-xs text-[var(--color-muted-foreground)]">
                      {new Date(p.updatedAt).toLocaleDateString('bg-BG')}
                    </span>
                  </button>
                  {pendingDeleteId === p.id ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={deleting}
                        onClick={() => void handleDelete(p.id)}
                      >
                        {deleting ? '...' : 'Изтрий'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={deleting}
                        onClick={() => setPendingDeleteId(null)}
                      >
                        Отказ
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      aria-label={`Изтрий ${p.name}`}
                      onClick={() => setPendingDeleteId(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
            {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function HeaderActions({
  user,
  onAuthClick,
  onSaveClick,
  onLoadClick,
}: {
  user: User | null
  onAuthClick: () => void
  onSaveClick: () => void
  onLoadClick: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      {user && (
        <>
          <Button variant="outline" size="sm" onClick={onSaveClick}>
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">Запази</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onLoadClick}>
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Зареди</span>
          </Button>
        </>
      )}
      <Button variant="ghost" size="sm" onClick={onAuthClick}>
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">{user ? user.email?.split('@')[0] : 'Вход'}</span>
      </Button>
    </div>
  )
}
