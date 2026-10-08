import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/useTripStore'
import { formatDate } from '@/lib/utils'
import type { Trip } from '@/types/database'

async function fetchTrip(tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase.from('trips').select('*').eq('id', tripId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data ?? null) as Trip | null
}

export function TripPlannerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tripTab = useTripStore((s) => s.tripTab)
  const setTripTab = useTripStore((s) => s.setTripTab)

  const query = useQuery({
    queryKey: ['trip', id],
    queryFn: () => fetchTrip(id!),
    enabled: Boolean(id),
  })

  if (query.isLoading) {
    return <div className="container py-16 text-center text-muted-foreground">Loading trip…</div>
  }

  if (query.isError || !query.data) {
    return (
      <div className="container flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-destructive">
          {query.isError ? `Could not load trip: ${query.error.message}` : 'Trip not found.'}
        </p>
        <Button variant="outline" onClick={() => navigate('/trips')}>
          <ArrowLeft className="h-4 w-4" />
          Back to trips
        </Button>
      </div>
    )
  }

  const trip = query.data

  return (
    <div className="container space-y-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate('/trips')}>
            <ArrowLeft className="h-4 w-4" />
            All trips
          </Button>
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {trip.destination}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
            </span>
          </div>
        </div>
      </div>

      <Tabs value={tripTab} onValueChange={(v) => setTripTab(v as typeof tripTab)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="vault">Vault</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="packing">Packing</TabsTrigger>
        </TabsList>

        <TabsContent value="itinerary">
          <Card>
            <CardHeader>
              <CardTitle>Itinerary</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Day-by-day stops will render here once itinerary items are added.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle>Map</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              The interactive map renders here once the trip has geo-located stops.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vault">
          <Card>
            <CardHeader>
              <CardTitle>Vault</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Tickets, bookings, and documents will be stored here.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle>Expenses</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Shared expenses and the split calculator will live here.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packing">
          <Card>
            <CardHeader>
              <CardTitle>Packing</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Your weather-aware packing checklist will appear here.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
