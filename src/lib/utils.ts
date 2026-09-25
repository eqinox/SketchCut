import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function mmToMeters(mm: number): number {
  return mm / 1000
}

/** Drop binary noise; keep up to 0,001 мм. Never round to a whole millimetre. */
export function exactMm(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 1000) / 1000
}

/** Millimetres on drawings and notes: exact figure, Bulgarian decimal comma. */
export function formatMm(n: number): string {
  const t = exactMm(n)
  if (Number.isInteger(t)) return String(t)
  return String(t).replace('.', ',')
}

export function parseMm(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const s = String(raw ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.')
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return n
}

export function formatMeters(meters: number): string {
  return `${meters.toFixed(2)} м`
}
