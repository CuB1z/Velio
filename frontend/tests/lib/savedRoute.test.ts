import { describe, expect, it } from 'vitest'

import type { SavedRoute } from '@/types/api'
import { readSavedResult, savedRouteKind } from '@/lib/savedRoute'

const base = {
  id: 'a',
  name: 'Algete 70',
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
}

describe('saved routes', () => {
  it('reads a loop payload', () => {
    const route: SavedRoute = {
      ...base,
      payload: { polyline: 'abc', distance_km: 68.84, gain_m: 922, feasible: true },
    }
    const result = readSavedResult(route)
    expect(result?.distance_km).toBe(68.84)
    expect(savedRouteKind(route)).toBe('loop')
  })

  it('fills missing fields without breaking the screen', () => {
    // cycling_score is nullable in the backend schema: the engine doesn't always score.
    const route: SavedRoute = { ...base, payload: { polyline: 'abc', distance_km: 42 } }
    const result = readSavedResult(route)
    expect(result?.cycling_score).toBeNull()
    expect(result?.overlap_ratio).toBeNull()
    expect(savedRouteKind(route)).toBe('route')
  })

  it('returns null for an unrecognised payload', () => {
    // Old format: better to say so than render an empty route.
    expect(readSavedResult({ ...base, payload: {} })).toBeNull()
    expect(readSavedResult({ ...base, payload: { polyline: '' } })).toBeNull()
    expect(readSavedResult({ ...base, payload: { distance_km: 10 } })).toBeNull()
  })
})
