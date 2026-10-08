import { generatedItinerarySchema, type GeneratedItinerary } from '@/types/schema'

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

/**
 * Calls Gemini Flash with a strict JSON instruction and validates the parsed
 * response against `generatedItinerarySchema` before returning it.
 * Throws with a readable message on HTTP or schema failure.
 */
export async function generateItinerary(
  prompt: string,
  apiKey: string,
): Promise<GeneratedItinerary> {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Gemini request failed (${response.status}): ${detail.slice(0, 200)}`)
  }

  const payload: unknown = await response.json()
  const text = extractGeminiText(payload)
  if (!text) throw new Error('Gemini returned an empty response.')

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini response was not valid JSON.')
  }

  const result = generatedItinerarySchema.safeParse(parsed)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new Error(
      `Gemini itinerary failed validation at ${issue.path.join('.')}: ${issue.message}`,
    )
  }
  return result.data
}

function extractGeminiText(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const first = candidates[0] as { content?: { parts?: Array<{ text?: unknown }> } }
  const parts = first.content?.parts
  if (!Array.isArray(parts)) return null
  const text = parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('')
  return text.length > 0 ? text : null
}
