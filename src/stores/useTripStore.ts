import { create } from 'zustand'

interface UIState {
  /** Active day tab in the trip planner itinerary view. */
  activeDay: number
  setActiveDay: (day: number) => void

  /** Itinerary item id currently highlighted on the map (bidirectional sync). */
  selectedMapMarkerId: string | null
  selectMapMarker: (id: string | null) => void

  /** Which tab is open in the single-trip workspace. */
  tripTab: 'itinerary' | 'map' | 'vault' | 'expenses' | 'packing'
  setTripTab: (tab: UIState['tripTab']) => void
}

export const useTripStore = create<UIState>((set) => ({
  activeDay: 1,
  setActiveDay: (day) => set({ activeDay: day }),

  selectedMapMarkerId: null,
  selectMapMarker: (id) => set({ selectedMapMarkerId: id }),

  tripTab: 'itinerary',
  setTripTab: (tab) => set({ tripTab: tab }),
}))
