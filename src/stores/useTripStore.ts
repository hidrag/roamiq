import { create } from 'zustand'

export type TripTab = 'itinerary' | 'map' | 'vault' | 'expenses' | 'packing'

/**
 * Cross-component trip workspace state — the single source of truth for the
 * bidirectional itinerary <-> map synchronization (Phase 2 spec naming).
 */
interface TripUIState {
  /** Day filter driving BOTH the timeline list and the map markers. */
  activeDay: number | 'all'
  setActiveDay: (day: number | 'all') => void

  /** Card/markers selected id: enlarges marker, opens popup, scrolls the card. */
  selectedActivityId: string | null
  selectActivity: (id: string | null) => void

  /** Hovered card id: highlights marker + preview pan. */
  hoveredActivityId: string | null
  hoverActivity: (id: string | null) => void

  /** Bumped on repeat clicks so the map re-flies to an already-selected item. */
  focusNonce: number
  requestFocus: () => void

  /** Mobile view switch between list and map. */
  tripTab: TripTab
  setTripTab: (tab: TripTab) => void

  /** Clear per-trip UI state on workspace enter/leave. */
  resetTripUI: () => void
}

export const useTripStore = create<TripUIState>((set) => ({
  activeDay: 'all',
  setActiveDay: (day) => set({ activeDay: day }),

  selectedActivityId: null,
  selectActivity: (id) =>
    set((state) => ({
      selectedActivityId: id,
      // Re-clicking the active item nudges the map to fly again.
      focusNonce:
        id !== null && id === state.selectedActivityId
          ? state.focusNonce + 1
          : state.focusNonce,
    })),

  hoveredActivityId: null,
  hoverActivity: (id) => set({ hoveredActivityId: id }),

  focusNonce: 0,
  requestFocus: () => set((state) => ({ focusNonce: state.focusNonce + 1 })),

  tripTab: 'itinerary',
  setTripTab: (tab) => set({ tripTab: tab }),

  resetTripUI: () =>
    set({
      activeDay: 'all',
      selectedActivityId: null,
      hoveredActivityId: null,
      tripTab: 'itinerary',
    }),
}))
