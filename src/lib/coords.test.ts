import { describe, expect, it } from 'vitest'

import { parseCoordinates } from './coords'

describe('lectura de coordenadas', () => {
  it('acepta punto decimal, que es como se pega desde fuera', () => {
    expect(parseCoordinates('40.5964, -3.6318')).toEqual({ lat: 40.5964, lon: -3.6318 })
    expect(parseCoordinates('40.5964 -3.6318')).toEqual({ lat: 40.5964, lon: -3.6318 })
  })

  it('acepta coma decimal, que es como lo muestra la interfaz', () => {
    expect(parseCoordinates('40,5964 −3,6318')).toEqual({ lat: 40.5964, lon: -3.6318 })
    expect(parseCoordinates('40,5964, -3,6318')).toEqual({ lat: 40.5964, lon: -3.6318 })
  })

  it('rechaza lo que no son exactamente dos números en rango', () => {
    expect(parseCoordinates('40.5964')).toBeNull()
    expect(parseCoordinates('40.5964, -3.6318, 12')).toBeNull()
    expect(parseCoordinates('120, -3.6318')).toBeNull()
    expect(parseCoordinates('Algete')).toBeNull()
  })
})
