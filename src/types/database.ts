import type { Json } from './json'

export type TripVisibility = 'private' | 'shared' | 'public'
export type TripStatus = 'planning' | 'active' | 'completed' | 'archived'
export type TripMemberRole = 'owner' | 'editor' | 'viewer'
export type TripMemberStatus = 'invited' | 'accepted' | 'declined'
export type ItinerarySlot = 'morning' | 'afternoon' | 'evening' | 'night'
export type ItineraryItemType =
  | 'sight'
  | 'food'
  | 'transport'
  | 'stay'
  | 'activity'
  | 'other'
export type PackingCategory =
  | 'documents'
  | 'clothing'
  | 'tech'
  | 'health'
  | 'toiletries'
  | 'finance'
  | 'misc'
export type ExpenseCategory = 'stay' | 'food' | 'transport' | 'activity' | 'shopping' | 'misc'
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

export interface Trip {
  id: string
  owner_id: string
  title: string
  destination: string
  destination_lat: number | null
  destination_lng: number | null
  start_date: string | null
  end_date: string | null
  budget_total: number | null
  currency: string
  description: string | null
  cover_image_url: string | null
  status: TripStatus
  visibility: TripVisibility
  created_at: string
  updated_at: string
}

export interface TripMember {
  id: string
  trip_id: string
  user_id: string
  role: TripMemberRole
  status: TripMemberStatus
  invited_by: string
  invited_at: string
  responded_at: string | null
}

export interface ItineraryItem {
  id: string
  trip_id: string
  created_by: string
  day_number: number
  slot: ItinerarySlot
  item_type: ItineraryItemType
  title: string
  description: string | null
  location_name: string | null
  lat: number | null
  lng: number | null
  start_time: string | null
  end_time: string | null
  cost_estimate: number | null
  external_url: string | null
  sort_order: number
  source: 'user' | 'ai'
  created_at: string
  updated_at: string
}

export interface PackingItem {
  id: string
  trip_id: string
  created_by: string
  category: PackingCategory
  label: string
  quantity: number
  checked: boolean
  source: 'user' | 'ai'
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  trip_id: string
  paid_by: string
  category: ExpenseCategory
  description: string
  amount: number
  currency: string
  spent_on: string
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
export type PackingItemInsert = Omit<PackingItem, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<PackingItem, 'id'>>
export type ExpenseInsert = Omit<Expense, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<Expense, 'id'>>

export type TripUpdate = Partial<Omit<Trip, 'id' | 'created_at'>>
export type ItineraryItemUpdate = Partial<Omit<ItineraryItem, 'id' | 'created_at'>>
export type PackingItemUpdate = Partial<Omit<PackingItem, 'id' | 'created_at'>>
export type ExpenseUpdate = Partial<Omit<Expense, 'id' | 'created_at'>>
