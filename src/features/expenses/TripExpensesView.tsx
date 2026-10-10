import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  EXPENSE_CATEGORIES,
  expenseFormSchema,
  type ExpenseFormValues,
} from '@/features/expenses/expenseSchema'
import { toast } from '@/components/ui/toast'
import {
  addExpense,
  categoryTotals,
  deleteExpense,
  expenseKeys,
  fetchExpenses,
  totalSpent,
  updateExpense,
} from '@/features/expenses/expenseService'
import { cn, formatCurrency, roundMoney } from '@/lib/utils'
import type { Expense, ExpenseCategory } from '@/types/database'

interface TripExpensesViewProps {
  tripId: string
  budgetTotal: number | null
  currency: string
  /** Who the Add-Expense form pre-selects as payer. */
  defaultPayer: string
  /** Viewer role hides add/edit/delete controls. */
  canEdit: boolean
}

type SortKey = 'expense_date' | 'amount'
type SortDir = 'asc' | 'desc'

const CATEGORY_STYLES: Record<ExpenseCategory, string> = {
  Stay: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  Food: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  Transport: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  Activity: 'bg-green-500/15 text-green-600 dark:text-green-400',
  Miscellaneous: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
}

function budgetStatus(spent: number, budget: number): 'green' | 'amber' | 'red' {
  if (budget <= 0) return 'red'
  const ratio = spent / budget
  if (ratio < 0.8) return 'green'
  if (ratio <= 1) return 'amber'
  return 'red'
}

const STATUS_BAR: Record<ReturnType<typeof budgetStatus>, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

export function TripExpensesView({
  tripId,
  budgetTotal,
  currency,
  defaultPayer,
  canEdit,
}: TripExpensesViewProps) {
  const queryClient = useQueryClient()
  const [sortKey, setSortKey] = useState<SortKey>('expense_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: expenseKeys.list(tripId),
    queryFn: () => fetchExpenses(tripId),
    enabled: Boolean(tripId),
  })

  const expenses = useMemo(() => query.data ?? [], [query.data])

  const spent = useMemo(() => totalSpent(expenses), [expenses])
  const totalsByCategory = useMemo(() => categoryTotals(expenses), [expenses])
  const budget = budgetTotal ?? 0
  const remaining = roundMoney(budget - spent)
  const status = budgetStatus(spent, budget)

  const sorted = useMemo(() => {
    const list = [...expenses]
    list.sort((a, b) => {
      const diff =
        sortKey === 'amount'
          ? a.amount - b.amount
          : a.expense_date.localeCompare(b.expense_date) || a.created_at.localeCompare(b.created_at)
      return sortDir === 'asc' ? diff : -diff
    })
    return list
  }, [expenses, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'amount' ? 'desc' : 'desc')
    }
  }

  const saveMutation = useMutation({
    mutationFn: (input: { values: ExpenseFormValues; id: string | null }) => {
      const payload = {
        title: input.values.title,
        amount: input.values.amount,
        category: input.values.category,
        payer_id: input.values.paidBy,
        expense_date: input.values.spentOn,
      }
      if (input.id) return updateExpense(input.id, payload)
      return addExpense({
        ...payload,
        trip_id: tripId,
        currency,
        split_among: [],
      })
    },
    onSuccess: () => {
      setModalOpen(false)
      setEditing(null)
      setFormError(null)
      toast.success('Expense recorded')
      void queryClient.invalidateQueries({ queryKey: expenseKeys.list(tripId) })
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : String(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      toast.success('Expense deleted')
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(tripId) })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
  })

  const handleDelete = (expense: Expense) => {
    if (window.confirm(`Delete "${expense.title}" (${formatCurrency(expense.amount, currency)})?`)) {
      deleteMutation.mutate(expense.id)
    }
  }

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      aria-label={`Sort by ${label}`}
    >
      {label}
      {sortKey === k &&
        (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  )

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Budget overview */}
      <section className="space-y-2 rounded-xl border p-4" aria-label="Budget overview">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">

            <span>
              <span className="text-muted-foreground">Budget </span>
              <strong>{budget > 0 ? formatCurrency(budget, currency) : 'Not set'}</strong>
            </span>
            <span>
              <span className="text-muted-foreground">Spent </span>
              <strong className="text-red-600 dark:text-red-400">
                {formatCurrency(spent, currency)}
              </strong>
            </span>
            <span>
              <span className="text-muted-foreground">Remaining </span>
              <strong
                className={cn(
                  remaining < 0
                    ? 'text-red-600 dark:text-red-400'
                    : status === 'amber'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-green-600 dark:text-green-400',
                )}
              >
                {formatCurrency(remaining, currency)}
              </strong>
            </span>
          </div>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null)
                setFormError(null)
                setModalOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Add Expense
            </Button>
          )}
        </div>
        {budget > 0 && (
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className={cn('h-full rounded-full transition-all', STATUS_BAR[status])}
              style={{ width: `${Math.min(100, Math.round((spent / budget) * 100))}%` }}
            />
          </div>
        )}
        {budget > 0 && (
          <p className="text-xs text-muted-foreground">
            {Math.round((spent / budget) * 100)}% of budget used
            {status === 'red' && ' — over budget'}
          </p>
        )}
      </section>

      {/* Category breakdown */}
      <section className="space-y-2" aria-label="Category breakdown">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Category breakdown
        </h3>
        <div className="space-y-2">
          {EXPENSE_CATEGORIES.map((category) => {
            const value = totalsByCategory[category]
            const share = spent > 0 ? (value / spent) * 100 : 0
            return (
              <div key={category} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate text-muted-foreground">{category}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${share}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right">
                  {formatCurrency(value, currency)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {Math.round(share)}%
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Ledger */}
      <section className="space-y-2" aria-label="Expense ledger">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Ledger
        </h3>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading expenses…</p>
        ) : sorted.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Receipt className="mx-auto mb-2 h-6 w-6" />
            No expenses yet — add your first one to start tracking.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">
                    <SortHeader label="Date" k="expense_date" />
                  </th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Paid By</th>
                  <th className="px-3 py-2 text-right">
                    <SortHeader label="Amount" k="amount" />
                  </th>
                  <th className="w-20 px-3 py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((expense) => (
                  <tr key={expense.id} className="border-t">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {expense.expense_date}
                    </td>
                    <td className="max-w-48 truncate px-3 py-2">{expense.title}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          CATEGORY_STYLES[expense.category],
                        )}
                      >
                        {expense.category}
                      </span>
                    </td>
                    <td className="max-w-32 truncate px-3 py-2 text-muted-foreground">
                      {expense.payer_name || expense.payer_id}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                      {formatCurrency(expense.amount, expense.currency || currency)}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit && (
                        <div className="flex justify-end gap-1 opacity-70 transition-opacity hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Edit ${expense.title}`}
                            onClick={() => {
                              setEditing(expense)
                              setFormError(null)
                              setModalOpen(true)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            aria-label={`Delete ${expense.title}`}
                            onClick={() => handleDelete(expense)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ExpenseDialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
            setFormError(null)
          }
          setModalOpen(open)
        }}
        expense={editing}
        defaultPayer={defaultPayer}
        saving={saveMutation.isPending}
        error={formError}
        onSubmit={(values) => saveMutation.mutate({ values, id: editing?.id ?? null })}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

interface ExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: Expense | null
  defaultPayer: string
  saving: boolean
  error: string | null
  onSubmit: (values: ExpenseFormValues) => void
}

function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  defaultPayer,
  saving,
  error,
  onSubmit,
}: ExpenseDialogProps) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('Food')
  const [paidBy, setPaidBy] = useState('')
  const [spentOn, setSpentOn] = useState('')
  const [touched, setTouched] = useState(false)

  // Seed on open/switch target.
  const seedKey = `${open}:${expense?.id ?? 'new'}`
  const [lastSeed, setLastSeed] = useState('')
  if (open && lastSeed !== seedKey) {
    setLastSeed(seedKey)
    setTitle(expense?.title ?? '')
    setAmount(expense ? String(expense.amount) : '')
    setCategory(expense?.category ?? 'Food')
    const expensePayerName = expense?.payer_name
    const expensePayerId = expense?.payer_id
    setPaidBy(expensePayerName ?? expensePayerId ?? defaultPayer)
    setSpentOn(expense?.expense_date ?? new Date().toISOString().slice(0, 10))
    setTouched(false)
  }

  const candidate: ExpenseFormValues = {
    title: title.trim(),
    amount: Number(amount),
    category,
    paidBy: paidBy.trim(),
    spentOn,
  }
  const validation = expenseFormSchema.safeParse(candidate)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!validation.success) return
    onSubmit(validation.data)
  }

  const fieldError = (field: keyof ExpenseFormValues): string | null => {
    if (!touched || validation.success) return null
    const issue = validation.error.issues.find((i) => i.path[0] === field)
    return issue ? issue.message : null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? 'Edit expense' : 'Add expense'}</DialogTitle>
          <DialogDescription>
            Amounts must be greater than zero — rounding is handled for you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exp-title">Title</Label>
            <Input
              id="exp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dinner at the night market"
              maxLength={120}
            />
            {fieldError('title') && <p className="text-xs text-destructive">{fieldError('title')}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="exp-amount">Amount</Label>
              <Input
                id="exp-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              {fieldError('amount') && (
                <p className="text-xs text-destructive">{fieldError('amount')}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-category">Category</Label>
              <select
                id="exp-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="flex h-9 w-full rounded-md border border-input bg-white dark:bg-slate-900 text-foreground dark:text-slate-100 px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {EXPENSE_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="exp-payer">Paid by</Label>
              <Input
                id="exp-payer"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                placeholder="Who paid?"
                maxLength={80}
              />
              {fieldError('paidBy') && (
                <p className="text-xs text-destructive">{fieldError('paidBy')}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-date">Date</Label>
              <Input
                id="exp-date"
                type="date"
                value={spentOn}
                onChange={(e) => setSpentOn(e.target.value)}
              />
              {fieldError('spentOn') && (
                <p className="text-xs text-destructive">{fieldError('spentOn')}</p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {expense ? 'Save changes' : 'Add expense'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
