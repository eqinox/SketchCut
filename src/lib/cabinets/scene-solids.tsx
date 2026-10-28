import { createContext, useContext, useLayoutEffect, useRef } from 'react'

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

/** Remember a piece for the 3D view. No-op while that view is closed. */
export function useCaptureSolid(solid: SceneSolid | null) {
  const store = useContext(SceneCaptureContext)
  const solidRef = useRef(solid)
  solidRef.current = solid
  const key = solid ? JSON.stringify(solid) : ''
  useLayoutEffect(() => {
    const current = solidRef.current
    if (!store || !current) return
    const id = store.add(current)
    return () => store.remove(id)
  }, [store, key])
}
