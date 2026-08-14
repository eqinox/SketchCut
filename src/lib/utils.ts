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

export function formatMeters(meters: number): string {
  return `${meters.toFixed(2)} м`
}
