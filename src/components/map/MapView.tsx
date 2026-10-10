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
  /** Optional one-line detail shown inside the popup. */
  detail?: string
}

interface MapViewProps {
  stops: MapStop[]
  /** Center used when there are no stops yet. */
  fallbackCenter?: LatLngTuple
  fallbackZoom?: number
  /** Sticky selection: marker enlarges, popup opens, map flies to it. */
  selectedStopId?: string | null
  /** Hover preview: gentle pan, no zoom change. */
  hoveredStopId?: string | null
  onSelectStop?: (id: string) => void
  /** Bump to re-fly to the same stop (repeat clicks). */
  focusNonce?: number
  /** Only stops of this day get the route polyline; 'all' disables it. */
  polylineDay?: number | 'all'
  className?: string
}

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const FLY_ZOOM = 15

interface SyncControllerProps {
  stops: MapStop[]
  selectedStopId: string | null
  hoveredStopId: string | null
  focusNonce: number
  markerRefs: React.MutableRefObject<Map<string, L.Marker>>
}

/** Imperative map behaviors: fly + openPopup on selection, gentle pan on hover. */
function MapSyncController({
  stops,
  selectedStopId,
  hoveredStopId,
  focusNonce,
  markerRefs,
}: SyncControllerProps) {
  const map = useMap()
  const didInitialFit = useRef(false)

  // Fix mis-measured containers (tab switches, StrictMode double-render).
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 100)
    return () => window.clearTimeout(timer)
  }, [map])

  // Initial fit to all stops.
  useEffect(() => {
    if (didInitialFit.current || stops.length === 0) return
    didInitialFit.current = true
    if (stops.length === 1) {
      map.setView(stops[0].position, FLY_ZOOM)
    } else {
      map.fitBounds(L.latLngBounds(stops.map((s) => s.position)), { padding: [48, 48] })
    }
  }, [map, stops])

  // Selection: fly + open popup (focusNonce re-triggers repeat selections).
  useEffect(() => {
    if (!selectedStopId) return
    const stop = stops.find((s) => s.id === selectedStopId)
    if (!stop) return
    map.flyTo(stop.position, Math.max(map.getZoom(), FLY_ZOOM), { duration: 0.8 })
    const marker = markerRefs.current.get(selectedStopId)
    if (marker) {
      // Open slightly after the fly begins so the popup lands on-screen.
      const timer = window.setTimeout(() => marker.openPopup(), 350)
      return () => window.clearTimeout(timer)
    }
  }, [map, stops, selectedStopId, focusNonce, markerRefs])

  // Hover: panTo only when the point is outside the safe center zone.
  useEffect(() => {
    if (!hoveredStopId || hoveredStopId === selectedStopId) return
    const stop = stops.find((s) => s.id === hoveredStopId)
    if (!stop) return
    const point = map.latLngToContainerPoint(stop.position)
    const size = map.getSize()
    const margin = 60
    const inside =
      point.x >= margin &&
      point.x <= size.x - margin &&
      point.y >= margin &&
      point.y <= size.y - margin
    if (!inside) map.panTo(stop.position, { animate: true, duration: 0.5 })
  }, [map, stops, hoveredStopId, selectedStopId])

  return null
}

export function MapView({
  stops,
  fallbackCenter = [20, 0],
  fallbackZoom = 2,
  selectedStopId = null,
  hoveredStopId = null,
  onSelectStop,
  focusNonce = 0,
  polylineDay = 'all',
  className,
}: MapViewProps) {
  const center: LatLngExpression = stops[0]?.position ?? fallbackCenter
  const markerRefs = useRef(new Map<string, L.Marker>())

  const orderedStops = useMemo(
    () => [...stops].sort((a, b) => a.dayNumber - b.dayNumber),
    [stops],
  )

  const routeLine = useMemo(() => {
    if (polylineDay === 'all') return []
    return orderedStops.filter((s) => s.dayNumber === polylineDay).map((s) => s.position)
  }, [orderedStops, polylineDay])

  return (
    <div className={cn('h-full w-full', className)}>
      <MapContainer
        center={center}
        zoom={fallbackZoom}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution={OSM_ATTRIBUTION}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {routeLine.length > 1 && (
          <Polyline
            positions={routeLine}
            pathOptions={{ color: '#0ea5e9', weight: 3, dashArray: '6 8', opacity: 0.75 }}
          />
        )}
        {orderedStops.map((stop) => (
          <Marker
            key={stop.id}
            position={stop.position}
            icon={createStopPin(stop.id === selectedStopId)}
            eventHandlers={{ click: () => onSelectStop?.(stop.id) }}
            ref={(marker) => {
              if (marker) markerRefs.current.set(stop.id, marker)
              else markerRefs.current.delete(stop.id)
            }}
          >
            <Popup>
              <span className="text-sm font-medium">
                Day {stop.dayNumber} · {stop.title}
              </span>
              {stop.detail && <span className="block text-xs opacity-80">{stop.detail}</span>}
            </Popup>
          </Marker>
        ))}
        <MapSyncController
          stops={orderedStops}
          selectedStopId={selectedStopId}
          hoveredStopId={hoveredStopId}
          focusNonce={focusNonce}
          markerRefs={markerRefs}
        />
      </MapContainer>
    </div>
  )
}
