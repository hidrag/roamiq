import { useMemo } from 'react'
import { MapView, type MapStop } from '@/components/map/MapView'
import { useTripStore } from '@/stores/useTripStore'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatCurrency } from '@/lib/utils'
import type { ItineraryItem } from '@/types/database'

interface TripMapProps {
  items: ItineraryItem[]
  /** Trip destination used to center the map before any stop exists. */
  fallbackCenter?: [number, number]
  className?: string
}

const SLOT_RANK: Record<ItineraryItem['time_slot'], number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
}

/**
 * Synchronized geospatial engine.
 *
 * Reads activeDay / selectedActivityId / hoveredActivityId from useTripStore
 * and renders MapView:
 *  - markers filtered to the active day (same filter as the timeline),
 *  - flyTo + popup open on hover/click (hover debounced to avoid jitter),
 *  - polyline of the active day's chronological stops,
 *  - marker clicks write selectedActivityId back into the store so the
 *    timeline can scroll the matching card into view.
 */
export function TripMap({ items, fallbackCenter, className }: TripMapProps) {
  const activeDay = useTripStore((s) => s.activeDay)
  const selectedActivityId = useTripStore((s) => s.selectedActivityId)
  const hoveredActivityId = useTripStore((s) => s.hoveredActivityId)
  const focusNonce = useTripStore((s) => s.focusNonce)
  const selectActivity = useTripStore((s) => s.selectActivity)
  const setTripTab = useTripStore((s) => s.setTripTab)

  // Debounce hover so a fast mouse sweep doesn't spam flyTo().
  const debouncedHover = useDebouncedValue(hoveredActivityId, 220)

  const dayItems = useMemo(() => {
    const filtered = activeDay === 'all' ? items : items.filter((i) => i.day_number === activeDay)
    return [...filtered]
      .filter((i) => typeof i.lat === 'number' && typeof i.lng === 'number')
      .sort((a, b) => {
        if (a.day_number !== b.day_number) return a.day_number - b.day_number
        const slotDiff = SLOT_RANK[a.time_slot] - SLOT_RANK[b.time_slot]
        if (slotDiff !== 0) return slotDiff
        return a.order_index - b.order_index
      })
  }, [items, activeDay])

  const stops: MapStop[] = useMemo(
    () =>
      dayItems.map((item) => ({
        id: item.id,
        title: item.title,
        position: [item.lat as number, item.lng as number],
        dayNumber: item.day_number,
        detail: item.estimated_cost
          ? formatCurrency(item.estimated_cost, 'USD')
          : (item.location_name ?? ''),
      })),
    [dayItems],
  )

  const handleSelectStop = (id: string) => {
    selectActivity(id)
    // Map -> card: switch mobile users to the list so scrollIntoView can land.
    setTripTab('itinerary')
  }

  return (
    <MapView
      stops={stops}
      fallbackCenter={fallbackCenter}
      selectedStopId={selectedActivityId}
      hoveredStopId={debouncedHover}
      onSelectStop={handleSelectStop}
      focusNonce={focusNonce}
      polylineDay={activeDay}
      className={className}
    />
  )
}
