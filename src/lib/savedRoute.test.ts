import { describe, expect, it } from 'vitest'

import type { SavedRoute } from '@/types/api'
import { readSavedResult, savedRouteKind } from './savedRoute'

const base = {
  id: 'a',
  name: 'Algete 70',
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
}

describe('rutas guardadas', () => {
  it('lee el payload de un circuito', () => {
    const route: SavedRoute = {
      ...base,
      payload: { polyline: 'abc', distance_km: 68.84, gain_m: 922, feasible: true },
    }
    const result = readSavedResult(route)
    expect(result?.distance_km).toBe(68.84)
    expect(savedRouteKind(route)).toBe('loop')
  })

  it('completa lo que falte sin romper la pantalla', () => {
    // cycling_score es nullable en el esquema del backend: el motor no siempre puntúa.
    const route: SavedRoute = { ...base, payload: { polyline: 'abc', distance_km: 42 } }
    const result = readSavedResult(route)
    expect(result?.cycling_score).toBeNull()
    expect(result?.overlap_ratio).toBeNull()
    expect(savedRouteKind(route)).toBe('route')
  })

  it('devuelve null cuando el payload ya no se reconoce', () => {
    // Guardado con un formato antiguo: mejor decirlo que pintar una ruta vacía.
    expect(readSavedResult({ ...base, payload: {} })).toBeNull()
    expect(readSavedResult({ ...base, payload: { polyline: '' } })).toBeNull()
    expect(readSavedResult({ ...base, payload: { distance_km: 10 } })).toBeNull()
  })
})
