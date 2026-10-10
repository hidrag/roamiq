import { useEffect, useState } from 'react'
import { CheckCircle2, X, XCircle } from 'lucide-react'
import { create } from 'zustand'
import { cn } from '@/lib/utils'

/**
 * Dependency-free toast system:
 * `toast.success('Activity added')` from anywhere; <Toaster /> renders the
 * stack once (mounted in AppLayout).
 */

export type ToastKind = 'success' | 'error'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  push: (kind: ToastKind, message: string) => void
  dismiss: (id: number) => void
}

const AUTO_DISMISS_MS = 3400
let nextId = 1

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, kind, message }] }))
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, AUTO_DISMISS_MS)
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon = item.kind === 'success' ? CheckCircle2 : XCircle
  return (
    <div
      role={item.kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex w-80 items-start gap-2 rounded-lg border bg-popover p-3 text-sm shadow-lg',
        item.kind === 'success'
          ? 'border-green-500/40 text-foreground'
          : 'border-destructive/50 text-foreground',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          item.kind === 'success' ? 'text-green-500' : 'text-destructive',
        )}
      />
      <span className="flex-1">{item.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/** Fixed toast stack — mount once near the app root. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="no-print pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
      ))}
    </div>
  )
}
