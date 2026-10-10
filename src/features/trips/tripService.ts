import { supabase } from '@/lib/supabase'
import type {
  ItineraryItem,
  ItineraryItemInsert,
  ItineraryItemUpdate,
  Trip,
  TripInsert,
} from '@/types/database'

/**
 * All Supabase reads/writes for the trip workspace live here so UI components
 * only ever talk to TanStack Query hooks.
 */

export const tripKeys = {
  trips: (userId: string) => ['trips', userId] as const,
  trip: (tripId: string) => ['trip', tripId] as const,
  itinerary: (tripId: string) => ['itinerary', tripId] as const,
}

/**
 * The only columns `public.trips` accepts on insert. Anything else on the
 * caller's object (legacy fields, computed state) is dropped here so a stray
 * key can never trigger "column not found in the schema cache" again.
 */
const TRIP_ALLOWED_COLUMNS = [
  'owner_id',
  'title',
  'destination',
  'description',
  'start_date',
  'end_date',
  'budget',
  'currency',
  'lat',
  'lng',
  'is_public',
  'cover_image_url',
] as const satisfies ReadonlyArray<keyof TripInsert>

/** Allowlist projection; undefined/null values are omitted, not sent as null. */
export function toSafeTripPayload(trip: TripInsert): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const column of TRIP_ALLOWED_COLUMNS) {
    const value = trip[column]
    if (value !== undefined && value !== null) {
      payload[column] = value
    }
  }
  return payload
}

/** PostgREST schema-cache error: "Could not find the 'x' column of 'y' ...". */
function missingColumnName(message: string): string | null {
  return /Could not find the '([^']+)' column/.exec(message)?.[1] ?? null
}

/**
 * Trips the user owns OR collaborates on. PostgREST filters accept no SQL
 * subqueries, so the collaboration leg is resolved in two steps: fetch the
 * member trip ids, then filter with a literal uuid list.
 */
export async function fetchTrips(userId: string): Promise<Trip[]> {
  const { data: memberRows, error: memberError } = await supabase
    .from('trip_members')
    .select('trip_id')
    .eq('user_id', userId)
  if (memberError) {
    // Ownership trips should still load if the membership leg fails.
    console.warn('[trips] could not fetch member trips:', memberError.message)
  }

  const memberTripIds = (memberRows ?? [])
    .map((row) => row.trip_id as string)
    .filter(Boolean)

  let query = supabase.from('trips').select('*')
  if (memberTripIds.length > 0) {
    query = query.or(`owner_id.eq.${userId},id.in.(${memberTripIds.join(',')})`)
  } else {
    query = query.eq('owner_id', userId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Trip[]
}

export async function fetchTrip(tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase.from('trips').select('*').eq('id', tripId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data ?? null) as Trip | null
}

export async function fetchItineraryItems(tripId: string): Promise<ItineraryItem[]> {
  const { data, error } = await supabase
    .from('itinerary_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('day_number', { ascending: true })
    .order('order_index', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ItineraryItem[]
}

/**
 * The only columns `public.itinerary_items` accepts on insert (strict audit):
 * trip_id, day_number, time_slot, title, description, location_name, lat, lng,
 * estimated_cost, order_index (plus server-managed id/created_at).
 */
const ITINERARY_ALLOWED_COLUMNS = [
  'trip_id',
  'day_number',
  'time_slot',
  'title',
  'description',
  'location_name',
  'lat',
  'lng',
  'estimated_cost',
  'order_index',
] as const satisfies ReadonlyArray<keyof ItineraryItemInsert>

/** Allowlist projection for itinerary writes; nullish values are omitted. */
export function toSafeItineraryPayload(
  item: ItineraryItemInsert | ItineraryItemUpdate,
): Record<string, unknown> {
  const source = item as Record<string, unknown>
  const payload: Record<string, unknown> = {}
  for (const column of ITINERARY_ALLOWED_COLUMNS) {
    const value = source[column]
    if (value !== undefined && value !== null) {
      payload[column] = value
    }
  }
  return payload
}

/** Insert the trip and (optionally) its itinerary items as one user-facing action. */
export async function createTripWithItems(
  trip: TripInsert,
  items: ItineraryItemInsert[],
): Promise<Trip> {
  const payload = toSafeTripPayload(trip)
  let { data, error } = await supabase
    .from('trips')
    .insert(payload)
    .select()
    .single()

  // Defense-in-depth: if PostgREST names an unregistered column (schema drift,
  // e.g. `description` missing on an older database), drop it and retry once
  // so the insert still succeeds without a schema-cache failure.
  if (error) {
    const missing = missingColumnName(error.message)
    if (missing && missing in payload) {
      console.warn(`[trips] dropping unregistered column "${missing}" and retrying insert`)
      delete payload[missing]
      ;({ data, error } = await supabase
        .from('trips')
        .insert(payload)
        .select()
        .single())
    }
  }
  if (error) throw new Error(error.message)

  const tripId = (data as Trip).id
  if (items.length > 0) {
    // Allowlist-project each row, then stamp the real trip id.
    const stamped = items.map((item) => {
      const payload = toSafeItineraryPayload(item)
      payload['trip_id'] = tripId
      return payload
    })
    const { error: itemsError } = await supabase.from('itinerary_items').insert(stamped)
    if (itemsError) {
      // Roll the trip back so the user never sees a half-populated trip.
      await supabase.from('trips').delete().eq('id', tripId)
      throw new Error(itemsError.message)
    }
  }
  return data as Trip
}

export async function addItineraryItem(item: ItineraryItemInsert): Promise<ItineraryItem> {
  const { data, error } = await supabase
    .from('itinerary_items')
    .insert(toSafeItineraryPayload(item))
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ItineraryItem
}

export async function updateItineraryItem(
  id: string,
  patch: ItineraryItemUpdate,
): Promise<ItineraryItem> {
  const { data, error } = await supabase
    .from('itinerary_items')
    .update(toSafeItineraryPayload(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ItineraryItem
}

export async function deleteItineraryItem(id: string): Promise<void> {
  const { error } = await supabase.from('itinerary_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
