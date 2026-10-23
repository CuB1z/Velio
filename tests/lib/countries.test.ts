import { describe, expect, it } from 'vitest'

import { countryOptions, preferredCountry } from '@/lib/countries'

describe('countryOptions', () => {
  it('names every country in the UI language, sorted by that name', () => {
    const options = countryOptions('es-ES', [])
    expect(options).toHaveLength(249)
    expect(options.find((option) => option.code === 'FR')?.name).toBe('Francia')
    const names = options.map((option) => option.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es-ES')))
  })

  it('leaves the covered countries out', () => {
    const codes = countryOptions('en-GB', ['ES', 'PT', 'AD']).map((option) => option.code)
    expect(codes).not.toContain('ES')
    expect(codes).not.toContain('PT')
    expect(codes).toContain('FR')
  })
})

describe('preferredCountry', () => {
  it('takes the first explicit region still to cover', () => {
    expect(preferredCountry(['fr-FR', 'en-US'], ['ES'])).toBe('FR')
    expect(preferredCountry(['es-ES', 'pt-BR'], ['ES', 'PT'])).toBe('BR')
  })

  it('does not guess a region from a bare language', () => {
    expect(preferredCountry(['es-ES', 'es', 'en'], ['ES', 'PT', 'AD'])).toBeNull()
  })
})
