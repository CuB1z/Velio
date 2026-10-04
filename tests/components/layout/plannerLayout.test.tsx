import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { mapFitPadding } from '@/lib/mapStyles'
import { PlannerLayout } from '@/components/layout/plannerLayout'

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

function Harness() {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <PlannerLayout
      form={<p>formulario</p>}
      map={<p>mapa</p>}
      result={<p>métricas de la ruta</p>}
      resultCollapsed={collapsed}
      onResultCollapsedChange={setCollapsed}
    />
  )
}

describe('PlannerLayout', () => {
  it('hides the result panel when collapsed', async () => {
    render(<Harness />)

    // On mobile the result flows below the map and never collapses, so there are
    // two copies; the button hides the desktop one.
    expect(screen.getAllByText('métricas de la ruta')).toHaveLength(2)

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar panel' }))

    expect(screen.getAllByText('métricas de la ruta')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Ver resultado' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})

describe('mapFitPadding', () => {
  it('stops reserving space when the panel is collapsed', () => {
    // Reserving the gap while collapsed squeezes the route into the top half.
    expect(mapFitPadding(true).bottom).toBe(440)
    expect(mapFitPadding(true, true).bottom).toBe(48)
    expect(mapFitPadding(false).bottom).toBe(48)
  })
})
