import { describe, expect, it } from 'vitest'

import { parseCoordinates } from '@/lib/coords'

describe('coordinate parsing', () => {
  it('accepts dot decimals, as pasted from elsewhere', () => {
    expect(parseCoordinates('40.5964, -3.6318')).toEqual({ lat: 40.5964, lon: -3.6318 })
    expect(parseCoordinates('40.5964 -3.6318')).toEqual({ lat: 40.5964, lon: -3.6318 })
  })

  it('accepts comma decimals, as the UI shows them', () => {
    expect(parseCoordinates('40,5964 −3,6318')).toEqual({ lat: 40.5964, lon: -3.6318 })
    expect(parseCoordinates('40,5964, -3,6318')).toEqual({ lat: 40.5964, lon: -3.6318 })
  })

  it('rejects anything but exactly two in-range numbers', () => {
    expect(parseCoordinates('40.5964')).toBeNull()
    expect(parseCoordinates('40.5964, -3.6318, 12')).toBeNull()
    expect(parseCoordinates('120, -3.6318')).toBeNull()
    expect(parseCoordinates('Algete')).toBeNull()
  })
})
