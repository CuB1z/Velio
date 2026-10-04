import polyline from '@mapbox/polyline'
import { describe, expect, it } from 'vitest'

import { boundsOf, decodePolyline } from './polyline'

const ORIGINAL: [number, number][] = [
  [40.5964, -3.6318],
  [40.6112, -3.6001],
  [40.6488, -3.5772],
]

describe('polylines', () => {
  it('decodes with 1e−6 precision into GeoJSON [lng, lat] order', () => {
    const encoded = polyline.encode(ORIGINAL, 6)
    const decoded = decodePolyline(encoded)

    expect(decoded).toHaveLength(3)
    for (const [index, [lng, lat]] of decoded.entries()) {
      expect(lat).toBeCloseTo(ORIGINAL[index][0], 5)
      expect(lng).toBeCloseTo(ORIGINAL[index][1], 5)
    }
  })

  it('returns an empty list for a corrupt string instead of breaking the map', () => {
    expect(decodePolyline('no es una polilínea')).toEqual([])
    expect(decodePolyline('')).toEqual([])
  })

  it('returns the bounding box in fitBounds order', () => {
    const bounds = boundsOf(decodePolyline(polyline.encode(ORIGINAL, 6)))
    expect(bounds).not.toBeNull()
    const [[minLng, minLat], [maxLng, maxLat]] = bounds!
    expect(minLng).toBeLessThan(maxLng)
    expect(minLat).toBeLessThan(maxLat)
    expect(minLat).toBeCloseTo(40.5964, 4)
  })

  it('returns null without points', () => {
    expect(boundsOf([])).toBeNull()
  })
})
