import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/stores/useThemeStore'

/** Cycles light -> dark -> system, persisting the choice. */
export function ModeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const label = theme === 'system' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light'

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Theme: ${label}. Switch to ${next}.`}
      title={`Theme: ${label}`}
      onClick={() => setTheme(next)}
    >
      {theme === 'dark' ? (
        <Moon className="h-4 w-4" />
      ) : theme === 'light' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <>
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </>
      )}
    </Button>
  )
}
