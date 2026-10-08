import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { MapPin, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { formatDate } from '@/lib/utils'
import type { Trip } from '@/types/database'

async function fetchTrips(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .or(`owner_id.eq.${userId},id.in.(select trip_id from trip_members where user_id.eq.${userId})`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Trip[]
}

export function TripsPage() {
  const user = useAuthStore((s) => s.user)
  const query = useQuery({
    queryKey: ['trips', user?.id],
    queryFn: () => fetchTrips(user!.id),
    enabled: Boolean(user),
  })

  if (query.isLoading) {
    return <div className="container py-16 text-center text-muted-foreground">Loading your trips…</div>
  }

  if (query.isError) {
    return (
      <div className="container py-16 text-center text-destructive">
        Could not load trips: {query.error.message}
      </div>
    )
  }

  const trips = query.data ?? []

  return (
    <div className="container space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Trips</h1>
          <p className="text-sm text-muted-foreground">
            {trips.length === 0
              ? 'No trips yet — create your first one.'
              : `${trips.length} trip${trips.length === 1 ? '' : 's'} planned.`}
          </p>
        </div>
        <Button asChild>
          <Link to="/trips/new">
            <Plus className="h-4 w-4" />
            New trip
          </Link>
        </Button>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              Your trips will appear here once you create one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <Card key={trip.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="line-clamp-1">{trip.title}</CardTitle>
                <CardDescription className="line-clamp-1">{trip.destination}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
                </p>
                <p className="capitalize">{trip.status}</p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to={`/trips/${trip.id}`}>Open planner</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
