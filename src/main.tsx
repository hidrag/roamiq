import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppRouter from '@/router'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { startAuthListener } from '@/stores/useAuthStore'
import { initTheme } from '@/stores/useThemeStore'
import './index.css'
import './styles/print.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      // Offline resilience: attempt, then fall back to cached data.
      networkMode: 'offlineFirst',
      gcTime: 1000 * 60 * 60 * 24, // keep trip data cached for 24 h
    },
  },
})

// Apply the persisted theme before first paint to avoid a flash.
initTheme()

// Wire Supabase auth events into the Zustand store; returns an unsubscribe fn.
const unsubscribeAuth = startAuthListener()
if (import.meta.hot) {
  import.meta.hot.dispose(() => unsubscribeAuth())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AppRouter />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
