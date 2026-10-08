import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Fix Leaflet's broken default marker asset URLs under bundlers.
interface IconUrlHack {
  _getIconUrl?: unknown
}
delete (L.Icon.Default.prototype as unknown as IconUrlHack)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
})

/** Brand-colored circular pin used for itinerary stops. */
export function createStopPin(active: boolean): L.DivIcon {
  const size = active ? 34 : 26
  // Hardcoded hex: CSS custom properties do not resolve inside SVG
  // presentation attributes, and these hues read well on both themes.
  const fill = active ? '#f97316' : '#0ea5e9'
  return L.divIcon({
    className: active ? 'roamiq-marker-pulse' : '',
    html: `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="${fill}" stroke="white" stroke-width="2"/>
        <circle cx="12" cy="12" r="3.5" fill="white"/>
      </svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}
