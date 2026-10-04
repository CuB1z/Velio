import { describe, expect, it } from 'vitest'

import { haversineKm, minimumLoopKm } from '@/lib/geo'

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
