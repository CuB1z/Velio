import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { MapControls } from './mapControls'

function renderControls(styleId: 'map' | 'satellite', onStyleChange = vi.fn()) {
  render(
    <MapControls
      styleId={styleId}
      onStyleChange={onStyleChange}
      onZoomIn={vi.fn()}
      onZoomOut={vi.fn()}
    />,
  )
  return onStyleChange
}

// jsdom habla ingles; el resto de la suite fija el idioma igual.
beforeAll(async () => {
  await i18n.changeLanguage('es')
})

describe('MapControls', () => {
  /*
   * Regresión visual: con ToggleButtonGroup de HeroUI el botón *no*
   * seleccionado se pintaba como un botón sólido, así que sobre el satélite el
   * inactivo parecía el activo. Solo uno de los dos puede estar pulsado.
   */
  it('marca como pulsado únicamente el estilo activo', () => {
    renderControls('satellite')

    expect(screen.getByRole('button', { name: 'Satélite' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Mapa' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('solo el activo lleva la píldora', () => {
    /*
     * El fallo era visual, no semántico: con el grupo de HeroUI los dos
     * botones se pintaban con fondo sólido. Un control segmentado solo puede
     * tener uno marcado o no se sabe cuál está puesto.
     */
    renderControls('satellite')

    const selected = ['Mapa', 'Satélite'].filter(
      (name) => screen.getByRole('button', { name }).dataset.selected === 'true',
    )

    expect(selected).toEqual(['Satélite'])
  })

  it('cambia de estilo al pulsar el otro', async () => {
    const onStyleChange = renderControls('map')

    await userEvent.click(screen.getByRole('button', { name: 'Satélite' }))

    expect(onStyleChange).toHaveBeenCalledWith('satellite')
  })
})
