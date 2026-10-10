import { supabase } from '@/lib/supabase'
import type { Profile, TripMemberRole } from '@/types/database'

/** Trip collaboration: members, invitations, visibility. */

export const collaborationKeys = {
  members: (tripId: string) => ['trip-members', tripId] as const,
}

export interface TripMemberView {
  userId: string
  role: TripMemberRole
  displayName: string
  email: string
  avatarUrl: string | null
  isOwner: boolean
}

/** Collaborators joined with their profiles (owner included as a row). */
export async function getTripMembers(tripId: string): Promise<TripMemberView[]> {
  // RLS may hide the trip row from public viewers — degrade to member rows only.
  const { data: tripRow } = await supabase
    .from('trips')
    .select('owner_id')
    .eq('id', tripId)
    .maybeSingle()
  const ownerId = (tripRow?.owner_id as string | undefined) ?? null

  const { data: memberRows, error } = await supabase
    .from('trip_members')
    .select('user_id, role')
    .eq('trip_id', tripId)
  if (error) throw new Error(error.message)

  const memberIds = (memberRows ?? []).map((row) => row.user_id as string)
  const allIds = ownerId ? [ownerId, ...memberIds] : memberIds

  let profiles: Profile[] = []
  if (allIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', allIds)
    if (profileError) throw new Error(profileError.message)
    profiles = (profileRows ?? []) as Profile[]
  }

  const owner = ownerId ? (profiles.find((p) => p.id === ownerId) ?? null) : null
  const views: TripMemberView[] = []

  if (owner) {
    views.push({
      userId: owner.id,
      role: 'owner',
      displayName: owner.display_name || owner.email,
      email: owner.email,
      avatarUrl: owner.avatar_url,
      isOwner: true,
    })
  }

  for (const row of memberRows ?? []) {
    const userId = row.user_id as string
    if (owner && userId === owner.id) continue
    const profile = profiles.find((p) => p.id === userId)
    views.push({
      userId,
      role: row.role as TripMemberRole,
      displayName: profile?.display_name || profile?.email || 'Invited member',
      email: profile?.email ?? '—',
      avatarUrl: profile?.avatar_url ?? null,
      isOwner: false,
    })
  }

  return views
}

/**
 * Invite by exact email match against public.profiles, then insert the
 * trip_members row. Throws informative errors for unknown/duplicate users.
 */
export async function inviteMemberByEmail(
  tripId: string,
  email: string,
  role: 'editor' | 'viewer',
  _invitedBy: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) throw new Error('Enter an email address.')

  const { data: profile, error: lookupError } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .ilike('email', normalized)
    .maybeSingle()
  if (lookupError) throw new Error(lookupError.message)
  if (!profile) {
    throw new Error(`No RoamIQ account matches ${normalized}. Ask them to sign up first.`)
  }

  const { data: existing, error: existingError } = await supabase
    .from('trip_members')
    .select('id, user_id')
    .eq('trip_id', tripId)
    .eq('user_id', profile.id)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (existing) {
    throw new Error(`${profile.display_name || profile.email} is already a member of this trip.`);
  }

  const { error: insertError } = await supabase.from('trip_members').insert({
    trip_id: tripId,
    user_id: profile.id,
    role,
  })
  if (insertError) throw new Error(insertError.message)
}

/** Owner-only removal (UI-gated; RLS enforces server-side). */
export async function removeMember(tripId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

/**
 * Toggle public sharing. The canonical column is `public.trips.is_public`
 * (boolean); legacy `visibility` rows are read defensively by callers.
 */
export async function updateTripVisibility(
  tripId: string,
  isPublic: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .update({ is_public: isPublic })
    .eq('id', tripId)
  if (error) throw new Error(error.message)
}
