import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  isLoading: boolean
  /** Wire this once at app start via supabase.auth.onAuthStateChange. */
  hydrate: () => Promise<void>
  setSession: (session: Session | null) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,

  hydrate: async () => {
    const { data, error } = await supabase.auth.getSession()
    if (!error) {
      set({ session: data.session, user: data.session?.user ?? null, isLoading: false })
    } else {
      set({ session: null, user: null, isLoading: false })
    }
  },

  setSession: (session) => {
    set({ session, user: session?.user ?? null, isLoading: false })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null })
  },
}))

/** Subscribe the store to Supabase auth events. Call once from the app root. */
export function startAuthListener(): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session)
  })
  // Prime the store with the persisted session immediately.
  void useAuthStore.getState().hydrate()
  return () => data.subscription.unsubscribe()
}

/** Convenience selector: current user id or null. */
export function selectUserId(state: AuthState): string | null {
  return state.user?.id ?? null
}
