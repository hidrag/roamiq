import { useEffect, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TIME_SLOTS, type TimeSlot } from '@/features/ai/schemas/itinerarySchema'
import { geocodePlace, type GeocodeResult } from '@/features/trips/services/geocodingService'
import { errorMessage } from '@/lib/utils'
import type { ItineraryItem } from '@/types/database'

export interface ActivityFormValues {
  title: string
  description: string | null
  day_number: number
  slot: TimeSlot
  location_name: string
  lat: number
  lng: number
  cost_estimate: number | null
}

interface ActivityFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the form edits this item; otherwise creates a new one. */
  item?: ItineraryItem | null
  defaultDay: number
  /** Largest existing day number, so "next day" suggestions stay sane. */
  maxHighestDay: number
  saving: boolean
  error: unknown
  onSubmit: (values: ActivityFormValues) => void
}

const SLOT_LABELS: Record<TimeSlot, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

export function ActivityFormDialog({
  open,
  onOpenChange,
  item,
  defaultDay,
  maxHighestDay,
  saving,
  error,
  onSubmit,
}: ActivityFormDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dayNumber, setDayNumber] = useState(defaultDay)
  const [slot, setSlot] = useState<TimeSlot>('morning')
  const [locationName, setLocationName] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [cost, setCost] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  // Re-seed the form whenever it opens (create) or targets another item (edit).
  useEffect(() => {
    if (!open) return
    setTitle(item?.title ?? '')
    setDescription(item?.description ?? '')
    setDayNumber(item?.day_number ?? defaultDay)
    setSlot(item?.time_slot ?? 'morning')
    setLocationName(item?.location_name ?? '')
    setCoords(
      item?.lat != null && item?.lng != null ? { lat: item.lat, lng: item.lng } : null,
    )
    setCost(item?.estimated_cost != null ? String(item.estimated_cost) : '')
    setGeoError(null)
  }, [open, item, defaultDay])

  const handleGeocode = async () => {
    const query = (title || locationName).trim()
    if (query.length < 3) {
      setGeoError('Enter a place/name to locate first.')
      return
    }
    setGeocoding(true)
    setGeoError(null)
    try {
      const hit: GeocodeResult | null = await geocodePlace(query)
      if (!hit) setGeoError('No match found — enter coordinates manually.')
      else {
        setCoords({ lat: hit.lat, lng: hit.lng })
        if (!locationName) setLocationName(hit.label)
      }
    } catch (err) {
      setGeoError(errorMessage(err))
    } finally {
      setGeocoding(false)
    }
  }

  const canSubmit = title.trim().length > 0 && locationName.trim().length > 0 && coords !== null

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit || !coords) return
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      day_number: Math.max(1, dayNumber),
      slot,
      location_name: locationName.trim(),
      lat: coords.lat,
      lng: coords.lng,
      cost_estimate: cost.trim() === '' ? null : Math.max(0, Number(cost) || 0),
    })
  }

  const highestDay = Math.max(maxHighestDay, defaultDay)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit activity' : 'Add activity'}</DialogTitle>
          <DialogDescription>
            Pin a real place on the map — it syncs straight into your itinerary.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="activity-title">Title</Label>
            <Input
              id="activity-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sunset at the old fortress"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity-location">Location name</Label>
            <div className="flex gap-2">
              <Input
                id="activity-location"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Citadel of Aleppo, Syria"
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleGeocode}
                disabled={geocoding}
                aria-label="Geocode this location"
                title="Find coordinates via OpenStreetMap"
              >
                {geocoding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </Button>
            </div>
            {coords && (
              <p className="text-xs text-muted-foreground">
                Pinned at {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </p>
            )}
            {geoError && <p className="text-xs text-destructive">{geoError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="activity-day">Day</Label>
              <Input
                id="activity-day"
                type="number"
                min={1}
                max={highestDay + 7}
                value={dayNumber}
                onChange={(e) => setDayNumber(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-slot">Time slot</Label>
              <select
                id="activity-slot"
                value={slot}
                onChange={(e) => setSlot(e.target.value as TimeSlot)}
                className="flex h-9 w-full rounded-md border border-input bg-white dark:bg-slate-900 text-foreground dark:text-slate-100 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {TIME_SLOTS.map((option) => (
                  <option key={option} value={option}>
                    {SLOT_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity-cost">Estimated cost (USD, optional)</Label>
            <Input
              id="activity-cost"
              type="number"
              min={0}
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="25"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity-description">Notes (optional)</Label>
            <textarea
              id="activity-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Why this stop, booking tips…"
            />
          </div>

          {error != null && error !== false && error !== '' && (
            <p className="text-sm text-destructive">{errorMessage(error)}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {item ? 'Save changes' : 'Add to trip'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
