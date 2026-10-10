import { Outlet } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { OfflineBanner } from '@/components/OfflineBanner'
import { Toaster } from '@/components/ui/toast'

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="no-print border-t py-6 text-center text-sm text-muted-foreground">
        RoamIQ — plan smarter, travel better.
      </footer>
      <OfflineBanner />
      <Toaster />
    </div>
  )
}
