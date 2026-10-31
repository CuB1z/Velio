import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n from '@/i18n'
import { queryClient } from '@/lib/queryClient'

vi.mock('@/components/map/LazyMap', () => ({ LazyMap: () => <div data-testid="map" /> }))

const SESSION = {
  user: { id: 'u1', email: 'marta@velio.cc', full_name: 'Marta Ríos', status: 'active' },
  tokens: { access_token: 'access', refresh_token: 'refresh-2', token_type: 'bearer' },
}

const SAVED = {
  id: 'r1',
  name: 'Madrid a Navacerrada',
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  payload: {
    distance_km: 96.4,
    gain_m: 1292,
    loss_m: 1292,
    feasible: true,
    iterations: 2,
    polyline: 'gjk_lA~dmdFw{l@_~P?_t`Bv{l@~rrB',
    duration_min: 318,
    overlap_ratio: 0.03,
    score: null,
    cycling_score: null,
    profile: null,
    alternatives: null,
  },
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

function serve() {
  const calls: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url.pathname}`)
    if (url.pathname.endsWith('/auth/refresh')) return json(SESSION)
    if (url.pathname.endsWith('/routes/saved/r1') && method === 'GET') return json(SAVED)
    if (url.pathname.endsWith('/routes/saved/r1') && method === 'DELETE') return new Response(null, { status: 204 })
    if (url.pathname.endsWith('/routes/saved') && method === 'GET') {
      return json({ data: [], meta: { page: 1, limit: 12, total: 0, total_pages: 1, is_last: true } })
    }
    return new Response(null, { status: 404 })
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
  window.history.pushState({}, '', '/es/saved/r1')
})

afterEach(() => vi.unstubAllGlobals())

it('keeps Export beside one menu on desktop and goes back to the list after a delete', async () => {
  const calls = serve()
  render(<App />)

  expect(await screen.findByRole('heading', { level: 1, name: 'Madrid a Navacerrada' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Renombrar' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Acciones de Madrid a Navacerrada' }))
  const menu = await screen.findByRole('menu')
  expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
    'Renombrar',
    'Volver a calcular',
    'Eliminar',
  ])
  await userEvent.click(within(menu).getByRole('menuitem', { name: 'Eliminar' }))
  const confirm = await screen.findByRole('dialog', { name: '¿Eliminar la ruta?' })
  await userEvent.click(within(confirm).getByRole('button', { name: 'Eliminar' }))

  await waitFor(() => expect(window.location.pathname).toBe('/es/saved'))
  expect(calls).toContain('DELETE /api/v1/routes/saved/r1')
})

it('moves the exports into the action sheet on a phone', async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(width < 48rem)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  serve()
  render(<App />)

  await userEvent.click(await screen.findByRole('button', { name: 'Acciones de Madrid a Navacerrada' }))
  expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument()
  const sheet = await screen.findByRole('dialog', { name: 'Madrid a Navacerrada' })
  expect(within(sheet).getByText('Circuito · 96,4 km')).toBeInTheDocument()
  expect(
    within(sheet)
      .getAllByRole('button')
      .map((button) => button.textContent),
  ).toEqual(['Renombrar', 'Volver a calcular', 'Exportar GPX', 'Exportar GeoJSON', 'Eliminar', 'Cancelar'])
})
