import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import type { LatLngExpression, LatLngTuple } from 'leaflet'
import { createStopPin } from '@/components/map/leafletSetup'
import { cn } from '@/lib/utils'

export interface MapStop {
  id: string
  title: string
  position: LatLngTuple
  dayNumber: number
}

interface MapViewProps {
  stops: MapStop[]
  /** Center used when there are no stops yet. */
  fallbackCenter?: LatLngTuple
  fallbackZoom?: number
  selectedStopId?: string | null
  onSelectStop?: (id: string) => void
  /** When set, the map flies to this stop on change (itinerary <-> map sync). */
  focusStopId?: string | null
  className?: string
}

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** Fly the map when the focused stop changes; invalidate size on mount. */
function MapController({
  stops,
  focusStopId,
}: Pick<MapViewProps, 'stops' | 'focusStopId'>) {
  const map = useMap()
  const didInitialFit = useRef(false)

  useEffect(() => {
    // Leaflet mis-measures containers that mount at 0 height (tab switching,
    // StrictMode double-render). A deferred invalidateSize fixes both.
    const timer = window.setTimeout(() => map.invalidateSize(), 100)
    return () => window.clearTimeout(timer)
  }, [map])

  useEffect(() => {
    if (focusStopId) {
      const stop = stops.find((s) => s.id === focusStopId)
      if (stop) map.flyTo(stop.position, Math.max(map.getZoom(), 14), { duration: 0.8 })
      return
    }
    if (!didInitialFit.current && stops.length > 0) {
      didInitialFit.current = true
      if (stops.length === 1) {
        map.setView(stops[0].position, 13)
      } else {
        map.fitBounds(L.latLngBounds(stops.map((s) => s.position)), { padding: [48, 48] })
      }
    }
  }, [map, stops, focusStopId])

  return null
}

export function MapView({
  stops,
  fallbackCenter = [20, 0],
  fallbackZoom = 2,
  selectedStopId = null,
  onSelectStop,
  focusStopId = null,
  className,
}: MapViewProps) {
  const center: LatLngExpression = stops[0]?.position ?? fallbackCenter

  const orderedStops = useMemo(
    () => [...stops].sort((a, b) => a.dayNumber - b.dayNumber),
    [stops],
  )

  const routeLine = useMemo(
    () =>
      orderedStops.length > 1
        ? orderedStops.filter((s) => s.dayNumber === orderedStops[0].dayNumber).map((s) => s.position)
        : [],
    [orderedStops],
  )

  return (
    <div className={cn('h-[420px] w-full md:h-[560px]', className)}>
      <MapContainer
        center={center}
        zoom={fallbackZoom}
        scrollWheelZoom
        // react-leaflet v4 guards double-init, but StrictMode remounts share
        // the same DOM node; keying by a stable id makes remounts explicit.
        className="h-full w-full"
      >
        <TileLayer
          attribution={OSM_ATTRIBUTION}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {routeLine.length > 1 && (
          <Polyline positions={routeLine} pathOptions={{ color: '#0ea5e9', weight: 3, dashArray: '6 8' }} />
        )}
        {orderedStops.map((stop) => (
          <Marker
            key={stop.id}
            position={stop.position}
            icon={createStopPin(stop.id === selectedStopId)}
            eventHandlers={{ click: () => onSelectStop?.(stop.id) }}
          >
            <Popup>
              <span className="text-sm font-medium">
                Day {stop.dayNumber} · {stop.title}
              </span>
            </Popup>
          </Marker>
        ))}
        <MapController stops={orderedStops} focusStopId={focusStopId} />
      </MapContainer>
    </div>
  )
}
