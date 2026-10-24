import type { AnyRouteResult, CyclingScore, SurfaceScore } from '@/types/api'

/** i18n key for a surface type; unknown types fall back to the raw name. */
export function surfaceLabelKey(key: string): string {
  return `surface.${key}`
}

export type SurfaceSegment = {
  key: string
  km: number
  /** Share of the total distance, not of the known segments' sum. */
  share: number
  paved: boolean
}

const PAVED_KEYS = new Set(['paved', 'paved_smooth', 'paved_rough'])

/**
 * Surface breakdown over the real distance. `surface_km` may not add up (edges
 * without a surface attribute), so the gap is shown as "no data".
 */
export function surfaceSegments(
  score: SurfaceScore | null,
  distanceKm: number,
): SurfaceSegment[] {
  if (!score || distanceKm <= 0) return []

  // Old saved payloads may lack surface_km; the gap below then covers it all.
  const entries = Object.entries(score.surface_km ?? {})
    .filter(([, km]) => km > 0)
    .sort((a, b) => b[1] - a[1])

  const known = entries.reduce((sum, [, km]) => sum + km, 0)
  const segments: SurfaceSegment[] = entries.map(([key, km]) => ({
    key,
    km,
    share: km / distanceKm,
    paved: PAVED_KEYS.has(key),
  }))

  // Ignore rounding gaps of a few tens of metres.
  const gap = distanceKm - known
  if (gap > 0.05) {
    segments.push({
      key: '__unknown',
      km: gap,
      share: gap / distanceKm,
      paved: false,
    })
  }

  return segments
}

export type ScoreBar = { key: string; label: string; value: number; penalty: boolean }

/** 0-10 score breakdown bars; empty when the engine couldn't score. */
export function scoreBars(score: CyclingScore | null): ScoreBar[] {
  if (!score) return []
  const bars: ScoreBar[] = [
    { key: 'distance', label: 'Distancia', value: score.distance, penalty: false },
    { key: 'safety', label: 'Tráfico', value: score.safety, penalty: false },
    { key: 'surface', label: 'Firme', value: score.surface, penalty: false },
  ]
  if (typeof score.elevation === 'number') {
    bars.push({ key: 'elevation', label: 'Desnivel', value: score.elevation, penalty: false })
  }
  bars.push({
    key: 'overlap_penalty',
    label: 'Solape',
    value: score.overlap_penalty,
    penalty: true,
  })
  return bars
}

/** Overlap subtracts up to 5 points; drawn on that scale, not 10. */
export const OVERLAP_PENALTY_MAX = 5

/** i18n key for the comfort band of a surface score. */
export function comfortLabelKey(comfort: number): string {
  if (comfort >= 80) return 'metric.comfort.excellent'
  if (comfort >= 65) return 'metric.comfort.good'
  if (comfort >= 45) return 'metric.comfort.fair'
  return 'metric.comfort.demanding'
}

/** Loop results carry `feasible`; route results don't. */
export function isLoopResult(result: AnyRouteResult): boolean {
  return typeof result.feasible === 'boolean'
}

/** All tracks of a result: the main one first, then the alternatives. */
export function allVariants(result: AnyRouteResult): AnyRouteResult[] {
  return [result, ...((result.alternatives ?? []) as AnyRouteResult[])]
}
