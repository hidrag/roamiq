import { z } from 'zod'

export const EXPENSE_CATEGORIES = [
  'Stay',
  'Food',
  'Transport',
  'Activity',
  'Miscellaneous',
] as const

/** Strictly-positive amount validation (spec: no zeros, no negatives, no NaN). */
export const expenseFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  amount: z.coerce
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0')
    .max(1_000_000),
  category: z.enum(EXPENSE_CATEGORIES),
  paidBy: z.string().trim().min(1, 'Payer is required').max(80),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date is required'),
})

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>
