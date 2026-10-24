import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { ThemeToggle } from '@/components/layout/themeToggle'

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

describe('theme toggle', () => {
  it('does not nest a button inside another', () => {
    // Dropdown.Trigger already is the <button>; a nested <Button> is invalid HTML.
    const { container } = render(<ThemeToggle />)
    expect(container.querySelector('button button')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('the trigger restores the flex that .dropdown__trigger removes', () => {
    // .dropdown__trigger forces display:block over .button's inline-flex.
    render(<ThemeToggle />)
    const trigger = screen.getByRole('button', { name: 'Cambiar de tema' })
    expect(trigger.className).toContain('inline-flex')
    expect(trigger.className).toContain('items-center')
    expect(trigger.className).toContain('justify-center')
  })
})
