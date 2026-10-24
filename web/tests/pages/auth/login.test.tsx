import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n from '@/i18n'

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  window.history.pushState({}, '', '/es/login')
})

it('a 429 keeps the submit disabled with a countdown until Retry-After runs out', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (String(input).includes('/auth/login')) {
      return new Response(
        JSON.stringify({ error: 'RATE_LIMITED', message: 'Too many requests' }),
        { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '1' } },
      )
    }
    return new Response(null, { status: 404 })
  })
  render(<App />)

  await userEvent.type(await screen.findByLabelText(/Correo electrónico/), 'marta@velio.cc')
  await userEvent.type(screen.getByLabelText(/^Contraseña/), 'Ruta2026x')
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

  const waiting = await screen.findByRole('button', { name: 'Espera 1 s' })
  expect(waiting).toBeDisabled()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled(), { timeout: 2500 })
})
