import { Vector3, type Camera } from 'three'

/**
 * A small label that sits next to a point of the 3D picture (the tool at work, the piece being
 * put in): what the job is, how long it takes and what it costs.
 */
export type ToolTag = {
  /** Shows `text` beside `at` (world space), or hides the label when either is null. */
  place(text: string | null, at: Vector3 | null, camera: Camera): void
  dispose(): void
}

/** `minTop` keeps the label below whatever sits at the top of the picture (the running total). */
export function createToolTag(host: HTMLElement, minTop = 6): ToolTag {
  const el = document.createElement('div')
  el.className =
    'pointer-events-none absolute left-0 top-0 z-10 max-w-[260px] rounded-md bg-white/95 px-2 py-1 text-xs font-medium leading-snug text-neutral-900 shadow-md ring-1 ring-neutral-300'
  el.style.display = 'none'
  host.appendChild(el)
  let shown = ''
  const point = new Vector3()
  return {
    place(text, at, camera) {
      if (!text || !at) {
        el.style.display = 'none'
        return
      }
      point.copy(at).project(camera)
      // Behind the camera or far off the picture: nothing to point at.
      if (point.z > 1 || Math.abs(point.x) > 1.3 || Math.abs(point.y) > 1.3) {
        el.style.display = 'none'
        return
      }
      if (text !== shown) {
        el.textContent = text
        shown = text
      }
      el.style.display = 'block'
      const width = host.clientWidth
      const height = host.clientHeight
      // Up and to the right of the point, kept inside the picture.
      const x = Math.min(width - el.offsetWidth - 6, Math.max(6, ((point.x + 1) / 2) * width + 22))
      const y = Math.min(height - el.offsetHeight - 6, Math.max(minTop, ((1 - point.y) / 2) * height - el.offsetHeight - 14))
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
    },
    dispose() {
      el.remove()
    },
  }
}
