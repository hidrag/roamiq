import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Search, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CreateTripModal } from '@/features/trips/components/CreateTripModal'

interface Destination {
  name: string
  country: string
  blurb: string
  lat: number
  lng: number
}

const DESTINATIONS: Destination[] = [
  { name: 'Kyoto', country: 'Japan', blurb: 'Temples, tea houses, and bamboo groves.', lat: 35.0116, lng: 135.7681 },
  { name: 'Lisbon', country: 'Portugal', blurb: 'Trams, tiled facades, and Atlantic sunsets.', lat: 38.7223, lng: -9.1393 },
  { name: 'Reykjavik', country: 'Iceland', blurb: 'Northern lights and geothermal lagoons.', lat: 64.1466, lng: -21.9426 },
  { name: 'Jaipur', country: 'India', blurb: 'Pink-city palaces and desert forts.', lat: 26.9124, lng: 75.7873 },
  { name: 'Queenstown', country: 'New Zealand', blurb: 'Adventure sports on alpine lakes.', lat: -45.0312, lng: 168.6626 },
  { name: 'Marrakesh', country: 'Morocco', blurb: 'Souks, riads, and Atlas foothills.', lat: 31.6295, lng: -7.9811 },
]

export function ExplorePage() {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [prefill, setPrefill] = useState<Destination | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return DESTINATIONS
    return DESTINATIONS.filter(
      (d) => d.name.toLowerCase().includes(q) || d.country.toLowerCase().includes(q),
    )
  }, [search])

  return (
    <div className="container space-y-6 py-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Explore destinations</h1>
          <p className="text-sm text-muted-foreground">
            Find your next stop — search by city or country.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search destinations…"
                className="pl-9"
                aria-label="Search destinations"
              />
            </div>
            <Button onClick={() => setModalOpen(true)}>
              <Sparkles className="h-4 w-4" />
              Plan a trip here
            </Button>
          </div>
        </div>

        <CreateTripModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          initialDestination={prefill?.name ?? ''}
          initialCoords={prefill ? { lat: prefill.lat, lng: prefill.lng } : undefined}
        />

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          No destinations match “{search}”.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <Card key={d.name} className="transition-shadow hover:shadow-md">
              <CardContent className="space-y-2 p-6">
                <h3 className="text-lg font-semibold">{d.name}</h3>
                <p className="text-sm text-muted-foreground">{d.country}</p>
                <p className="text-sm">{d.blurb}</p>
                <p className="text-xs text-muted-foreground">
                  {d.lat.toFixed(2)}, {d.lng.toFixed(2)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setPrefill(d)
                    setModalOpen(true)
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  Plan a trip here
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
