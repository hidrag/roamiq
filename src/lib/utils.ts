import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Round to 2 decimal places — never accumulate raw floats for money. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Sum a list of money amounts safely (rounds each addend, rounds the total). */
export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((total, value) => total + roundMoney(value), 0))
}

/** Normalize a display title for safe rendering (strips markup characters). */
export function sanitizeDisplayTitle(raw: string): string {
  return raw.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160)
}

/** Format an ISO date string as e.g. "12 Nov 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Format a cent-free amount as currency, e.g. "₹1,250" / "$42.00". */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Normalize a Supabase error into a human-readable string. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Something went wrong. Please try again.'
}
