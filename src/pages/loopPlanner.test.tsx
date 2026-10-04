import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n from '@/i18n'

// maplibre-gl necesita WebGL; en jsdom no arranca y aquí no es lo que se prueba.
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
  window.history.pushState({}, '', '/loops')
})

describe('planificador de circuitos', () => {
  it('con sesión válida muestra el formulario y el mapa', async () => {
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

    // Los controles que definen la petición a /loops.
    expect(screen.getByRole('button', { name: 'Generar ruta' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Distancia/ })).toBeInTheDocument()
    // Los dos filtros: con qué bici, y cuánto desnivel. Independientes.
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

  it('guarda el refresh token rotado que devuelve el backend', async () => {
    localStorage.setItem('velio.refresh', 'refresh-1')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/auth/refresh')) {
        return new Response(JSON.stringify(SESSION), { status: 200 })
      }
      return new Response(null, { status: 404 })
    })

    render(<App />)

    // Reutilizar el anterior lo trataría el backend como robo de token.
    await waitFor(() => expect(localStorage.getItem('velio.refresh')).toBe('refresh-2'))
  })
})
