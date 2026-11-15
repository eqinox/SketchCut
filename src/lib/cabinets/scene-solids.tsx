import { createContext, useContext, useLayoutEffect, useRef } from 'react'
import type { PullSku } from '@/lib/cabinets/pulls'

/** A piece in the same millimetre space as the drawing. y grows downward, z toward the back. */
export type SceneSolid =
  | {
      kind: 'box'
      x: number
      y: number
      z: number
      w: number
      h: number
      d: number
      color: string
      /** The face away from the viewer, when it is a different colour from the front. */
      rearColor?: string
      /** Pieces that share an id slide out together. The runners stay put. */
      slide?: { id: string; travel: number }
      /** Bow or bar on this front. The key stays put when the cabinet is moved in a group. */
      pull?: { key: string; sku: PullSku; at?: 'left' | 'right' | 'center' }
    }
  | {
      kind: 'door'
      hingeX: number
      y: number
      z: number
      width: number
      height: number
      thickness: number
      side: 'left' | 'right'
      openDeg: number
      color: string
      /** Hinge centres, millimetres down from the top of the door. */
      hingeFromTop?: number[]
      /** The door sits between the sides, so the plate is on the face just outside the hinge edge. */
      inset?: boolean
      /** Bow or bar on the outer face. */
      pull?: { key: string; sku: PullSku }
    }
  | {
      kind: 'rail'
      x: number
      y: number
      w: number
      h: number
      d: number
      z0: number
      z1: number
      color: string
    }

export type CaptureStore = {
  add: (solid: SceneSolid) => number
  remove: (id: number) => void
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => SceneSolid[]
}

export function createCaptureStore(): CaptureStore {
  const solids = new Map<number, SceneSolid>()
  let nextId = 1
  let snapshot: SceneSolid[] = []
  const listeners = new Set<() => void>()
  let scheduled = false
  const publish = () => {
    scheduled = false
    snapshot = [...solids.values()]
    listeners.forEach((listener) => listener())
  }
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(publish)
  }
  return {
    add(solid) {
      const id = nextId++
      solids.set(id, solid)
      schedule()
      return id
    },
    remove(id) {
      if (!solids.delete(id)) return
      schedule()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      return snapshot
    },
  }
}

export const SceneCaptureContext = createContext<CaptureStore | null>(null)

/** Moves a cabinet in the shared picture. localTop is its own drawing's carcass top. */
export const DrawPlaceContext = createContext({ x: 0, y: 0, localLeft: 0, localTop: 0 })

function placeSolid(solid: SceneSolid, place: { x: number; y: number; localLeft: number; localTop: number }): SceneSolid {
  const dx = place.x - place.localLeft
  const dy = place.y - place.localTop
  if (dx === 0 && dy === 0) return solid
  if (solid.kind === 'door') return { ...solid, hingeX: solid.hingeX + dx, y: solid.y + dy }
  const moved = { ...solid, x: solid.x + dx, y: solid.y + dy }
  if (moved.kind === 'box' && moved.slide) {
    return {
      ...moved,
      slide: { ...moved.slide, id: `${moved.slide.id}@${Math.round(dx)}:${Math.round(dy)}` },
    }
  }
  return moved
}

/** Remember a piece for the 3D view. No-op while that view is closed. */
export function useCaptureSolid(solid: SceneSolid | null) {
  const store = useContext(SceneCaptureContext)
  const place = useContext(DrawPlaceContext)
  const placed = solid ? placeSolid(solid, place) : null
  const solidRef = useRef(placed)
  solidRef.current = placed
  const key = placed ? JSON.stringify(placed) : ''
  useLayoutEffect(() => {
    const current = solidRef.current
    if (!store || !current) return
    const id = store.add(current)
    return () => store.remove(id)
  }, [store, key])
}
