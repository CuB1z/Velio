import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { ThemeToggle } from './themeToggle'

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

describe('selector de tema', () => {
  it('no anida un botón dentro de otro', () => {
    // Dropdown.Trigger ya es el <button>; meter un <Button> dentro produce
    // <button><button>, HTML inválido que el navegador avisa por consola.
    const { container } = render(<ThemeToggle />)
    expect(container.querySelector('button button')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('el disparador recupera el flex que .dropdown__trigger le quita', () => {
    // .dropdown__trigger impone display:block y gana a .button. Sin devolver
    // inline-flex, el icono se pega al borde izquierdo y el fondo del hover
    // se ve desplazado respecto a él.
    render(<ThemeToggle />)
    const trigger = screen.getByRole('button', { name: 'Cambiar de tema' })
    expect(trigger.className).toContain('inline-flex')
    expect(trigger.className).toContain('items-center')
    expect(trigger.className).toContain('justify-center')
  })
})
