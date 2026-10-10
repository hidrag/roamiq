import { supabase } from '@/lib/supabase'
import type { Expense, ExpenseInsert, ExpenseUpdate } from '@/types/database'
import { roundMoney, sumMoney } from '@/lib/utils'

/** Expense ledger reads/writes + safe money math. */

export const expenseKeys = {
  list: (tripId: string) => ['expenses', tripId] as const,
}

export async function fetchExpenses(tripId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('trip_id', tripId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Expense[]
}

export async function addExpense(expense: ExpenseInsert): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...expense, amount: roundMoney(expense.amount) })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Expense
}

export async function updateExpense(id: string, patch: ExpenseUpdate): Promise<Expense> {
  const next: ExpenseUpdate = { ...patch }
  if (typeof patch.amount === 'number') next.amount = roundMoney(patch.amount)
  const { data, error } = await supabase
    .from('expenses')
    .update(next)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Expense
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export type CategoryTotals = Record<Expense['category'], number>

export function totalSpent(expenses: Expense[]): number {
  return sumMoney(expenses.map((e) => e.amount))
}

export function categoryTotals(expenses: Expense[]): CategoryTotals {
  const totals: CategoryTotals = {
    Stay: 0,
    Food: 0,
    Transport: 0,
    Activity: 0,
    Miscellaneous: 0,
  }
  for (const expense of expenses) {
    totals[expense.category] = roundMoney(totals[expense.category] + expense.amount)
  }
  return totals
}
