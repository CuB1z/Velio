import type { AnyRouteResult, CyclingScore, SurfaceScore } from '@/types/api'

/** Clave i18n del firme. Un tipo desconocido cae a su propio nombre crudo. */
export function surfaceLabelKey(key: string): string {
  return `surface.${key}`
}

export type SurfaceSegment = {
  key: string
  km: number
  /** Fracción sobre la distancia total, no sobre la suma de tramos conocidos. */
  share: number
  paved: boolean
}

const PAVED_KEYS = new Set(['paved', 'paved_smooth', 'paved_rough'])

/**
 * Desglose de firme normalizado sobre la distancia real.
 *
 * `surface_km` no siempre suma la distancia total: hay aristas sin atributo de
 * firme. Repartirlo como porcentaje de la suma miente sobre el recorrido, así
 * que el hueco se muestra explícitamente como "sin datos".
 */
export function surfaceSegments(
  score: SurfaceScore | null,
  distanceKm: number,
): SurfaceSegment[] {
  if (!score || distanceKm <= 0) return []

  // Un payload guardado hace meses puede no traer el reparto de firme; sin
  // tramos conocidos el hueco de abajo lo marca entero como desconocido.
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

  // Un redondeo de decenas de metros no merece un tramo propio.
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

/**
 * Barras del desglose 0-10. `elevation` solo existe si hubo objetivo de
 * desnivel, y el bloque entero falta cuando el motor no pudo puntuar.
 */
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

/** El solape resta hasta 5 puntos; se dibuja sobre esa escala, no sobre 10. */
export const OVERLAP_PENALTY_MAX = 5

/** Clave i18n del tramo de confort en el que cae la puntuación de firme. */
export function comfortLabelKey(comfort: number): string {
  if (comfort >= 80) return 'metric.comfort.excellent'
  if (comfort >= 65) return 'metric.comfort.good'
  if (comfort >= 45) return 'metric.comfort.fair'
  return 'metric.comfort.demanding'
}

/** Un resultado de loop trae `feasible`; uno de route, no. */
export function isLoopResult(result: AnyRouteResult): boolean {
  return typeof result.feasible === 'boolean'
}

/** Todos los trazados de un resultado: el principal primero, luego las alternativas. */
export function allVariants(result: AnyRouteResult): AnyRouteResult[] {
  return [result, ...((result.alternatives ?? []) as AnyRouteResult[])]
}
