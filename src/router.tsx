import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { LandingPage } from '@/features/landing/LandingPage'
import { ExplorePage } from '@/features/explore/ExplorePage'
import { AuthPage } from '@/features/auth/AuthPage'
import { TripsPage } from '@/features/trips/TripsPage'
import { TripPlannerPage } from '@/features/trips/TripPlannerPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/trips"
          element={
            <AuthGuard>
              <TripsPage />
            </AuthGuard>
          }
        />
        <Route
          path="/trips/:id"
          element={
            <AuthGuard>
              <TripPlannerPage />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

/** App root router. BrowserRouter lives here so tests can wrap AppRoutes directly. */
export default function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
