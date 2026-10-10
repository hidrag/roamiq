import { z } from 'zod'

export const PackingCategorySchema = z.object({
  category: z.enum([
    'Clothes',
    'Toiletries',
    'Electronics',
    'Documents & Money',
    'Health & Meds',
    'Activity Gear',
  ]),
  items: z.array(z.string().min(1).max(100)).min(1).max(10),
})

export const PackingListSchema = z.object({
  categories: z.array(PackingCategorySchema).min(1),
})

export type PackingList = z.infer<typeof PackingListSchema>

/** Inputs for the context-aware packing generator. */
export interface PackingPromptParams {
  destination: string
  durationDays: number
  /** Short weather summary, e.g. "24°C, occasional rain". */
  weatherSummary: string
  /** Trip style from the creation wizard (Budget, Luxury, ...). */
  style: string
}
