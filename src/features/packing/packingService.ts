import { supabase } from '@/lib/supabase'
import type { PackingItem, PackingItemInsert, PackingItemUpdate } from '@/types/database'

/** All packing_items reads/writes for the trip workspace. */

export const packingKeys = {
  list: (tripId: string) => ['packing', tripId] as const,
}

export async function fetchPackingItems(tripId: string): Promise<PackingItem[]> {
  const { data, error } = await supabase
    .from('packing_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('category', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as PackingItem[]
}

/**
 * The only columns `public.packing_items` accepts on insert. The table has
 * no created_by / source / updated_at — anything else sent here is a 400 from
 * the schema cache, so every write is allowlist-projected first.
 */
const PACKING_ALLOWED_COLUMNS = ['trip_id', 'category', 'item_name', 'is_packed'] as const satisfies ReadonlyArray<keyof PackingItemInsert>

/** Allowlist projection for packing writes; nullish values are omitted. */
function toSafePackingPayload(
  item: PackingItemInsert | PackingItemUpdate,
): Record<string, unknown> {
  const source = item as Record<string, unknown>
  const payload: Record<string, unknown> = {}
  for (const column of PACKING_ALLOWED_COLUMNS) {
    const value = source[column]
    if (value !== undefined && value !== null) {
      payload[column] = value
    }
  }
  return payload
}

export async function addPackingItem(item: PackingItemInsert): Promise<PackingItem> {
  const { data, error } = await supabase.from('packing_items').insert(toSafePackingPayload(item)).select().single()
  if (error) throw new Error(error.message)
  return data as PackingItem
}

export async function updatePackingItem(id: string, patch: PackingItemUpdate): Promise<void> {
  const { error } = await supabase.from('packing_items').update(toSafePackingPayload(patch)).eq('id', id)
  if (error) throw new Error(error.message)
}

/** Bulk is_packed flip (Pack All / Unpack All). */
export async function bulkSetPacked(ids: string[], isPacked: boolean): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from('packing_items')
    .update({ is_packed: isPacked })
    .in('id', ids)
  if (error) throw new Error(error.message)
}

/** Replace-the-list batch insert used by the AI generator (post-confirmation). */
export async function replacePackingItems(
  items: PackingItemInsert[],
): Promise<void> {
  if (items.length === 0) return
  const payload = items.map(toSafePackingPayload)
  const { error } = await supabase.from('packing_items').insert(payload)
  if (error) throw new Error(error.message)
}

export async function deletePackingItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('packing_items').delete().in('id', ids)
  if (error) throw new Error(error.message)
}
