import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n from '@/i18n'
import { queryClient } from '@/lib/queryClient'

const SESSION = {
  user: { id: 'u1', email: 'marta@velio.cc', full_name: 'Marta Ríos', status: 'active' },
  tokens: { access_token: 'access', refresh_token: 'refresh-2', token_type: 'bearer' },
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  queryClient.clear()
  localStorage.clear()
  localStorage.setItem('velio.refresh', 'refresh-1')
  vi.restoreAllMocks()
  window.history.pushState({}, '', '/saved')
})

it('signing out revokes the session and lands on the public landing', async () => {
  const calls: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    calls.push(`${init?.method ?? 'GET'} ${url}`)
    if (url.includes('/auth/refresh')) return json(SESSION)
    if (url.includes('/auth/logout')) return new Response(null, { status: 204 })
    if (url.includes('/routes/saved')) {
      return json({ data: [], meta: { page: 1, limit: 12, total: 0, total_pages: 1, is_last: true } })
    }
    return new Response(null, { status: 404 })
  })
  render(<App />)

  await userEvent.click((await screen.findAllByRole('button', { name: 'Ajustes de cuenta' }))[0])
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Cerrar sesión' }))

  expect(await screen.findByRole('heading', { level: 1, name: /Circuitos a tu medida/ })).toBeInTheDocument()
  await waitFor(() => expect(calls).toContain('POST /api/v1/auth/logout'))
  expect(localStorage.getItem('velio.refresh')).toBeNull()
  expect(window.location.pathname).toBe('/')
})
