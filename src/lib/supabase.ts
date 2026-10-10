import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from '@/lib/env'

// Validated once at startup; throws with an actionable message if unset.
const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseConfig()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
