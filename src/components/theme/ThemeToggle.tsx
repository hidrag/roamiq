import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/stores/useThemeStore'

const NEXT: Record<string, string> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

const LABEL: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Auto',
}

/** Cycles light → dark → system; preference persists via zustand/persist. */
export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  const next = NEXT[theme] ?? 'system'

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next]}.`}
      title={`Theme: ${LABEL[theme]}`}
      onClick={() => setTheme(next as 'light' | 'dark' | 'system')}
    >
      {theme === 'dark' ? (
        <Moon className="h-4 w-4" />
      ) : theme === 'light' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Monitor className="h-4 w-4" />
      )}
    </Button>
  )
}
