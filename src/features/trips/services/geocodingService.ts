/**
 * OpenStreetMap Nominatim geocoding service.
 *
 * Nominatim usage policy: identify the app via User-Agent, debounce queries,
 * and fail soft when the network is down.
 */

export interface GeocodeResult {
  label: string
  lat: number
  lng: number
  category: string
}

interface NominatimHit {
  display_name: string
  lat: string
  lon: string
  type?: string
  class?: string
  addresstype?: string
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const APP_USER_AGENT = 'RoamIQ-Travel-App'
/** Nominatim asks for max 1 request/second — callers debounce at 400ms+. */
export const GEOCODE_DEBOUNCE_MS = 400

function toLabel(hit: NominatimHit): string {
  const parts = hit.display_name.split(',').map((p) => p.trim())
  return parts.slice(0, 2).join(', ')
}

function mapHit(hit: NominatimHit): GeocodeResult | null {
  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {
    label: toLabel(hit),
    lat,
    lng,
    category: hit.addresstype ?? hit.type ?? hit.class ?? 'place',
  }
}

async function runSearch(query: string, limit: number, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const url = `${NOMINATIM_URL}?format=jsonv2&limit=${limit}&q=${encodeURIComponent(query)}`
  try {
    const response = await fetch(url, {
      signal,
      // Browsers treat User-Agent as a forbidden header and ignore it; the
      // header is still declared per Nominatim's usage policy for non-browser
      // callers, and Accept-Type below is what the browser actually sends.
      headers: { 'User-Agent': APP_USER_AGENT, Accept: 'application/json' },
    })
    if (!response.ok) return []
    const payload: unknown = await response.json()
    if (!Array.isArray(payload)) return []
    return payload
      .map((hit) =>
        typeof hit === 'object' && hit !== null ? mapHit(hit as NominatimHit) : null,
      )
      .filter((hit): hit is GeocodeResult => hit !== null)
  } catch {
    // Offline / aborted / rate-limited — degrade to an empty suggestion list.
    return []
  }
}

/** Type-ahead search (max 6). Never rejects; returns [] on any failure. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  return runSearch(q, 6, signal)
}

/** Single best match, or null. Never rejects. */
export async function geocodePlace(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult | null> {
  const q = query.trim()
  if (q.length < 2) return null
  const results = await runSearch(q, 1, signal)
  return results[0] ?? null
}
