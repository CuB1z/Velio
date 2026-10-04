import type { Feature, FeatureCollection, LineString, Point } from 'geojson'

import polyline from '@mapbox/polyline'

/** La API codifica siempre con precisión 1e-6. */
const PRECISION = 6

/** Par [lng, lat], el orden que esperan GeoJSON y MapLibre. */
export type LngLat = [number, number]

export type BBox = [LngLat, LngLat]

/**
 * Decodifica polyline6 a coordenadas GeoJSON.
 *
 * decode() no lanza ante una cadena arbitraria: devuelve números sin sentido.
 * Como en la pantalla de analizar esto es texto pegado por el usuario, se
 * valida el rango y una sola coordenada imposible invalida la cadena entera.
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

/** Caja envolvente en el orden que pide map.fitBounds. */
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
