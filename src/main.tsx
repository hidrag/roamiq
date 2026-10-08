import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppRouter from '@/router'
import { startAuthListener } from '@/stores/useAuthStore'
import { initTheme } from '@/stores/useThemeStore'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
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
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  </StrictMode>,
)
