import { MADRID_CENTER } from '@/lib/mapStyles'
import type { BikeType, HillsPreference, LatLon, LoopRequest } from '@/types/api'

export type LoopFormValue = {
  origin: LatLon | null
  via: LatLon[]
  distanceKm: number
  /** Con el objetivo apagado, el motor no persigue desnivel. */
  gainEnabled: boolean
  gainM: number
  /** Con qué bici sales: el filtro de terreno. */
  bike: BikeType
  /** Cuánto desnivel buscar, aparte de la bici. */
  hills: HillsPreference
  waypointCount: number
  maxIterations: number
  routes: number
  includeProfile: boolean
}

/** Los valores por defecto son los del backend, para no pedir lo que ya asume. */
export const DEFAULT_LOOP_FORM: LoopFormValue = {
  // Madrid centro hasta que llegue la posición del navegador, si llega.
  origin: MADRID_CENTER,
  via: [],
  distanceKm: 70,
  gainEnabled: true,
  gainM: 900,
  bike: 'road',
  hills: 'rolling',
  waypointCount: 10,
  maxIterations: 8,
  routes: 1,
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
    routes: value.routes > 1 ? value.routes : undefined,
    // Sin `costing`: la bici ya es el `bicycle_type`. Enviarlo aparte era el
    // bug que hacía que el selector no cambiase nada, porque el costing crudo
    // gana siempre y sobrescribía la bici elegida.
    include_profile: value.includeProfile,
  }
}

