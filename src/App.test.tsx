import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import i18n from '@/i18n'

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  window.history.pushState({}, '', '/')
})

describe('arranque de la aplicación', () => {
  it('la portada es pública', async () => {
    render(<App />)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /Dinos los kilómetros y el desnivel/,
          level: 1,
        }),
      ).toBeInTheDocument()
    })
  })

  it('el planificador exige sesión y redirige al login', async () => {
    // Los endpoints de cálculo piden Bearer, así que sin sesión no hay planificador.
    window.history.pushState({}, '', '/loops')
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Vuelve a la carretera' })).toBeInTheDocument()
    })
  })

  it('con un refresh token guardado intenta canjearlo antes de decidir', async () => {
    window.history.pushState({}, '', '/loops')
    localStorage.setItem('velio.refresh', 'un-token')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'INVALID_REFRESH_TOKEN', message: 'no vale' }), {
        status: 401,
      }),
    )

    render(<App />)

    // Si redirigiera antes de resolver el refresco, recargar echaría fuera a
    // quien sí tiene sesión.
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(fetchSpy.mock.calls[0][0]).toContain('/auth/refresh')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Vuelve a la carretera' })).toBeInTheDocument()
    })
    // Un refresh token muerto no debe quedarse guardado.
    expect(localStorage.getItem('velio.refresh')).toBeNull()
  })
})
