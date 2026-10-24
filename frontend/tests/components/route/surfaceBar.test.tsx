import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import type { SurfaceScore } from '@/types/api'
import { SurfaceBar } from '@/components/route/surfaceBar'

const score: SurfaceScore = {
  comfort: 64.37,
  paved_share: 0.45,
  surface_km: { dirt: 36.44, paved_smooth: 29.86 },
  climb_load_m: 964.76,
  max_grade_pct: 24,
}

beforeAll(async () => {
  // jsdom reports navigator.language = en-US; pin the test language.
  await i18n.changeLanguage('es')
})

describe('surface bar', () => {
  it('labels each segment by name', () => {
    // Required, not decorative: the palette's orange/green pair needs a secondary encoding.
    render(<SurfaceBar score={score} distanceKm={68.84} />)

    expect(screen.getByText('Tierra')).toBeInTheDocument()
    expect(screen.getByText('Asfalto liso')).toBeInTheDocument()
  })

  it('names the no-data segment instead of spreading it over the others', () => {
    render(<SurfaceBar score={score} distanceKm={68.84} />)
    expect(screen.getByText('Sin datos de firme')).toBeInTheDocument()
  })

  it('warns when the backend returns no surface data', () => {
    render(<SurfaceBar score={null} distanceKm={68.84} />)
    expect(screen.getByText('Sin datos de firme')).toBeInTheDocument()
  })
})
