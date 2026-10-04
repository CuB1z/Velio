import { describe, expect, it } from 'vitest'

import { haversineKm, minimumLoopKm } from './geo'

const ALGETE = { lat: 40.5964, lon: -3.6318 }
const VELLON = { lat: 40.7917, lon: -3.9635 }

describe('geometría del circuito', () => {
  it('mide la distancia en línea recta', () => {
    expect(haversineKm(ALGETE, VELLON)).toBeCloseTo(35.4, 0)
  })

  it('un circuito por un punto necesita al menos ir y volver', () => {
    // El caso que motivó el aviso: El Vellón está a 35,4 km de Algete, así que
    // pedir 70 km no da un circuito, da una ida y vuelta por el mismo camino.
    expect(minimumLoopKm(ALGETE, [VELLON])).toBeCloseTo(70.8, 0)
  })

  it('sin puntos de paso no hay mínimo que imponer', () => {
    expect(minimumLoopKm(ALGETE, [])).toBe(0)
    expect(minimumLoopKm(null, [VELLON])).toBe(0)
  })
})
