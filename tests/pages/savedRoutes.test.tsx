import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n from '@/i18n'
import { queryClient } from '@/lib/queryClient'

const SESSION = {
  user: { id: 'u1', email: 'marta@velio.cc', full_name: 'Marta Ríos', status: 'active' },
  tokens: { access_token: 'access', refresh_token: 'refresh-2', token_type: 'bearer' },
}

const route = (id: string, name: string) => ({
  id,
  name,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  payload: {
    distance_km: 30.4,
    gain_m: 312,
    loss_m: 312,
    feasible: true,
    iterations: 2,
    polyline: 'gjk_lA~dmdFw{l@_~P?_t`Bv{l@~rrB',
    duration_min: 94,
    overlap_ratio: 0.03,
    score: null,
    cycling_score: null,
    profile: null,
    alternatives: null,
  },
})

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

function serve(rows: ReturnType<typeof route>[]) {
  const calls: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url.pathname}${url.search}`)
    if (url.pathname.endsWith('/auth/refresh')) return json(SESSION)
    if (url.pathname.endsWith('/routes/saved') && method === 'GET') {
      const page = Number(url.searchParams.get('page'))
      const limit = Number(url.searchParams.get('limit'))
      const totalPages = Math.max(1, Math.ceil(rows.length / limit))
      return json({
        data: rows.slice((page - 1) * limit, page * limit),
        meta: { page, limit, total: rows.length, total_pages: totalPages, is_last: page >= totalPages },
      })
    }
    if (url.pathname.endsWith('/routes/saved') && method === 'DELETE') {
      const ids = url.searchParams.get('ids')?.split(',') ?? []
      rows.splice(0, rows.length, ...rows.filter((row) => !ids.includes(row.id)))
      return new Response(null, { status: 204 })
    }
    return new Response(null, { status: 404 })
  })
  return calls
}

const listCalls = (calls: string[]) => calls.filter((call) => call.startsWith('GET /api/v1/routes/saved'))

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

it('goes back a page when a bulk delete empties the current one', async () => {
  const rows = Array.from({ length: 13 }, (_, index) => route(`r${index + 1}`, `Ruta ${index + 1}`))
  const calls = serve(rows)
  render(<App />)

  await screen.findByRole('checkbox', { name: 'Ruta 1' })
  await userEvent.click(screen.getByRole('button', { name: '2' }))
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Ruta 13' }))
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
  const dialog = await screen.findByRole('dialog')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))

  await waitFor(() => expect(calls).toContain('DELETE /api/v1/routes/saved?ids=r13'))
  await waitFor(() => expect(listCalls(calls).at(-1)).toBe('GET /api/v1/routes/saved?page=1&limit=12'))
  expect(await screen.findByRole('checkbox', { name: 'Ruta 1' })).toBeInTheDocument()
})

it('changing the page size reloads from the first page', async () => {
  const rows = Array.from({ length: 30 }, (_, index) => route(`r${index + 1}`, `Ruta ${index + 1}`))
  const calls = serve(rows)
  render(<App />)

  await screen.findByRole('checkbox', { name: 'Ruta 1' })
  await userEvent.click(screen.getByRole('button', { name: '24' }))

  await waitFor(() => expect(listCalls(calls).at(-1)).toBe('GET /api/v1/routes/saved?page=1&limit=24'))
  expect(await screen.findByRole('checkbox', { name: 'Ruta 24' })).toBeInTheDocument()
})
