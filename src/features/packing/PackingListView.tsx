import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Plus, Trash2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ItineraryError } from '@/features/ai/services/geminiService'
import { toast } from '@/components/ui/toast'
import { generatePackingList } from '@/features/packing/services/geminiPackingService'
import {
  addPackingItem,
  bulkSetPacked,
  deletePackingItems,
  fetchPackingItems,
  packingKeys,
  replacePackingItems,
  updatePackingItem,
} from '@/features/packing/packingService'
import { cn, errorMessage } from '@/lib/utils'
import type { PackingCategory, PackingItem } from '@/types/database'

interface PackingListViewProps {
  tripId: string
  destination: string
  durationDays: number
  style: string
  weatherSummary: string
  /** Viewer role renders checkboxes disabled and hides mutating controls. */
  canEdit: boolean
}

const CATEGORY_ORDER: PackingCategory[] = [
  'Clothes',
  'Toiletries',
  'Electronics',
  'Documents & Money',
  'Health & Meds',
  'Activity Gear',
]

/**
 * Smart packing checklist:
 *  - optimistic is_packed toggles (cache-first, rollback on error),
 *  - AI generation with overwrite confirmation,
 *  - manual inline add, Pack All / Unpack All / Clear List.
 */
export function PackingListView({
  tripId,
  destination,
  durationDays,
  style,
  weatherSummary,
  canEdit,
}: PackingListViewProps) {
  const queryClient = useQueryClient()
  const [newItem, setNewItem] = useState('')
  const [newCategory, setNewCategory] = useState<PackingCategory>('Clothes')
  const [aiError, setAiError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: packingKeys.list(tripId),
    queryFn: () => fetchPackingItems(tripId),
    enabled: Boolean(tripId),
  })

  const items = useMemo(() => query.data ?? [], [query.data])
  const packedCount = items.filter((i) => i.is_packed).length
  const percent = items.length === 0 ? 0 : Math.round((packedCount / items.length) * 100)

  const grouped = useMemo(() => {
    const map = new Map<PackingCategory, PackingItem[]>()
    for (const item of items) {
      map.set(item.category, [...(map.get(item.category) ?? []), item])
    }
    return [...map.entries()].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]),
    )
  }, [items])

  /* --------------------------- optimistic toggle -------------------------- */

  const toggleMutation = useMutation({
    mutationFn: ({ id, isPacked }: { id: string; isPacked: boolean }) =>
      updatePackingItem(id, { is_packed: isPacked }),
    onMutate: async ({ id, isPacked }) => {
      await queryClient.cancelQueries({ queryKey: packingKeys.list(tripId) })
      const previous = queryClient.getQueryData<PackingItem[]>(packingKeys.list(tripId))
      queryClient.setQueryData<PackingItem[]>(packingKeys.list(tripId), (old) =>
        (old ?? []).map((item) => (item.id === id ? { ...item, is_packed: isPacked } : item)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(packingKeys.list(tripId), context.previous)
    },
    onSuccess: (_data, vars) => toast.success(vars.isPacked ? 'Item packed' : 'Item unpacked'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: packingKeys.list(tripId) }),
  })

  const bulkMutation = useMutation({
    mutationFn: ({ ids, value }: { ids: string[]; value: boolean }) =>
      bulkSetPacked(ids, value),
    onMutate: async ({ value }) => {
      await queryClient.cancelQueries({ queryKey: packingKeys.list(tripId) })
      const previous = queryClient.getQueryData<PackingItem[]>(packingKeys.list(tripId))
      queryClient.setQueryData<PackingItem[]>(packingKeys.list(tripId), (old) =>
        (old ?? []).map((item) => ({ ...item, is_packed: value })),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(packingKeys.list(tripId), context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: packingKeys.list(tripId) }),
  })

  const addMutation = useMutation({
    mutationFn: () =>
      addPackingItem({
        trip_id: tripId,
        category: newCategory,
        item_name: newItem.trim().slice(0, 100),
        is_packed: false,
      }),
    onSuccess: () => {
      setNewItem('')
      toast.success('Item added')
      void queryClient.invalidateQueries({ queryKey: packingKeys.list(tripId) })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const clearMutation = useMutation({
    mutationFn: () => deletePackingItems(items.map((i) => i.id)),
    onSuccess: () => {
      toast.success('Packing list cleared')
      queryClient.invalidateQueries({ queryKey: packingKeys.list(tripId) })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      setAiError(null)
      const list = await generatePackingList({
        destination,
        durationDays,
        weatherSummary,
        style,
      })
      // Overwrite semantics: clear existing, then batch insert the new list.
      if (items.length > 0) await deletePackingItems(items.map((i) => i.id))
      const rows = list.categories.flatMap((category) =>
        category.items.map((name) => ({
          trip_id: tripId,
          category: category.category as PackingCategory,
          item_name: name,
          is_packed: false,
        })),
      )
      await replacePackingItems(rows)
      return rows.length
    },
    onSuccess: () => {
      toast.success('AI packing list generated')
      queryClient.invalidateQueries({ queryKey: packingKeys.list(tripId) })
    },
    onError: (error) =>
      setAiError(error instanceof ItineraryError ? error.message : errorMessage(error)),
  })

  const handleGenerate = () => {
    if (items.length > 0) {
      const ok = window.confirm(
        `Replace your existing ${items.length} packing item${items.length === 1 ? '' : 's'} with a fresh AI list?`,
      )
      if (!ok) return
    }
    generateMutation.mutate()
  }

  const handleClear = () => {
    const ok = window.confirm('Remove every packing item for this trip?')
    if (ok) clearMutation.mutate()
  }

  const allIds = items.map((i) => i.id)

  if (query.isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading packing list…</p>
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Progress */}
      <section className="space-y-2" aria-label="Packing progress">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {packedCount} / {items.length} items packed — {percent}%
          </p>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={items.length === 0 || bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate({ ids: allIds, value: true })}
                >
                  Pack All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={items.length === 0 || bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate({ ids: allIds, value: false })}
                >
                  Unpack All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  disabled={items.length === 0 || clearMutation.isPending}
                  onClick={handleClear}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear List
                </Button>
                <Button size="sm" disabled={generateMutation.isPending} onClick={handleGenerate}>
                  {generateMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  Generate AI Packing List
                </Button>
              </>
            )}
          </div>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn('h-full rounded-full transition-all', percent === 100 ? 'bg-primary' : 'bg-primary/70')}
            style={{ width: `${percent}%` }}
          />
        </div>
        {aiError && (
          <p className="text-sm text-destructive" role="alert">
            {aiError}
          </p>
        )}
      </section>

      {/* Manual add */}
      {canEdit && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (newItem.trim()) addMutation.mutate()
          }}
        >
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add a packing item…"
            className="max-w-xs flex-1"
            aria-label="New packing item"
            maxLength={100}
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as PackingCategory)}
            className="h-9 rounded-md border border-input bg-white dark:bg-slate-900 text-foreground dark:text-slate-100 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Category"
          >
            {CATEGORY_ORDER.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={addMutation.isPending || !newItem.trim()}>
            {addMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Add
          </Button>
        </form>
      )}

      {/* Grouped checklist */}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nothing packed yet — generate an AI list or add your first item above.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {grouped.map(([category, categoryItems]) => (
            <section key={category} className="space-y-2" aria-label={category}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </h3>
              <ul className="space-y-1">
                {categoryItems.map((item) => (
                  <li key={item.id}>
                    <label className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50">
                      <input
                        type="checkbox"
                        checked={item.is_packed}
                        disabled={!canEdit}
                        onChange={() =>
                          toggleMutation.mutate({ id: item.id, isPacked: !item.is_packed })
                        }
                        className={cn(
                          'h-4 w-4 rounded border-input accent-[hsl(var(--primary))]',
                          !canEdit && 'cursor-not-allowed opacity-60',
                        )}
                        aria-label={`Mark ${item.item_name} as packed`}
                      />
                      <span
                        className={cn(
                          'flex-1 text-sm',
                          item.is_packed && 'text-muted-foreground line-through',
                        )}
                      >
                        {item.item_name}
                      </span>
                      {item.is_packed && <Check className="h-3.5 w-3.5 text-primary" />}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
