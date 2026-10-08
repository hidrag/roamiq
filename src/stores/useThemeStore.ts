import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark))
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
    }),
    {
      name: 'roamiq-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    },
  ),
)

/** Apply the persisted theme as early as possible (call from main.tsx). */
export function initTheme() {
  const { theme } = useThemeStore.getState()
  applyTheme(theme)
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      const current = useThemeStore.getState().theme
      if (current === 'system') applyTheme('system')
    })
}
