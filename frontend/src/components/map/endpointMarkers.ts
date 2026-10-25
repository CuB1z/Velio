import { haversineKm } from '@/lib/geo'
import type { LngLat } from '@/lib/polyline'
import type { MapMarker } from './MapView'

const CLOSED_LOOP_KM = 0.1

export function endpointMarkers(coordinates: LngLat[]): MapMarker[] {
  if (coordinates.length < 2) return []
  const start = coordinates[0]
  const end = coordinates[coordinates.length - 1]
  const markers: MapMarker[] = [{ id: 'start', coordinate: start, kind: 'start' }]
  const gapKm = haversineKm({ lat: start[1], lon: start[0] }, { lat: end[1], lon: end[0] })
  if (gapKm > CLOSED_LOOP_KM) markers.push({ id: 'end', coordinate: end, kind: 'end' })
  return markers
}
