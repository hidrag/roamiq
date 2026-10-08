/** Open-Meteo current-weather wrapper (no API key required). */

export interface CurrentWeather {
  temperature: number
  windSpeed: number
  weatherCode: number
}

const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Moderate showers',
  82: 'Violent showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail',
}

export function describeWeatherCode(code: number): string {
  return WEATHER_CODES[code] ?? 'Unknown'
}

export async function fetchCurrentWeather(lat: number, lng: number): Promise<CurrentWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    '&current=temperature_2m,wind_speed_10m,weather_code'
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`)
  const payload: unknown = await response.json()
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Weather response was malformed.')
  }
  const current = (payload as { current?: Record<string, unknown> }).current
  const temperature = current?.temperature_2m
  const windSpeed = current?.wind_speed_10m
  const weatherCode = current?.weather_code
  if (typeof temperature !== 'number' || typeof windSpeed !== 'number' || typeof weatherCode !== 'number') {
    throw new Error('Weather response was missing fields.')
  }
  return { temperature, windSpeed, weatherCode }
}
