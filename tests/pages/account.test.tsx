import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n from '@/i18n'
import { queryClient } from '@/lib/queryClient'

const CHROME_LINUX =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function serve() {
  const user = { id: 'u1', email: 'marta@velio.cc', full_name: 'Marta Ríos', status: 'active' }
  const tokens = { access_token: 'access', refresh_token: 'refresh-2', token_type: 'bearer' }
  const sessions = [
    { id: 1, created_at: '2026-10-18T08:02:00Z', user_agent: CHROME_LINUX, current: true },
    { id: 2, created_at: '2026-10-11T19:47:00Z', user_agent: SAFARI_IPHONE, current: false },
  ]
  const calls: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url.pathname}`)
    if (url.pathname.endsWith('/auth/refresh')) return json({ user, tokens })
    if (url.pathname.endsWith('/auth/me') && method === 'PATCH') {
      user.full_name = (JSON.parse(String(init?.body)) as { full_name: string }).full_name
      return json(user)
    }
    if (url.pathname.endsWith('/auth/me')) return json(user)
    if (url.pathname.endsWith('/auth/sessions') && method === 'GET') return json(sessions)
    if (url.pathname.endsWith('/auth/sessions/2') && method === 'DELETE') {
      sessions.splice(1, 1)
      return new Response(null, { status: 204 })
    }
    return json({ error: 'NOT_FOUND', message: 'unmocked' }, 404)
  })
  return calls
}

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  queryClient.clear()
  localStorage.clear()
  localStorage.setItem('velio.refresh', 'refresh-1')
  vi.restoreAllMocks()
  window.history.pushState({}, '', '/account')
})

it('renames the account and lists sessions by device', async () => {
  const calls = serve()
  render(<App />)

  expect(await screen.findByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument()
  expect(await screen.findByText('Chrome en Linux')).toBeInTheDocument()
  expect(screen.getByText('Safari en iPhone')).toBeInTheDocument()
  expect(screen.getByText('Esta sesión')).toBeInTheDocument()

  const name = screen.getByRole('textbox', { name: 'Nombre' })
  await userEvent.clear(name)
  await userEvent.type(name, 'Marta Ruiz')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  await waitFor(() => expect(calls).toContain('PATCH /api/v1/auth/me'))
  expect(await screen.findByRole('heading', { level: 2, name: 'Marta Ruiz' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  await waitFor(() => expect(calls).toContain('DELETE /api/v1/auth/sessions/2'))
  await waitFor(() => expect(screen.queryByText('Safari en iPhone')).not.toBeInTheDocument())
})

it('switches theme and language from the preferences', async () => {
  serve()
  render(<App />)
  await screen.findByRole('heading', { level: 1, name: 'Ajustes' })

  const theme = screen.getByRole('group', { name: 'Tema' })
  await userEvent.click(within(theme).getByRole('button', { name: 'Claro' }))
  expect(localStorage.getItem('velio.theme')).toBe('light')
  expect(document.documentElement.classList.contains('light')).toBe(true)

  const language = screen.getByRole('group', { name: 'Idioma' })
  await userEvent.click(within(language).getByRole('button', { name: 'English' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
  await i18n.changeLanguage('es')
})
