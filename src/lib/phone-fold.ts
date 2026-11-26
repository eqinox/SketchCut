import { useState } from 'react'

const KEY = 'sketchcut:fold:'

/**
 * The long sections of the page (sheets, parts, cabinets, room, drawing) fold to their title with
 * a click or tap, so the page is not one endless scroll. The choice is kept on this device.
 */
export function usePhoneFold(id: string) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(KEY + id) !== 'closed'
    } catch {
      return true
    }
  })
  const toggle = () => {
    setOpen((was) => {
      const next = !was
      try {
        localStorage.setItem(KEY + id, next ? 'open' : 'closed')
      } catch {
        // Private mode: it just is not remembered.
      }
      return next
    })
  }
  // `contents` keeps the section's own spacing between its children.
  return { open, toggle, body: open ? 'contents' : 'hidden' }
}
