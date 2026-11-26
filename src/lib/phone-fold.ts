import { useState } from 'react'

const KEY = 'sketchcut:fold:'

/**
 * On a phone the long sections of the page (sheets, parts, cabinets, room, drawing) fold to their
 * title with a tap, so the page is not one endless scroll. The choice is kept on this device.
 * On a wider screen everything is always open.
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
  return { open, toggle, body: open ? 'contents' : 'hidden md:contents' }
}
