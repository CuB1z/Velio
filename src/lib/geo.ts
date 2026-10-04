import type { LatLon } from '@/types/api'

const EARTH_RADIUS_KM = 6371.0088

/** Straight-line distance in kilometres. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/**
 * Minimum length of a loop through these points: a point D km away needs at
 * least 2·D. Asking for less can only yield an out-and-back.
 */
export function minimumLoopKm(origin: LatLon | null, via: LatLon[]): number {
  if (!origin || via.length === 0) return 0
  const farthest = Math.max(...via.map((point) => haversineKm(origin, point)))
  return farthest * 2
}
