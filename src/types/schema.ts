import { z } from 'zod'

export const AI_SCHEMA_NOTE =
  'All AI-generated responses must be parsed against the zod schemas in this file before updating Supabase or local state.'

export const itinerarySlotSchema = z.enum(['morning', 'afternoon', 'evening', 'night'])

export const itineraryItemTypeSchema = z.enum([
  'sight',
  'food',
  'transport',
  'stay',
  'activity',
  'other',
])

/** Strict shape Gemini Flash must return for a generated trip itinerary. */
export const generatedItinerarySchema = z.object({
  destination: z.string().min(1),
  summary: z.string(),
  days: z.array(
    z.object({
      dayNumber: z.number().int().positive(),
      slots: z.array(
        z.object({
          slot: itinerarySlotSchema,
          title: z.string().min(1),
          description: z.string(),
          item_type: itineraryItemTypeSchema,
          location_name: z.string(),
          lat: z.number(),
          lng: z.number(),
          cost_estimate: z.number().nullable(),
        }),
      ),
    }),
  ),
})

export type GeneratedItinerary = z.infer<typeof generatedItinerarySchema>
