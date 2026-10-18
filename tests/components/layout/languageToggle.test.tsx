import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeAll, describe, expect, it } from 'vitest'

import { LanguageToggle } from '@/components/layout/languageToggle'
import i18n from '@/i18n'

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

function LocationProbe() {
  const { pathname, search } = useLocation()
  return <output>{pathname + search}</output>
}

describe('language toggle', () => {
  it('does not nest a button inside another', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/es']}>
        <LanguageToggle />
      </MemoryRouter>,
    )
    expect(container.querySelector('button button')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('lists every language and moves the page under the chosen prefix', async () => {
    render(
      <MemoryRouter initialEntries={['/es/loops?x=1']}>
        <LanguageToggle />
        <LocationProbe />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Cambiar de idioma' }))
    expect(await screen.findByRole('menuitemradio', { name: 'Español' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'English' }))

    expect(screen.getByRole('status')).toHaveTextContent('/loops?x=1')
  })
})
