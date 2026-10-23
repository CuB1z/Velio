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

function ringContains(ring: [number, number][], lon: number, lat: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Polygons of [lon, lat] rings, holes after the outer ring: a point in a hole is outside. */
export function multiPolygonContains(polygons: [number, number][][][], { lat, lon }: LatLon): boolean {
  return polygons.some((rings) => rings.filter((ring) => ringContains(ring, lon, lat)).length % 2 === 1)
}
