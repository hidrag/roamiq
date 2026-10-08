import { Outlet } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        RoamIQ — plan smarter, travel better.
      </footer>
    </div>
  )
}
