import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n from '@/i18n'

const USER = { id: 'u1', email: 'marta@velio.cc', full_name: 'Marta Ríos', status: 'active' }

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('OAuth callback', () => {
  it('adopts the fragment tokens and clears the URL', async () => {
    window.history.pushState({}, '', '/es/oauth/callback#access_token=at&refresh_token=rt&token_type=bearer')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/auth/me')) {
        return new Response(JSON.stringify(USER), { status: 200 })
      }
      return new Response(null, { status: 404 })
    })

    render(<App />)

    // The fragment only carries tokens, so the profile is fetched separately.
    await waitFor(() => {
      expect(fetchSpy.mock.calls.some(([u]) => String(u).includes('/auth/me'))).toBe(true)
    })
    expect(localStorage.getItem('velio.refresh')).toBe('rt')

    // Tokens must not linger in the address bar or history.
    await waitFor(() => expect(window.location.hash).toBe(''))
  })

  it('shows the fragment error instead of a blank page', async () => {
    window.history.pushState({}, '', '/es/oauth/callback#error=OAUTH_ERROR&message=estado+caducado')
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('estado caducado')).toBeInTheDocument()
    })
    expect(localStorage.getItem('velio.refresh')).toBeNull()
  })
})
