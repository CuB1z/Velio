import type { Coverage } from '@/types/api'

const box = (minLon: number, minLat: number, maxLon: number, maxLat: number): [number, number][] => [
  [minLon, minLat],
  [maxLon, minLat],
  [maxLon, maxLat],
  [minLon, maxLat],
  [minLon, minLat],
]

export const COVERAGE: Coverage = {
  regions: [
    { key: 'spain', name: 'Spain', iso: 'ES' },
    { key: 'portugal', name: 'Portugal', iso: 'PT' },
  ],
  bbox: [-9.6, 36.0, 3.4, 43.8],
  geometry: {
    type: 'MultiPolygon',
    coordinates: [[box(-7.0, 36.0, 3.4, 43.8)], [box(-9.6, 37.0, -7.0, 42.2)]],
  },
}

export const MADRID = { lat: 40.4168, lon: -3.7038 }
export const LISBON = { lat: 38.7223, lon: -9.1393 }
export const PARIS = { lat: 48.8566, lon: 2.3522 }
