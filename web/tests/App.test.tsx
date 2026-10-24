import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n from '@/i18n'

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  window.history.pushState({}, '', '/es')
})

describe('app bootstrap', () => {
  it('the landing page is public', async () => {
    render(<App />)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /Circuitos a tu medida/,
          level: 1,
        }),
      ).toBeInTheDocument()
    })
  })

  it('the planner requires a session and redirects to login', async () => {
    window.history.pushState({}, '', '/es/loops')
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Vuelve a la carretera' })).toBeInTheDocument()
    })
  })

  it('tries to exchange a stored refresh token before deciding', async () => {
    window.history.pushState({}, '', '/es/loops')
    localStorage.setItem('velio.refresh', 'un-token')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'INVALID_REFRESH_TOKEN', message: 'no vale' }), {
        status: 401,
      }),
    )

    render(<App />)

    // Redirecting before the refresh resolves would kick out a valid session on reload.
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(fetchSpy.mock.calls[0][0]).toContain('/auth/refresh')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Vuelve a la carretera' })).toBeInTheDocument()
    })
    // A dead refresh token must not stay stored.
    expect(localStorage.getItem('velio.refresh')).toBeNull()
  })
})

describe('language routes', () => {
  it('serves the default language without a prefix', async () => {
    window.history.pushState({}, '', '/?ref=x')
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/Loops cut to your distance/)
    expect(window.location.pathname + window.location.search).toBe('/?ref=x')
    expect(document.documentElement.lang).toBe('en')
    await i18n.changeLanguage('es')
  })

  it('strips the default prefix and keeps the rest of the path', async () => {
    window.history.pushState({}, '', '/en/loops')
    render(<App />)

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    await i18n.changeLanguage('es')
  })

  it('renders Spanish under /es and marks the document language', async () => {
    window.history.pushState({}, '', '/es')
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/Circuitos a tu medida/)
    expect(document.documentElement.lang).toBe('es')
  })
})
