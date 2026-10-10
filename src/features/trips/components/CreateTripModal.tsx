import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, Loader2, MapPin, RefreshCw, Sparkles, Wand2, XCircle } from 'lucide-react'
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
import {
  MAX_TRIP_DAYS,
  PACES,
  TRAVEL_STYLES,
  type PaceId,
  type TravelStyle,
} from '@/features/ai/schemas/itinerarySchema'
import { ItineraryError, generateTripItinerary } from '@/features/ai/services/geminiService'
import { searchPlaces, type GeocodeResult } from '@/features/trips/services/geocodingService'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { createTripWithItems, tripKeys } from '@/features/trips/tripService'
import { useAuthStore } from '@/stores/useAuthStore'
import { errorMessage } from '@/lib/utils'
import type { ItineraryItemInsert, TripInsert } from '@/types/database'

interface CreateTripModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDestination?: string
  initialCoords?: { lat: number; lng: number }
}

type Step = 1 | 2 | 3
type TripMode = 'ai' | 'custom'

const LOADING_MESSAGES = [
  'Analyzing destination landmarks...',
  'Structuring day-by-day pacing...',
  'Mapping geographic coordinates & routes...',
  'Finalizing your personalized plan...',
] as const

export function CreateTripModal({
  open,
  onOpenChange,
  initialDestination = '',
  initialCoords,
}: CreateTripModalProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)

  const [step, setStep] = useState<Step>(1)
  const [destination, setDestination] = useState(initialDestination)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(initialCoords ?? null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState(1200)
  const [currency, setCurrency] = useState('USD')
  const [travelStyle, setTravelStyle] = useState<TravelStyle>('Budget')
  const [pace, setPace] = useState<PaceId>('balanced')
  const [mode, setMode] = useState<TripMode>('ai')
  const [customTitle, setCustomTitle] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const reset = () => {
    setStep(1)
    setDestination(initialDestination)
    setCoords(initialCoords ?? null)
    setStartDate('')
    setEndDate('')
    setFormError(null)
  }

  const durationInDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    const start = new Date(`${startDate}T00:00:00`)
    const end = new Date(`${endDate}T00:00:00`)
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
    return Number.isFinite(days) && days >= 1 ? days : 0
  }, [startDate, endDate])

  const dateError =
    durationInDays > MAX_TRIP_DAYS ? `Trips are capped at ${MAX_TRIP_DAYS} days in this MVP.` : null
  const stepOneValid = destination.trim().length >= 2 && durationInDays >= 1 && !dateError

  const createTrip = useMutation({
    mutationFn: async (modeChosen: TripMode): Promise<string> => {
      if (!userId) throw new ItineraryError('unknown', 'You must be signed in to create a trip.')
      if (!destination.trim() || durationInDays < 1) {
        throw new ItineraryError('unknown', 'Pick a destination and valid dates first.')
      }

      const itinerary =
        modeChosen === 'ai'
          ? await generateTripItinerary({
              destination,
              durationInDays,
              budgetTotal: budget,
              currency,
              travelStyle,
              pace,
            })
          : null

      const title = itinerary?.tripTitle ?? (customTitle.trim() || `${destination} trip`)
      // Exactly the 12 registered public.trips columns — no ad-hoc fields.
      const trip: TripInsert = {
        owner_id: userId,
        title,
        destination: destination.trim(),
        description: itinerary?.destinationSummary,
        start_date: startDate || null,
        end_date: endDate || null,
        budget: itinerary?.estimatedTotalBudget ?? budget,
        currency,
        lat: coords?.lat ?? undefined,
        lng: coords?.lng ?? undefined,
        is_public: false,
        cover_image_url: null,
      }

      const items: ItineraryItemInsert[] = itinerary
        ? itinerary.days.flatMap((day) =>
            day.activities.map((activity) => ({
              trip_id: '', // stamped with the real trip id inside createTripWithItems
              day_number: day.dayNumber,
              time_slot: activity.timeSlot,
              title: activity.title,
              description: activity.description,
              location_name: activity.locationName,
              lat: activity.lat,
              lng: activity.lng,
              estimated_cost: activity.estimatedCost,
              order_index: activity.orderIndex,
            })),
          )
        : []

      const created = await createTripWithItems(trip, items)
      return created.id
    },
    onSuccess: (tripId) => {
      if (userId) void queryClient.invalidateQueries({ queryKey: tripKeys.trips(userId) })
      onOpenChange(false)
      reset()
      navigate(`/trips/${tripId}`, { replace: true })
    },
    onError: (error) => {
      // Typed, friendly message; the modal stays open so the user can retry
      // or fall back to an empty trip — never an unhandled rejection.
      setFormError(error instanceof ItineraryError ? error.message : errorMessage(error))
    },
  })

  const fallbackEmpty = () => createTrip.mutate('custom')
  const retryAi = () => createTrip.mutate('ai')

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset()
          createTrip.reset()
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Plan a new trip</DialogTitle>
          <DialogDescription>
            Step {step} of 3 —{' '}
            {step === 1 ? 'destination & dates' : step === 2 ? 'budget & style' : 'how should we build it?'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <DestinationStep
            destination={destination}
            onDestinationChange={(value, pickedCoords) => {
              setDestination(value)
              if (pickedCoords) setCoords(pickedCoords)
            }}
            startDate={startDate}
            onStartDateChange={(v) => {
              setStartDate(v)
              if (endDate && v > endDate) setEndDate('')
            }}
            endDate={endDate}
            onEndDateChange={setEndDate}
            durationError={dateError}
          />
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="trip-budget">Budget total</Label>
                <Input
                  id="trip-budget"
                  type="number"
                  min={0}
                  value={budget}
                  onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trip-currency">Currency</Label>
                <select
                  id="trip-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-white dark:bg-slate-900 text-foreground dark:text-slate-100 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <ChipGroup<TravelStyle>
              legend="Travel style"
              options={TRAVEL_STYLES}
              value={travelStyle}
              onChange={setTravelStyle}
            />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium leading-none">Pacing</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {PACES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={pace === option.id}
                    onClick={() => setPace(option.id)}
                    className={
                      pace === option.id
                        ? 'flex flex-col items-start rounded-lg border-2 border-primary bg-primary/10 px-3 py-2 text-left'
                        : 'flex flex-col items-start rounded-lg border border-input px-3 py-2 text-left hover:bg-accent'
                    }
                  >
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.spotsPerDay}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {mode === 'custom' && !createTrip.isPending && (
              <div className="space-y-2">
                <Label htmlFor="custom-title">Trip title (optional)</Label>
                <Input
                  id="custom-title"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value.slice(0, 120))}
                  placeholder={`${destination || 'My'} adventure`}
                />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <ModeCard
                active={mode === 'ai'}
                onClick={() => !createTrip.isPending && setMode('ai')}
                icon={<Sparkles className="h-5 w-5 text-primary" />}
                title="Generate AI itinerary"
                subtitle={`${durationInDays || '—'} days · ${pace} ${travelStyle}`}
              />
              <ModeCard
                active={mode === 'custom'}
                onClick={() => !createTrip.isPending && setMode('custom')}
                icon={<MapPin className="h-5 w-5 text-primary" />}
                title="Empty itinerary"
                subtitle="Add every stop yourself"
              />
            </div>

            {createTrip.isPending && mode === 'ai' && <GenerationProgress />}

            {formError && !createTrip.isPending && (
              <div
                className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-2">
                  <p>{formError}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={retryAi}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry AI
                    </Button>
                    <Button size="sm" variant="ghost" onClick={fallbackEmpty}>
                      Create empty trip instead
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(2)} disabled={createTrip.isPending}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => createTrip.mutate(mode)}
                disabled={createTrip.isPending || !stepOneValid || budget <= 0}
              >
                {createTrip.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === 'ai' ? 'Create with AI' : 'Create trip'}
              </Button>
            </div>
          </div>
        )}

        {step < 3 && (
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={step === 1 ? !stepOneValid : budget <= 0}
            >
              Next
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */

interface DestinationStepProps {
  destination: string
  onDestinationChange: (value: string, coords?: { lat: number; lng: number }) => void
  startDate: string
  onStartDateChange: (v: string) => void
  endDate: string
  onEndDateChange: (v: string) => void
  durationError: string | null
}

function DestinationStep({
  destination,
  onDestinationChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  durationError,
}: DestinationStepProps) {
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [openSuggestions, setOpenSuggestions] = useState(false)
  const debounced = useDebouncedValue(destination, 400)
  const containerRef = useRef<HTMLDivElement>(null)
  const ignoreBlur = useRef(false)

  useEffect(() => {
    if (debounced.trim().length < 3) {
      setResults([])
      return
    }
    const controller = new AbortController()
    void searchPlaces(debounced, controller.signal).then(setResults)
    return () => controller.abort()
  }, [debounced])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenSuggestions(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="relative space-y-2" ref={containerRef}>
        <Label htmlFor="trip-destination">Destination</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="trip-destination"
            className="pl-9"
            placeholder="City, region, or landmark…"
            value={destination}
            autoComplete="off"
            onChange={(e) => {
              onDestinationChange(e.target.value.slice(0, 80))
              setOpenSuggestions(true)
            }}
            onFocus={() => results.length > 0 && setOpenSuggestions(true)}
            onBlur={() => {
              if (ignoreBlur.current) {
                ignoreBlur.current = false
                return
              }
              setOpenSuggestions(false)
            }}
          />
        </div>
        {openSuggestions && results.length > 0 && (
          <ul className="absolute left-0 right-0 z-10 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            {results.map((r) => (
              <li key={`${r.lat}:${r.lng}:${r.label}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  onMouseDown={() => {
                    ignoreBlur.current = true
                  }}
                  onClick={() => {
                    onDestinationChange(r.label, { lat: r.lat, lng: r.lng })
                    setOpenSuggestions(false)
                  }}
                >
                  <span className="flex-1 truncate">{r.label}</span>
                  <span className="text-xs capitalize text-muted-foreground">{r.category}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="trip-start">Start date</Label>
          <Input
            id="trip-start"
            type="date"
            min={today}
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trip-end">End date</Label>
          <Input
            id="trip-end"
            type="date"
            min={startDate || today}
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
      </div>
      {durationError && <p className="text-sm text-destructive">{durationError}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function ChipGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: readonly T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium leading-none">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={
              value === option
                ? 'rounded-full border border-primary bg-primary/10 px-3 py-1 text-sm font-medium text-primary'
                : 'rounded-full border border-input px-3 py-1 text-sm text-muted-foreground hover:bg-accent'
            }
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? 'flex flex-col items-start gap-1 rounded-xl border-2 border-primary bg-primary/5 p-4 text-left'
          : 'flex flex-col items-start gap-1 rounded-xl border border-input p-4 text-left hover:border-primary/50'
      }
    >
      <span className="flex items-center gap-2">
        {icon}
        <span className="font-semibold">{title}</span>
        {active && <Check className="h-4 w-4 text-primary" />}
      </span>
      <span className="text-xs text-muted-foreground">{subtitle}</span>
    </button>
  )
}

/** Cycles through the phased status copy while the AI call is in flight. */
function GenerationProgress() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1)),
      1700,
    )
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="space-y-2 rounded-lg border bg-muted/40 p-4" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <Wand2 className="h-4 w-4 animate-pulse text-primary" />
        <div className="space-y-1.5">
          {LOADING_MESSAGES.map((label, i) => (
            <div
              key={label}
              className={
                i > index
                  ? 'text-xs text-muted-foreground/50'
                  : 'flex items-center gap-2 text-xs text-foreground'
              }
            >
              {i < index ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <span className="inline-block h-3 w-3">
                  {i === index && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                </span>
              )}
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
