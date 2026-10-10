import type { Json } from './json'

export type TripVisibility = 'private' | 'shared' | 'public'
export type TripStatus = 'planning' | 'active' | 'completed' | 'archived'
export type TripMemberRole = 'owner' | 'editor' | 'viewer'
export type TripMemberStatus = 'invited' | 'accepted' | 'declined'
/** Itinerary slots accepted by public.itinerary_items.time_slot (strict). */
export type ItinerarySlot = 'morning' | 'afternoon' | 'evening'
export type ItineraryItemType =
  | 'sight'
  | 'food'
  | 'transport'
  | 'stay'
  | 'activity'
  | 'other'
/** AI packing categories (Phase 3 spec — exact casing). */
export type PackingCategory =
  | 'Clothes'
  | 'Toiletries'
  | 'Electronics'
  | 'Documents & Money'
  | 'Health & Meds'
  | 'Activity Gear'
export type ExpenseCategory = 'Stay' | 'Food' | 'Transport' | 'Activity' | 'Miscellaneous'
export type DocumentKind = 'ticket' | 'booking' | 'insurance' | 'id' | 'note' | 'other'

export interface Profile {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  home_city: string | null
  created_at: string
  updated_at: string
}

/**
 * Canonical public.trips columns (verified against the live schema cache):
 * owner_id, title, destination, description, start_date, end_date, budget,
 * currency, lat, lng, is_public, cover_image_url.
 */
export interface Trip {
  id: string
  owner_id: string
  title: string
  destination: string
  /** Optional — destination summary or user notes; omitted when absent. */
  description?: string
  start_date: string | null
  end_date: string | null
  budget?: number
  /** Legacy read-only alias; never written by current inserts. */
  budget_total?: number
  currency: string
  lat?: number | null
  lng?: number | null
  is_public?: boolean
  cover_image_url: string | null
  created_at: string
  updated_at: string
}

export interface TripMember {
  id: string
  trip_id: string
  user_id: string
  role: TripMemberRole
}

export interface ItineraryItem {
  id: string
  trip_id: string
  day_number: number
  time_slot: ItinerarySlot
  title: string
  description: string | null
  location_name: string | null
  lat: number | null
  lng: number | null
  estimated_cost: number
  /** Legacy read alias for pre-audit payloads; never written. */
  cost_estimate?: number
  order_index: number
  created_at: string
}

/**
 * Canonical public.packing_items columns (live schema):
 * id, trip_id, category, item_name, is_packed, created_at.
 * No created_by / source / updated_at columns exist on the table.
 */
export interface PackingItem {
  id: string
  trip_id: string
  category: PackingCategory
  item_name: string
  is_packed: boolean
  created_at: string
}

export interface Expense {
  id: string
  trip_id: string
  /** Payer ID (foreign key to profiles.id) */
  payer_id: string
  /** Display name of the payer (denormalized for queries) */
  payer_name: string
  category: ExpenseCategory
  title: string
  amount: number
  currency: string
  /** Expense date (user-entered, not DB timestamp) */
  expense_date: string
  split_among: string[]
  created_at: string
  updated_at: string
}

export interface TripDocument {
  id: string
  trip_id: string
  uploaded_by: string
  kind: DocumentKind
  title: string
  storage_path: string
  public_url: string
  mime_type: string
  size_bytes: number
  meta: Json
  created_at: string
}

/** Insert/update helper types (client-generated columns omitted). */
export type TripInsert = Omit<Trip, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<Trip, 'id'>>
export type ItineraryItemInsert = Omit<
  ItineraryItem,
  'id' | 'created_at' | 'updated_at'
> &
  Partial<Pick<ItineraryItem, 'id'>>
export type PackingItemInsert = Omit<PackingItem, 'id' | 'created_at'> &
  Partial<Pick<PackingItem, 'id'>>
export type ExpenseInsert = Omit<
  Expense,
  'id' | 'created_at' | 'updated_at' | 'payer_name'
> &
  Partial<Pick<Expense, 'id'>> & { payer_name?: string }

export type TripUpdate = Partial<Omit<Trip, 'id' | 'created_at'>>
export type ItineraryItemUpdate = Partial<Omit<ItineraryItem, 'id' | 'created_at'>>
export type PackingItemUpdate = Partial<Omit<PackingItem, 'id' | 'created_at'>>
export type ExpenseUpdate = Partial<Omit<Expense, 'id' | 'created_at' | 'payer_name'>> & { payer_name?: string }
