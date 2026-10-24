import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n from '@/i18n'

// maplibre-gl needs WebGL, which jsdom lacks; the map isn't under test here.
vi.mock('@/components/map/lazyMap', () => ({
  LazyMap: ({ className }: { className?: string }) => (
    <div data-testid="map-stub" className={className} />
  ),
}))

const SESSION = {
  user: { id: 'u1', email: 'marta@velio.cc', full_name: 'Marta Ríos', status: 'active' },
  tokens: { access_token: 'access', refresh_token: 'refresh-2', token_type: 'bearer' },
}

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  window.history.pushState({}, '', '/es/loops')
})

describe('loop planner', () => {
  it('shows the form and the map with a valid session', async () => {
    localStorage.setItem('velio.refresh', 'refresh-1')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/auth/refresh')) {
        return new Response(JSON.stringify(SESSION), { status: 200 })
      }
      return new Response(null, { status: 404 })
    })

    render(<App />)

    await waitFor(() => expect(screen.getByTestId('map-stub')).toBeInTheDocument())

    // Controls that build the /loops request.
    expect(screen.getByRole('button', { name: 'Generar ruta' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Distancia/ })).toBeInTheDocument()
    // The two independent filters: bike and elevation.
    expect(screen.getByRole('button', { name: /Carretera/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Ondulado/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Gravel/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('stores the rotated refresh token returned by the backend', async () => {
    localStorage.setItem('velio.refresh', 'refresh-1')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/auth/refresh')) {
        return new Response(JSON.stringify(SESSION), { status: 200 })
      }
      return new Response(null, { status: 404 })
    })

    render(<App />)

    // The backend treats reuse of the old token as theft.
    await waitFor(() => expect(localStorage.getItem('velio.refresh')).toBe('refresh-2'))
  })
})
