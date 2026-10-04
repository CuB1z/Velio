import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { mapFitPadding } from '@/lib/mapStyles'
import { PlannerLayout } from './plannerLayout'

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
  it('oculta el panel de resultado al plegarlo', async () => {
    render(<Harness />)

    // En móvil el resultado va en flujo debajo del mapa y no se pliega, así
    // que hay dos copias; la de escritorio es la que el botón esconde.
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
  it('deja de reservar hueco cuando el panel está plegado', () => {
    /*
     * Las tres páginas repetían el 440 a mano. Al plegar el panel el hueco
     * seguía reservado y la ruta quedaba encajada en la mitad de arriba.
     */
    expect(mapFitPadding(true).bottom).toBe(440)
    expect(mapFitPadding(true, true).bottom).toBe(48)
    expect(mapFitPadding(false).bottom).toBe(48)
  })
})
