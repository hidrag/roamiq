import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActivityCard } from '@/features/trips/components/ActivityCard'
import { TIME_SLOTS, type TimeSlot } from '@/features/ai/schemas/itinerarySchema'
import { cn } from '@/lib/utils'
import type { ItineraryItem } from '@/types/database'

interface ItineraryTimelineProps {
  items: ItineraryItem[]
  activeDay: number | 'all'
  onDayChange: (day: number | 'all') => void
  selectedItemId: string | null
  hoveredItemId: string | null
  /** Viewer role hides add/edit/delete controls. */
  canEdit: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  onEditItem: (item: ItineraryItem) => void
  onDeleteItem: (item: ItineraryItem) => void
  onAddActivity: (day: number) => void
}

const SLOT_LABELS: Record<TimeSlot, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

function slotRank(slot: ItineraryItem['time_slot']): number {
  if (slot === 'morning') return 0
  if (slot === 'afternoon') return 1
  return 2
}

export function ItineraryTimeline({
  items,
  activeDay,
  onDayChange,
  selectedItemId,
  hoveredItemId,
  canEdit,
  onSelect,
  onHover,
  onEditItem,
  onDeleteItem,
  onAddActivity,
}: ItineraryTimelineProps) {
  const dayNumbers = useMemo(() => {
    const days = new Set(items.map((i) => i.day_number))
    return [...days].sort((a, b) => a - b)
  }, [items])

  const visible = useMemo(() => {
    const filtered =
      activeDay === 'all' ? items : items.filter((i) => i.day_number === activeDay)
    return [...filtered].sort((a, b) => {
      if (a.day_number !== b.day_number) return a.day_number - b.day_number
      const slotDiff = slotRank(a.time_slot) - slotRank(b.time_slot)
      if (slotDiff !== 0) return slotDiff
      return a.order_index - b.order_index
    })
  }, [items, activeDay])

  // Group: day -> time_slot -> items.
  const groups = useMemo(() => {
    const byDay = new Map<number, Map<TimeSlot, ItineraryItem[]>>()
    for (const item of visible) {
      const dayMap = byDay.get(item.day_number) ?? new Map<TimeSlot, ItineraryItem[]>()
      const slot: TimeSlot = item.time_slot
      dayMap.set(slot, [...(dayMap.get(slot) ?? []), item])
      byDay.set(item.day_number, dayMap)
    }
    return byDay
  }, [visible])

  const addDay = activeDay === 'all' ? (dayNumbers[0] ?? 1) : activeDay

  return (
    <div className="space-y-6">
      {/* Sticky day selector */}
      <div className="sticky top-14 z-10 -mx-1 bg-background/90 px-1 py-2 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <DayChip label="All days" active={activeDay === 'all'} onClick={() => onDayChange('all')} />
          {dayNumbers.map((day) => (
            <DayChip
              key={day}
              label={`Day ${day}`}
              active={activeDay === day}
              onClick={() => onDayChange(day)}
            />
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No activities {activeDay === 'all' ? 'yet' : `for day ${activeDay}`} — add your first stop.
          {canEdit && (
            <div>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => onAddActivity(addDay)}>
                <Plus className="h-4 w-4" />
                Add activity
              </Button>
            </div>
          )}
        </div>
      ) : (
        [...groups.entries()].map(([day, slotMap]) => (
          <section key={day} className="space-y-4" aria-label={`Day ${day}`}>
            {activeDay === 'all' && (
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Day {day}
              </h3>
            )}
            {TIME_SLOTS.map((slot) => {
              const slotItems = slotMap.get(slot)
              if (!slotItems || slotItems.length === 0) return null
              return (
                <div key={slot} className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wider text-primary">
                    {SLOT_LABELS[slot]}
                  </h4>
                  <div className="space-y-2">
                    {slotItems.map((item) => (
                      <ActivityCard
                        key={item.id}
                        item={item}
                        selected={item.id === selectedItemId}
                        hovered={item.id === hoveredItemId}
                        canEdit={canEdit}
                        onSelect={() => onSelect(item.id)}
                        onHover={(hovering) => onHover(hovering ? item.id : null)}
                        onEdit={() => onEditItem(item)}
                        onDelete={() => onDeleteItem(item)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => onAddActivity(day)}>
                <Plus className="h-4 w-4" />
                Add activity to day {day}
              </Button>
            )}
          </section>
        ))
      )}
    </div>
  )
}

function DayChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {label}
    </button>
  )
}
