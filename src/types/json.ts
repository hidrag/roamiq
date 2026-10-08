/**
 * Recursive JSON type matching the shape Supabase uses for `jsonb` columns.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]
