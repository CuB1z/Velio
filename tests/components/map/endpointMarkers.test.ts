import { describe, expect, it } from 'vitest'

import { endpointMarkers } from '@/components/map/endpointMarkers'
import type { LngLat } from '@/lib/polyline'

const START: LngLat = [-3.7038, 40.4168]

describe('endpointMarkers', () => {
  it('marks only the start of a closed loop', () => {
    const loop: LngLat[] = [START, [-3.69, 40.43], [-3.7037, 40.4169]]
    expect(endpointMarkers(loop).map((m) => m.kind)).toEqual(['start'])
  })

  it('marks the finish of a point-to-point route', () => {
    const route: LngLat[] = [START, [-3.69, 40.43], [-3.96, 40.785]]
    const markers = endpointMarkers(route)
    expect(markers.map((m) => m.kind)).toEqual(['start', 'end'])
    expect(markers[1].coordinate).toEqual([-3.96, 40.785])
  })

  it('needs a line to mark anything', () => {
    expect(endpointMarkers([START])).toEqual([])
  })
})
