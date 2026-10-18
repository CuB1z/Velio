import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n from '@/i18n'

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

it('a rejected refresh token is cleared from storage and the user lands on the login', async () => {
  localStorage.setItem('velio.refresh', 'reused-token')
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
    String(input).includes('/auth/refresh')
      ? new Response(JSON.stringify({ error: 'INVALID_REFRESH_TOKEN', message: 'reused' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      : new Response(null, { status: 404 }),
  )
  window.history.pushState({}, '', '/es/loops')
  render(<App />)

  expect(await screen.findByRole('heading', { name: 'Vuelve a la carretera' })).toBeInTheDocument()
  await waitFor(() => expect(localStorage.getItem('velio.refresh')).toBeNull())
})
