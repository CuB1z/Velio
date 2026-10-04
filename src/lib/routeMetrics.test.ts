import { describe, expect, it } from 'vitest'

import type { SurfaceScore } from '@/types/api'
import { scoreBars, surfaceSegments } from './routeMetrics'

const score: SurfaceScore = {
  comfort: 64.37,
  paved_share: 0.45,
  surface_km: { dirt: 36.44, paved_smooth: 29.86 },
  climb_load_m: 964.76,
  max_grade_pct: 24,
}

describe('desglose de firme', () => {
  it('reparte sobre la distancia real, no sobre la suma de tramos conocidos', () => {
    // 36,44 + 29,86 = 66,30 de una ruta de 68,84: faltan 2,54 km sin atributo.
    const segments = surfaceSegments(score, 68.84)
    const total = segments.reduce((sum, segment) => sum + segment.share, 0)
    expect(total).toBeCloseTo(1, 5)
  })

  it('muestra el hueco sin datos en vez de esconderlo', () => {
    const segments = surfaceSegments(score, 68.84)
    const unknown = segments.find((segment) => segment.key === '__unknown')
    expect(unknown).toBeDefined()
    expect(unknown?.km).toBeCloseTo(2.54, 2)
  })

  it('no inventa un tramo cuando el hueco es puro redondeo', () => {
    const segments = surfaceSegments(score, 66.32)
    expect(segments.some((segment) => segment.key === '__unknown')).toBe(false)
  })

  it('ordena de mayor a menor', () => {
    const segments = surfaceSegments(score, 68.84)
    expect(segments[0].key).toBe('dirt')
  })

  it('devuelve vacío sin datos de firme', () => {
    expect(surfaceSegments(null, 70)).toEqual([])
  })
})

describe('desglose de puntuación', () => {
  it('no dibuja barras cuando el motor no pudo puntuar', () => {
    // cycling_score es nullable en el esquema: sin datos de arista no hay nota.
    expect(scoreBars(null)).toEqual([])
  })

  it('incluye el desnivel cuando la API lo devuelve', () => {
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

describe('firme ausente', () => {
  // Una ruta guardada antigua puede no traer surface_km; no debe lanzar.
  it('da el recorrido entero como desconocido en vez de romperse', () => {
    const partial = { comfort: 80, paved_share: 0.9, climb_load_m: 100, max_grade_pct: 8 }
    expect(surfaceSegments(partial as never, 30)).toEqual([
      { key: '__unknown', km: 30, share: 1, paved: false },
    ])
  })
})
