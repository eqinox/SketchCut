import { useState } from 'react'
import type { BoardFinish } from '@/lib/board-finishes'
import { buildRoomShare, publishRoomShare } from '@/lib/room-share'
import type { RoomPlan } from '@/lib/room'
import type { CabinetInstance } from '@/types'

export function RoomLink({
  room,
  cabinets,
  finishes,
  userId,
}: {
  room: RoomPlan
  cabinets: CabinetInstance[]
  finishes: BoardFinish[]
  userId: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const placed = room.pieces.length > 0

  const publish = async () => {
    if (!userId || !placed || busy) return
    setBusy(true)
    setNote('')
    setUrl('')
    try {
      const result = await publishRoomShare(userId, buildRoomShare(room, cabinets, finishes))
      setUrl(result.url)
      try {
        await navigator.clipboard.writeText(result.url)
        setNote(result.droppedPhotos ? 'Линкът е копиран. Снимките на декора не влязоха, цветовете са там.' : 'Линкът е копиран.')
      } catch {
        setNote(result.droppedPhotos ? 'Копирай линка отдолу. Снимките на декора не влязоха, цветовете са там.' : 'Копирай линка отдолу.')
      }
    } catch (error) {
      setNote(error instanceof Error && error.message ? error.message : 'Линкът не се записа.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3">
      {!userId ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Влез в акаунта, за да пратиш линк на някого.</p>
      ) : (
        <button
          type="button"
          className="rounded-md border border-neutral-400 bg-white px-3 py-2 text-sm text-neutral-900 disabled:opacity-50"
          disabled={!placed || busy}
          onClick={() => void publish()}
        >
          {busy ? 'Записвам линка…' : 'Линк за преглед'}
        </button>
      )}
      {!placed && userId && (
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Сложи мебел в стаята, за да има какво да се разглежда.</p>
      )}
      {note && <p className="mt-2 text-sm">{note}</p>}
      {url && (
        <input
          readOnly
          value={url}
          aria-label="Линк за преглед на стаята"
          className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  )
}
