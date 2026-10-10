/**
 * Validated environment abstraction.
 *
 * All `import.meta.env` access for app config goes through here so keys are
 * validated once at startup and never logged by call sites.
 */

export class EnvConfigError extends Error {
  constructor(message: string) {
    super(`[env] ${message}`)
    this.name = 'EnvConfigError'
  }
}

function requireString(value: string | undefined, name: string): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    throw new EnvConfigError(
      `${name} is missing. Copy .env.example to .env and set ${name}.`,
    )
  }
  return trimmed
}

function requireUrl(value: string | undefined, name: string): string {
  const raw = requireString(value, name)
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new EnvConfigError(`${name} is not a valid URL: expected https://<project>.supabase.co`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new EnvConfigError(`${name} must use http(s), got "${parsed.protocol}"`)
  }
  return raw.replace(/\/+$/, '')
}

let cachedSupabase: { url: string; anonKey: string } | null = null

/** Supabase project URL + anon key. Throws with an actionable message when unset. */
export function getSupabaseConfig(): { url: string; anonKey: string } {
  if (!cachedSupabase) {
    cachedSupabase = {
      url: requireUrl(import.meta.env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL'),
      anonKey: requireString(import.meta.env.VITE_SUPABASE_ANON_KEY, 'VITE_SUPABASE_ANON_KEY'),
    }
  }
  return cachedSupabase
}

/** Gemini API key. Callers must handle EnvConfigError with a user-facing fallback. */
export function getGeminiApiKey(): string {
  return requireString(import.meta.env.VITE_GEMINI_API_KEY, 'VITE_GEMINI_API_KEY')
}
