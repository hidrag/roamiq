import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Info,
  Sun,
} from 'lucide-react'
import {
  getTripWeather,
  weatherIconKind,
  weatherLabel,
  type WeatherIconKind,
} from '@/features/weather/weatherService'
import { cn } from '@/lib/utils'

interface WeatherWidgetProps {
  lat: number
  lng: number
  startDate: string | null
  endDate: string | null
  className?: string
}

const UNIT_KEY = 'roamiq-temp-unit'
type TempUnit = 'C' | 'F'

function toF(celsius: number): number {
  return celsius * 1.8 + 32
}

function Icon({ kind, className }: { kind: WeatherIconKind; className?: string }) {
  const props = { className, 'aria-hidden': true as const }
  switch (kind) {
    case 'sun':
      return <Sun {...props} />
    case 'cloud-sun':
      return <CloudSun {...props} />
    case 'rain':
      return <CloudRain {...props} />
    case 'snow':
      return <CloudSnow {...props} />
    case 'thunder':
      return <CloudLightning {...props} />
  }
}

/**
 * Compact horizontal forecast strip docked in the trip header.
 * Cached 1h via TanStack Query (spec); degrades to a banner on any failure.
 */
export function WeatherWidget({ lat, lng, startDate, endDate, className }: WeatherWidgetProps) {
  const [unit, setUnit] = useState<TempUnit>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem(UNIT_KEY) === 'F' ? 'F' : 'C',
  )

  useEffect(() => {
    window.localStorage.setItem(UNIT_KEY, unit)
  }, [unit])

  const query = useQuery({
    queryKey: ['weather', lat, lng, startDate, endDate],
    queryFn: () => getTripWeather(lat, lng, startDate ?? '', endDate ?? ''),
    enabled: Boolean(startDate && endDate),
    staleTime: 60 * 60 * 1000, // 1 hour per spec
    retry: 1,
  })

  if (!startDate || !endDate) return null

  const fmt = (celsius: number) =>
    `${Math.round(unit === 'C' ? celsius : toF(celsius))}°${unit}`

  const notice = query.data?.notice ?? null

  return (
    <section
      className={cn('space-y-2', className)}
      aria-label="Trip weather forecast"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Weather
        </h3>
        <button
          type="button"
          className="rounded-full border border-input px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent"
          onClick={() => setUnit((u) => (u === 'C' ? 'F' : 'C'))}
          aria-label={`Switch to degrees ${unit === 'C' ? 'Fahrenheit' : 'Celsius'}`}
        >
          °{unit}
        </button>
      </div>

      {notice && (
        <p className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {notice}
        </p>
      )}

      {query.isPending && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 w-24 shrink-0 animate-pulse rounded-lg border bg-muted"
            />
          ))}
        </div>
      )}

      {query.isError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Forecast unavailable right now — check your connection.
        </p>
      )}

      {query.data && query.data.days.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {query.data.days.map((day) => (
            <div
              key={day.date}
              className="flex w-24 shrink-0 flex-col items-center gap-1 rounded-lg border bg-card px-2 py-2 text-center"
              title={weatherLabel(day.code)}
            >
              <span className="text-[11px] text-muted-foreground">
                {new Date(`${day.date}T00:00:00`).toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                })}
              </span>
              <Icon
                kind={weatherIconKind(day.code)}
                className="h-5 w-5 text-primary"
              />
              <span className="text-xs font-medium">
                {fmt(day.maxC)} <span className="text-muted-foreground">{fmt(day.minC)}</span>
              </span>
              <span className="text-[10px] text-muted-foreground">
                {day.precipitationChance != null ? `${Math.round(day.precipitationChance)}% rain` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
