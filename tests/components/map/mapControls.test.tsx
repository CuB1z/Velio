import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { MapControls } from '@/components/map/mapControls'

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

// jsdom defaults to English; pin the language like the rest of the suite.
beforeAll(async () => {
  await i18n.changeLanguage('es')
})

describe('MapControls', () => {
  // Regression guard: HeroUI's ToggleButtonGroup painted both buttons solid.
  it('marks only the active style as pressed', () => {
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

  it('only the active style gets the pill', () => {
    renderControls('satellite')

    const selected = ['Mapa', 'Satélite'].filter(
      (name) => screen.getByRole('button', { name }).dataset.selected === 'true',
    )

    expect(selected).toEqual(['Satélite'])
  })

  it('switches style when the other one is pressed', async () => {
    const onStyleChange = renderControls('map')

    await userEvent.click(screen.getByRole('button', { name: 'Satélite' }))

    expect(onStyleChange).toHaveBeenCalledWith('satellite')
  })
})
