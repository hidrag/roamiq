import { useEffect, type ReactNode } from 'react'
import { useThemeStore } from '@/stores/useThemeStore'

/**
 * Guarantees the root `.dark` class matches the stored (or system) theme.
 * The pre-paint application happens in main.tsx (initTheme) to avoid flicker;
 * this provider owns ongoing system-preference and cross-tab sync.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applySystem = () => {
      const current = useThemeStore.getState().theme
      if (current !== 'system') return
      document.documentElement.classList.toggle('dark', media.matches)
    }

    // Cross-tab sync: another tab changed the stored theme.
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'roamiq-theme') void useThemeStore.persist.rehydrate()
    }

    media.addEventListener('change', applySystem)
    window.addEventListener('storage', handleStorage)
    applySystem()

    return () => {
      media.removeEventListener('change', applySystem)
      window.removeEventListener('storage', handleStorage)
    }
  }, [theme])

  return <>{children}</>
}
