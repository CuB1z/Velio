import type { Feature, FeatureCollection, LineString, Point } from 'geojson'

import polyline from '@mapbox/polyline'

/** The API always encodes with 1e-6 precision. */
const PRECISION = 6

/** [lng, lat], the order GeoJSON and MapLibre expect. */
export type LngLat = [number, number]

export type BBox = [LngLat, LngLat]

/**
 * Decodes polyline6 into GeoJSON coordinates. decode() returns garbage instead
 * of throwing on pasted input, so one out-of-range point invalidates the string.
 */
export function decodePolyline(encoded: string): LngLat[] {
  if (!encoded) return []

  let decoded: [number, number][]
  try {
    decoded = polyline.decode(encoded, PRECISION)
  } catch {
    return []
  }

  const points: LngLat[] = []
  for (const [lat, lng] of decoded) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return []
    points.push([lng, lat])
  }
  return points
}

export function toLineFeature(
  coordinates: LngLat[],
  properties: Record<string, unknown> = {},
): Feature<LineString> {
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'LineString', coordinates },
  }
}

export function toPointFeature(
  coordinate: LngLat,
  properties: Record<string, unknown> = {},
): Feature<Point> {
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'Point', coordinates: coordinate },
  }
}

export function emptyCollection(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

/** Bounding box in the order map.fitBounds expects. */
export function boundsOf(coordinates: LngLat[]): BBox | null {
  if (coordinates.length === 0) return null

  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  for (const [lng, lat] of coordinates) {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}
