import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import type { SurfaceScore } from '@/types/api'
import { SurfaceBar } from './surfaceBar'

const score: SurfaceScore = {
  comfort: 64.37,
  paved_share: 0.45,
  surface_km: { dirt: 36.44, paved_smooth: 29.86 },
  climb_load_m: 964.76,
  max_grade_pct: 24,
}

beforeAll(async () => {
  // jsdom dice navigator.language = en-US; fijamos el idioma del test.
  await i18n.changeLanguage('es')
})

describe('barra de firme', () => {
  it('etiqueta cada tramo por su nombre', () => {
    // No es decorativo: el par naranja↔verde de la paleta está en la banda baja
    // de tritanopía y solo es admisible con codificación secundaria. Si estas
    // etiquetas desaparecen, el gráfico deja de ser accesible.
    render(<SurfaceBar score={score} distanceKm={68.84} />)

    expect(screen.getByText('Tierra')).toBeInTheDocument()
    expect(screen.getByText('Asfalto liso')).toBeInTheDocument()
  })

  it('nombra el tramo sin datos en vez de repartirlo entre los demás', () => {
    render(<SurfaceBar score={score} distanceKm={68.84} />)
    expect(screen.getByText('Sin datos de firme')).toBeInTheDocument()
  })

  it('avisa cuando el backend no devuelve firme', () => {
    render(<SurfaceBar score={null} distanceKm={68.84} />)
    expect(screen.getByText('Sin datos de firme')).toBeInTheDocument()
  })
})
