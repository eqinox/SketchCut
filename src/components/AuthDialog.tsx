import { useState } from 'react'
import { LogIn, LogOut, Save, FolderOpen } from 'lucide-react'
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
  onError?: (message: string) => void
}

export function ProjectDialog({
  open,
  onOpenChange,
  mode,
  projectNames,
  onSave,
  onLoad,
  onError,
}: ProjectDialogProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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
                <button
                  key={p.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2 text-left text-sm hover:bg-[var(--color-accent)]"
                  onClick={() => {
                    onLoad(p.id)
                    onOpenChange(false)
                  }}
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {new Date(p.updatedAt).toLocaleDateString('bg-BG')}
                  </span>
                </button>
              ))
            )}
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
