import { useEffect, useState } from 'react'
import { RoomPhoto } from '@/components/RoomPhoto'
import { asCabinetInstances, fetchRoomShare, type RoomShare } from '@/lib/room-share'

export function RoomSharePage({ id }: { id: string }) {
  const [share, setShare] = useState<RoomShare | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')

  useEffect(() => {
    let cancel = false
    setState('loading')
    setShare(null)
    void fetchRoomShare(id)
      .then((next) => {
        if (cancel) return
        setShare(next)
        setState(next ? 'ready' : 'missing')
      })
      .catch(() => {
        if (!cancel) setState('error')
      })
    return () => {
      cancel = true
    }
  }, [id])

  return (
    <div className="min-h-screen bg-[#e7e1d6] text-neutral-900">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-medium">Стая</p>
        <button type="button" className="text-sm text-neutral-700 underline" onClick={() => { window.location.hash = '' }}>
          Отвори SketchCut
        </button>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pb-8">
        {state === 'loading' && <p className="py-16 text-center text-sm">Зарежда се стаята…</p>}
        {state === 'missing' && <p className="py-16 text-center text-sm">Този линк не води към стая.</p>}
        {state === 'error' && (
          <p className="py-16 text-center text-sm">Стаята не се зареди. Отвори линка пак след малко.</p>
        )}
        {state === 'ready' && share && (
          <RoomPhoto room={share.room} cabinets={asCabinetInstances(share)} finishes={share.finishes} tall />
        )}
      </main>
    </div>
  )
}
