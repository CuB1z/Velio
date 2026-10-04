import type { StyleSpecification } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'

import { tintStyle, tintToSlate } from '@/lib/mapStyles'

describe('tintToSlate', () => {
  it('moves every grey notation onto the slate hue and keeps alpha', () => {
    expect(tintToSlate('#000')).toBe('hsla(210, 24.3%, 6.5%, 1)')
    expect(tintToSlate('rgb(27 ,27 ,29)')).toMatch(/^hsla\(210, /)
    expect(tintToSlate('rgba(0,0,0,0.7)')).toBe('hsla(210, 24.3%, 6.5%, 0.7)')
    expect(tintToSlate('hsla(0,0%,85%,0.53)')).toMatch(/, 0\.53\)$/)
  })

  it('preserves lightness order', () => {
    const l = (c: string) => Number(tintToSlate(c).split(', ')[2].replace('%', ''))
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
    expect(bg.paint['background-color']).toMatch(/^hsla\(210/)
    const expression = motorway.paint['line-color'] as unknown[]
    expect(expression.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']])
    expect(expression[6]).toBe('hsla(210, 24.3%, 6.5%, 1)')
  })
})
