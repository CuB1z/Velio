import type { AnyRouteResult, SavedRoute } from '@/types/api'

/**
 * The payload is the raw response of the endpoint that produced it; validate
 * just enough to render it, since old saved routes may lack fields.
 */
export function readSavedResult(route: SavedRoute): AnyRouteResult | null {
  const payload = route.payload as Partial<AnyRouteResult> | undefined
  if (!payload || typeof payload.polyline !== 'string' || payload.polyline.length === 0) {
    return null
  }
  if (typeof payload.distance_km !== 'number') return null

  return {
    distance_km: payload.distance_km,
    gain_m: payload.gain_m ?? 0,
    loss_m: payload.loss_m ?? 0,
    polyline: payload.polyline,
    duration_min: payload.duration_min ?? 0,
    overlap_ratio: payload.overlap_ratio ?? null,
    score: payload.score ?? null,
    cycling_score: payload.cycling_score ?? null,
    profile: payload.profile ?? null,
    alternatives: payload.alternatives ?? null,
    feasible: payload.feasible,
    iterations: payload.iterations,
  }
}

/** Loops carry `feasible`; point-to-point routes don't. */
export function savedRouteKind(route: SavedRoute): 'loop' | 'route' {
  return typeof (route.payload as { feasible?: unknown } | undefined)?.feasible === 'boolean'
    ? 'loop'
    : 'route'
}
