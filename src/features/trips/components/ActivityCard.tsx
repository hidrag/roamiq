import { useEffect, useRef } from 'react'
import { MapPin, Pencil, Trash2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import type { ItineraryItem } from '@/types/database'

interface ActivityCardProps {
  item: ItineraryItem
  selected: boolean
  hovered: boolean
  /** Viewer role hides edit/delete affordances. */
  canEdit: boolean
  onSelect: () => void
  onHover: (hovering: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

/** One itinerary stop card. Registry key `data-item-id` powers scroll-to-card sync. */
export function ActivityCard({
  item,
  selected,
  hovered,
  canEdit,
  onSelect,
  onHover,
  onEdit,
  onDelete,
}: ActivityCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Marker click -> smooth scroll the selected card into view.
    if (selected) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selected])

  return (
    <div
      ref={ref}
      data-item-id={item.id}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        'group cursor-pointer rounded-xl border bg-card p-4 text-left shadow-sm transition-all',
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'border-primary ring-2 ring-primary/60',
        hovered && !selected && 'border-primary/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold leading-snug">{item.title}</h4>
        {canEdit && (
          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={`Edit ${item.title}`}
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            aria-label={`Delete ${item.title}`}
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          </div>
        )}
      </div>

      {item.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {item.location_name && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="line-clamp-1 max-w-[220px]">{item.location_name}</span>
          </span>
        )}
        {item.estimated_cost != null && item.estimated_cost > 0 && (
          <span className="inline-flex items-center gap-1">
            <Wallet className="h-3 w-3" />
            {formatCurrency(item.estimated_cost, 'USD')}
          </span>
        )}
      </div>
    </div>
  )
}
