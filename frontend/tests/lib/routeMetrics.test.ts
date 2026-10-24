import { describe, expect, it } from 'vitest'

import type { SurfaceScore } from '@/types/api'
import { scoreBars, surfaceSegments } from '@/lib/routeMetrics'

const score: SurfaceScore = {
  comfort: 64.37,
  paved_share: 0.45,
  surface_km: { dirt: 36.44, paved_smooth: 29.86 },
  climb_load_m: 964.76,
  max_grade_pct: 24,
}

describe('surface breakdown', () => {
  it('splits over the real distance, not the sum of known segments', () => {
    // 36.44 + 29.86 = 66.30 of a 68.84 km route: 2.54 km have no attribute.
    const segments = surfaceSegments(score, 68.84)
    const total = segments.reduce((sum, segment) => sum + segment.share, 0)
    expect(total).toBeCloseTo(1, 5)
  })

  it('shows the no-data gap instead of hiding it', () => {
    const segments = surfaceSegments(score, 68.84)
    const unknown = segments.find((segment) => segment.key === '__unknown')
    expect(unknown).toBeDefined()
    expect(unknown?.km).toBeCloseTo(2.54, 2)
  })

  it('adds no segment when the gap is just rounding', () => {
    const segments = surfaceSegments(score, 66.32)
    expect(segments.some((segment) => segment.key === '__unknown')).toBe(false)
  })

  it('sorts from largest to smallest', () => {
    const segments = surfaceSegments(score, 68.84)
    expect(segments[0].key).toBe('dirt')
  })

  it('returns empty without surface data', () => {
    expect(surfaceSegments(null, 70)).toEqual([])
  })
})

describe('score breakdown', () => {
  it("draws no bars when the engine couldn't score", () => {
    // cycling_score is nullable: no edge data, no score.
    expect(scoreBars(null)).toEqual([])
  })

  it('includes elevation when the API returns it', () => {
    const bars = scoreBars({
      distance: 10,
      safety: 6.8,
      surface: 8.4,
      elevation: 9.1,
      overlap_penalty: 0,
      total: 8.1,
    })
    expect(bars.map((bar) => bar.key)).toContain('elevation')
    expect(bars.at(-1)?.penalty).toBe(true)
  })
})

describe('missing surface data', () => {
  // Old saved routes may lack surface_km; must not throw.
  it('marks the whole route as unknown instead of breaking', () => {
    const partial = { comfort: 80, paved_share: 0.9, climb_load_m: 100, max_grade_pct: 8 }
    expect(surfaceSegments(partial as never, 30)).toEqual([
      { key: '__unknown', km: 30, share: 1, paved: false },
    ])
  })
})
