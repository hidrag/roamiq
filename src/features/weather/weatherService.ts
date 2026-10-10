/**
 * Open-Meteo forecast service (keyless).
 *
 * The forecast API serves roughly [yesterday, today+16]; requests outside that
 * window are clamped here and the widget renders an informative banner.
 */

export interface WeatherDay {
  date: string // ISO yyyy-mm-dd
  /** WMO weather code (0 clear … 99 thunderstorm). */
  code: number
  maxC: number
  minC: number
  /** 0-100, null when the API omits it. */
  precipitationChance: number | null
}

export interface TripWeatherResult {
  days: WeatherDay[]
  /** Set when the requested range extended outside the forecastable window. */
  notice: string | null
}

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
/** Open-Meteo forecast horizon (inclusive days from today). */
export const FORECAST_HORIZON_DAYS = 16

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

interface OpenMeteoDailyResponse {
  daily?: {
    time?: unknown
    weathercode?: unknown
    temperature_2m_max?: unknown
    temperature_2m_min?: unknown
    precipitation_probability_max?: unknown
  }
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map((v) => Number(v)) : []
}

/**
 * Fetch daily forecast covering the trip dates.
 *
 * - Dates beyond the 16-day horizon are excluded with a notice.
 * - Historical dates (before yesterday) cannot be forecast — noted likewise.
 * - Never throws for edge cases; only network/HTTP failures reject.
 */
export async function getTripWeather(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
): Promise<TripWeatherResult> {
  const today = new Date()
  const windowStart = addDays(today, -1)
  const windowEnd = addDays(today, FORECAST_HORIZON_DAYS)

  const requestedStart = new Date(`${startDate}T00:00:00Z`)
  const requestedEnd = new Date(`${endDate}T00:00:00Z`)

  let notice: string | null = null
  let queryStart = requestedStart
  let queryEnd = requestedEnd

  if (requestedStart < windowStart) {
    notice = 'Historical weather is unavailable — showing the forecast for upcoming trip days.'
    queryStart = windowStart
  }
  if (requestedEnd > windowEnd) {
    notice = `Forecast unavailable for dates beyond ${FORECAST_HORIZON_DAYS} days — showing the days in range.`
    queryEnd = windowEnd
  }

  // Entirely outside the forecastable window: return early, banner only.
  if (queryStart > queryEnd) {
    return {
      days: [],
      notice:
        requestedStart > windowEnd
          ? `Forecast unavailable for dates beyond ${FORECAST_HORIZON_DAYS} days.`
          : 'Historical weather is unavailable for these dates.',
    }
  }

  const url =
    `${FORECAST_ENDPOINT}?latitude=${lat}&longitude=${lng}` +
    '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=auto' +
    `&start_date=${isoDay(queryStart)}&end_date=${isoDay(queryEnd)}`

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`)

  const payload = (await response.json()) as OpenMeteoDailyResponse
  const daily = payload.daily
  const dates = Array.isArray(daily?.time) ? daily.time : []
  const codes = asNumberArray(daily?.weathercode)
  const highs = asNumberArray(daily?.temperature_2m_max)
  const lows = asNumberArray(daily?.temperature_2m_min)
  const precip = asNumberArray(daily?.precipitation_probability_max)

  const days: WeatherDay[] = []
  const count = Math.min(dates.length, codes.length, highs.length, lows.length)
  for (let i = 0; i < count; i++) {
    const date = String(dates[i])
    days.push({
      date,
      code: codes[i],
      maxC: highs[i],
      minC: lows[i],
      precipitationChance: Number.isFinite(precip[i]) ? precip[i] : null,
    })
  }

  if (days.length === 0 && !notice) {
    notice = 'No forecast rows returned for these dates.'
  }

  return { days, notice }
}

/** Group WMO codes into the icon buckets required by the spec. */
export type WeatherIconKind = 'sun' | 'cloud-sun' | 'rain' | 'snow' | 'thunder'

export function weatherIconKind(code: number): WeatherIconKind {
  if (code === 0 || code === 1) return 'sun'
  if (code >= 2 && code <= 3) return 'cloud-sun'
  if (code >= 51 && code <= 67) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 80 && code <= 82) return 'rain'
  if (code >= 95 && code <= 99) return 'thunder'
  if (code === 45 || code === 48) return 'cloud-sun'
  return 'cloud-sun'
}

export function weatherLabel(code: number): string {
  if (code === 0) return 'Clear sky'
  if (code <= 3) return 'Partly cloudy'
  if (code >= 51 && code <= 67) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Showers'
  if (code >= 95) return 'Thunderstorm'
  if (code === 45 || code === 48) return 'Fog'
  return 'Cloudy'
}
