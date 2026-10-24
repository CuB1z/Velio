import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n from '@/i18n'

// Captures the props the planner passes to the map, where the route geometry lands.
const mapProps: { current: Record<string, unknown> | null } = { current: null }

vi.mock('@/components/map/lazyMap', () => ({
  LazyMap: (props: Record<string, unknown>) => {
    mapProps.current = props
    return <div data-testid="map-stub" />
  },
}))

const SESSION = {
  user: { id: 'u1', email: 'marta@velio.cc', full_name: 'Marta Ríos', status: 'active' },
  tokens: { access_token: 'access', refresh_token: 'refresh-2', token_type: 'bearer' },
}

const LOOP = {
  distance_km: 66.6,
  gain_m: 843,
  loss_m: 843,
  feasible: true,
  iterations: 3,
  polyline: 'gjk_lA~dmdFw{l@_~P?_t`Bv{l@~rrB',
  duration_min: 263,
  overlap_ratio: 0.02,
  score: null,
  cycling_score: null,
  profile: null,
  alternatives: null,
}

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  mapProps.current = null
  window.history.pushState({}, '', '/es/loops')
})

it('the generated route reaches the map', async () => {
  localStorage.setItem('velio.refresh', 'refresh-1')
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.includes('/auth/refresh')) {
      return new Response(JSON.stringify(SESSION), { status: 200 })
    }
    if (url.includes('/loops')) {
      return new Response(JSON.stringify(LOOP), { status: 200 })
    }
    return new Response(null, { status: 404 })
  })

  render(<App />)
  await waitFor(() => expect(screen.getByTestId('map-stub')).toBeInTheDocument())
  expect(mapProps.current?.routes).toEqual([])

  await userEvent.click(screen.getByRole('button', { name: 'Generar ruta' }))

  await waitFor(() => {
    const routes = mapProps.current?.routes as { coordinates: unknown[] }[] | undefined
    expect(routes).toHaveLength(1)
    expect(routes?.[0].coordinates.length).toBeGreaterThan(1)
  })
})
