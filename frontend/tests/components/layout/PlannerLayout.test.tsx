import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { mapFitPadding } from '@/lib/mapStyles'
import { PlannerLayout } from '@/components/layout/PlannerLayout'

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

describe('PlannerLayout map notice', () => {
  it('puts the notice over the map, next to the result and above the sheet', () => {
    render(
      <PlannerLayout
        form={<p>formulario</p>}
        map={<p>mapa</p>}
        result={<p>métricas de la ruta</p>}
        mapNotice="Pulsa en el mapa para colocar el punto"
      />,
    )
    const [sheetCopy, mapCopy] = screen.getAllByRole('status')
    expect(sheetCopy.closest('aside')).not.toBeNull()
    expect(mapCopy.closest('aside')).toBeNull()
    expect(mapCopy.parentElement).toContainElement(screen.getAllByText('métricas de la ruta').at(-1) ?? null)
  })

  it('renders nothing over the map without a notice', () => {
    render(<PlannerLayout form={<p>formulario</p>} map={<p>mapa</p>} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('PlannerLayout on mobile', () => {
  function Sheet({ withResult }: { withResult: boolean }) {
    return <PlannerLayout form={<p>formulario</p>} map={<p>mapa</p>} result={withResult ? <p>métricas</p> : undefined} />
  }

  it('opens with the form and drops to the peek when a result arrives', () => {
    const { rerender } = render(<Sheet withResult={false} />)
    expect(screen.getByRole('button', { name: 'Plegar el panel' })).toHaveAttribute('aria-expanded', 'true')

    rerender(<Sheet withResult />)
    expect(screen.getByRole('button', { name: 'Desplegar el panel' })).toBeInTheDocument()
    expect(screen.getByText('formulario').parentElement).toHaveClass('max-lg:hidden')
  })

  it('taps between full and peek and hides with the arrow keys', async () => {
    render(<Sheet withResult={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Plegar el panel' }))
    const handle = screen.getByRole('button', { name: 'Desplegar el panel' })

    handle.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: 'Mostrar el panel' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('formulario').closest('.panel-scroll')).toHaveClass('max-lg:hidden')

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar el panel' }))
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('button', { name: 'Plegar el panel' })).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('mapFitPadding', () => {
  it('stops reserving space when the panel is collapsed', () => {
    // Reserving the gap while collapsed squeezes the route into the top half.
    expect(mapFitPadding(true).bottom).toBe(320)
    expect(mapFitPadding(true, true).bottom).toBe(48)
    expect(mapFitPadding(false).bottom).toBe(48)
  })
})
