import { describe, expect, it } from 'vitest'

import { haversineKm, minimumLoopKm, multiPolygonContains } from '@/lib/geo'

const ALGETE = { lat: 40.5964, lon: -3.6318 }
const VELLON = { lat: 40.7917, lon: -3.9635 }

describe('loop geometry', () => {
  it('measures straight-line distance', () => {
    expect(haversineKm(ALGETE, VELLON)).toBeCloseTo(35.4, 0)
  })

  it('a loop through a point needs at least the out-and-back distance', () => {
    // El Vellón is 35.4 km from Algete: a 70 km request can only be an out-and-back.
    expect(minimumLoopKm(ALGETE, [VELLON])).toBeCloseTo(70.8, 0)
  })

  it('imposes no minimum without via points', () => {
    expect(minimumLoopKm(ALGETE, [])).toBe(0)
    expect(minimumLoopKm(null, [VELLON])).toBe(0)
  })
})

describe('multiPolygonContains', () => {
  const square = (lon: number, lat: number, side: number): [number, number][] => [
    [lon, lat],
    [lon + side, lat],
    [lon + side, lat + side],
    [lon, lat + side],
    [lon, lat],
  ]
  const mainlandWithHole = [square(-4, 40, 1), square(-3.6, 40.4, 0.2)]
  const island = [square(2, 39, 0.5)]
  const polygons = [mainlandWithHole, island]

  it('finds points on the mainland and on the island', () => {
    expect(multiPolygonContains(polygons, { lat: 40.2, lon: -3.8 })).toBe(true)
    expect(multiPolygonContains(polygons, { lat: 39.2, lon: 2.2 })).toBe(true)
  })

  it('leaves the sea and the hole outside', () => {
    expect(multiPolygonContains(polygons, { lat: 39.5, lon: 0 })).toBe(false)
    expect(multiPolygonContains(polygons, { lat: 40.5, lon: -3.5 })).toBe(false)
  })
})
