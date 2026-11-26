import { createContext, useContext, useLayoutEffect, useRef } from 'react'
import type { PullSku } from '@/lib/cabinets/pulls'

/** Colour a drawing gives bought steel (a bed's lift mechanism). 3D draws it as dark painted metal. */
export const STEEL = '#1c1c1e'

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
      /** Bought mirror glass. Drawn shiny, not as a chipboard face. */
      mirrorGlass?: boolean
      /** Which piece of the cabinet this is, so a click can give it its own board. */
      piece?: string
      /** For the assembly film: a part with no piece name that belongs to this stage. */
      assembly?: 'feet' | 'mirror' | 'slide'
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
      /** Glass on the outer face. x and y are from the top-left of the door, y downward. */
      mirror?: { x: number; y: number; width: number; height: number }
      /** Which piece of the cabinet this is, so a click can give it its own board. */
      piece?: string
    }
  | {
      /**
       * A bed's slat frame on a lift mechanism. It turns about a line across the bed at
       * (pivotY, pivotZ), so the foot end rises. Struts are the gas springs, drawn when the
       * mechanism has them: `a` is fixed to the bed, `b` rides on the frame (closed pose).
       */
      kind: 'lift'
      key: string
      pivotY: number
      pivotZ: number
      openDeg: number
      parts: { x: number; y: number; z: number; w: number; h: number; d: number; color: string }[]
      struts: { a: [number, number, number]; b: [number, number, number] }[]
      /** Steel that stays on the bed: the mechanism's base bar screwed to the side. */
      base?: { x: number; y: number; z: number; w: number; h: number; d: number; color: string }[]
      /** Steel arms of the mechanism, from a pin on the base bar (`a`) to a pin on the frame (`b`). */
      arms?: { a: [number, number, number]; b: [number, number, number] }[]
    }
  | {
      /**
       * Light behind a mirror: a soft glow on the board around the glass. (x, y, z, w, h) is the
       * glass, z the board's face. Clicking it in 3D switches it off and on.
       */
      kind: 'glow'
      key: string
      x: number
      y: number
      z: number
      w: number
      h: number
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
  | {
      kind: 'dim'
      label: string
      /** Drawing space: y grows downward, z toward the back. */
      x0: number
      y0: number
      z0: number
      x1: number
      y1: number
      z1: number
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
  if (solid.kind === 'dim') {
    return { ...solid, x0: solid.x0 + dx, y0: solid.y0 + dy, x1: solid.x1 + dx, y1: solid.y1 + dy }
  }
  if (solid.kind === 'door') return { ...solid, hingeX: solid.hingeX + dx, y: solid.y + dy }
  if (solid.kind === 'glow') return { ...solid, x: solid.x + dx, y: solid.y + dy }
  if (solid.kind === 'lift') {
    const shift = ([x, y, z]: [number, number, number]): [number, number, number] => [x + dx, y + dy, z]
    return {
      ...solid,
      pivotY: solid.pivotY + dy,
      parts: solid.parts.map((part) => ({ ...part, x: part.x + dx, y: part.y + dy })),
      struts: solid.struts.map((strut) => ({ a: shift(strut.a), b: shift(strut.b) })),
      base: solid.base?.map((part) => ({ ...part, x: part.x + dx, y: part.y + dy })),
      arms: solid.arms?.map((arm) => ({ a: shift(arm.a), b: shift(arm.b) })),
    }
  }
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
