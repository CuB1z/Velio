import type { StyleSpecification } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'

import { styleFor, tintStyle, tintToCharcoal } from '@/lib/mapStyles'

describe('tintToCharcoal', () => {
  it('moves every colour notation onto neutral greys and keeps alpha', () => {
    expect(tintToCharcoal('#000')).toBe('hsla(0, 0%, 4.0%, 1)')
    expect(tintToCharcoal('rgb(27 ,27 ,29)')).toMatch(/^hsla\(0, 0%, /)
    expect(tintToCharcoal('rgba(0,0,0,0.7)')).toBe('hsla(0, 0%, 4.0%, 0.7)')
    expect(tintToCharcoal('hsla(0,0%,85%,0.53)')).toMatch(/, 0\.53\)$/)
  })

  it('preserves lightness order', () => {
    const l = (c: string) => Number(tintToCharcoal(c).split(', ')[2].replace('%', ''))
    expect(l('#000')).toBeLessThan(l('rgb(12,12,12)'))
    expect(l('rgb(12,12,12)')).toBeLessThan(l('#181818'))
  })

  it('leaves non-colour strings in expressions alone', () => {
    const style = {
      version: 8,
      sources: {},
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': 'rgb(12,12,12)' } },
        {
          id: 'motorway',
          type: 'line',
          source: 's',
          paint: { 'line-color': ['interpolate', ['linear'], ['zoom'], 5.8, 'hsla(0,0%,85%,0.53)', 6, '#000'] },
        },
      ],
    } as StyleSpecification
    const [bg, motorway] = tintStyle(style).layers as { paint: Record<string, unknown> }[]
    expect(bg.paint['background-color']).toMatch(/^hsla\(0, 0%/)
    const expression = motorway.paint['line-color'] as unknown[]
    expect(expression.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']])
    expect(expression[6]).toBe('hsla(0, 0%, 4.0%, 1)')
  })
})

describe('satellite style', () => {
  const style = styleFor('satellite', false) as StyleSpecification

  it('draws one global imagery layer', () => {
    expect(style.layers.map((layer) => layer.id)).toEqual(['imagery'])
    expect((style.sources.imagery as { tiles: string[] }).tiles[0]).toContain('World_Imagery')
  })

  it('credits the imagery provider', () => {
    expect((style.sources.imagery as { attribution: string }).attribution).toContain('Esri')
  })
})
