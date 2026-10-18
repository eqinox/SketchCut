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

/** Nearest 0,5 мм. A decimal is only ,0 or ,5. */
export function halfMm(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 2) / 2
}

/** Millimetres on drawings and notes. Decimal mark is a comma. Not rounded up. */
export function formatMm(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const whole = Math.round(n)
  if (Math.abs(n - whole) < 1e-6) return String(whole)
  const milli = exactMm(n)
  if (Math.abs(n - milli) < 1e-6) return String(milli).replace('.', ',')
  const truncated = Math.trunc(n * 1000) / 1000
  return String(truncated).replace('.', ',')
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
