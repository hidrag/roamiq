import { z } from 'zod'

/** The schema is the runtime contract for every LLM response — no casting, ever. */

export const ActivityItemSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  timeSlot: z.enum(['morning', 'afternoon', 'evening']),
  locationName: z.string().min(1).max(150),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  estimatedCost: z.coerce.number().nonnegative().default(0),
  orderIndex: z.number().int().nonnegative().default(0),
})

export const DayPlanSchema = z.object({
  dayNumber: z.number().int().positive(),
  theme: z.string().min(1).max(100),
  activities: z.array(ActivityItemSchema).min(1).max(6),
})

export const ItineraryGenerationSchema = z.object({
  tripTitle: z.string().min(1).max(120),
  destinationSummary: z.string().min(1).max(500),
  estimatedTotalBudget: z.coerce.number().nonnegative(),
  days: z.array(DayPlanSchema).min(1).max(14),
})

export type ActivityItem = z.infer<typeof ActivityItemSchema>
export type DayPlan = z.infer<typeof DayPlanSchema>
export type ItineraryGenerationResult = z.infer<typeof ItineraryGenerationSchema>

/* ---------------------------- Prompt parameters --------------------------- */

export const TIME_SLOTS = ['morning', 'afternoon', 'evening'] as const
export type TimeSlot = (typeof TIME_SLOTS)[number]

/** Style pills offered in the creation wizard (Step 2). */
export const TRAVEL_STYLES = [
  'Budget',
  'Luxury',
  'Culture & Heritage',
  'Food & Dining',
  'Nature & Hiking',
  'Relaxed',
] as const
export type TravelStyle = (typeof TRAVEL_STYLES)[number]

/** Pacing presets; each implies a target number of spots per day. */
export const PACES = [
  { id: 'relaxed', label: 'Relaxed', spotsPerDay: '2 spots/day' },
  { id: 'balanced', label: 'Balanced', spotsPerDay: '3 spots/day' },
  { id: 'fast-paced', label: 'Fast-paced', spotsPerDay: '4-5 spots/day' },
] as const
export type PaceId = (typeof PACES)[number]['id']

/** Hard caps enforced by both the UI and the schema (MVP limits). */
export const MAX_TRIP_DAYS = 14
export const MAX_DESTINATION_CHARS = 80
export const MAX_CUSTOM_NOTE_CHARS = 300

/** Everything the generator needs; sanitized again inside geminiService. */
export interface TripPromptParams {
  destination: string
  durationInDays: number
  budgetTotal: number
  currency: string
  travelStyle: TravelStyle
  pace: PaceId
  customNote?: string
}
