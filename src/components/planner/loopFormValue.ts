import { MADRID_CENTER } from '@/lib/mapStyles'
import type { BikeType, HillsPreference, LatLon, LoopRequest } from '@/types/api'

export type LoopFormValue = {
  origin: LatLon | null
  via: LatLon[]
  distanceKm: number
  /** With the target off, the engine does not chase elevation gain. */
  gainEnabled: boolean
  gainM: number
  /** Which bike you ride: the terrain filter. */
  bike: BikeType
  /** How much climbing to look for, independent of the bike. */
  hills: HillsPreference
  waypointCount: number
  maxIterations: number
  alternatives: number
  includeProfile: boolean
}

/** Defaults match the backend's, so we never ask for what it already assumes. */
export const DEFAULT_LOOP_FORM: LoopFormValue = {
  // Central Madrid until the browser position arrives, if it ever does.
  origin: MADRID_CENTER,
  via: [],
  distanceKm: 70,
  gainEnabled: true,
  gainM: 900,
  bike: 'road',
  hills: 'rolling',
  waypointCount: 10,
  maxIterations: 8,
  alternatives: 0,
  includeProfile: true,
}

export const DISTANCE_TOLERANCE = 0.05
export const GAIN_TOLERANCE = 0.2

export function toLoopRequest(value: LoopFormValue): LoopRequest | null {
  if (!value.origin) return null
  return {
    origin: value.origin,
    distance_km: value.distanceKm,
    gain_m: value.gainEnabled && value.gainM > 0 ? value.gainM : undefined,
    via: value.via.length > 0 ? value.via : undefined,
    tolerance: DISTANCE_TOLERANCE,
    gain_tolerance: value.gainEnabled ? GAIN_TOLERANCE : undefined,
    waypoint_count: value.waypointCount,
    max_iterations: value.maxIterations,
    bike: value.bike,
    hills: value.hills,
    routes: value.alternatives > 0 ? value.alternatives + 1 : undefined,
    // No `costing`: the bike already is the `bicycle_type`, and a raw costing
    // always wins in the backend and would override it.
    include_profile: value.includeProfile,
  }
}

