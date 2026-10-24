import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n from '@/i18n'

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

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

function controlledStream() {
  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  return {
    body,
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
    fail: (error: unknown) => controller.error(error),
  }
}

function serve(stream: ReturnType<typeof controlledStream>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    if (url.includes('/auth/refresh')) return new Response(JSON.stringify(SESSION), { status: 200 })
    if (url.includes('/loops/stream')) {
      init?.signal?.addEventListener('abort', () =>
        stream.fail(new DOMException('The operation was aborted.', 'AbortError')),
      )
      return new Response(stream.body, { headers: { 'content-type': 'text/event-stream' } })
    }
    return new Response(null, { status: 404 })
  })
}

const mapRoutes = () => (mapProps.current?.routes as unknown[] | undefined) ?? []

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('velio.refresh', 'refresh-1')
  vi.restoreAllMocks()
  mapProps.current = null
  window.history.pushState({}, '', '/es/loops')
})

it('shows progress and the first loop before the result arrives', async () => {
  const stream = controlledStream()
  serve(stream)
  render(<App />)
  await screen.findByTestId('map-stub')
  await userEvent.click(screen.getByRole('button', { name: 'Generar ruta' }))

  stream.push(frame('progress', { seed: 1, seeds: 6, iteration: 0, distance_km: null }))
  await waitFor(() => expect(screen.getAllByText('Buscando vueltas · intento 1 de 6').length).toBeGreaterThan(0))

  stream.push(frame('loop', LOOP))
  await waitFor(() => expect(mapRoutes()).toHaveLength(1))
  expect(screen.getAllByText('Ordenando las vueltas…').length).toBeGreaterThan(0)

  stream.push(frame('result', LOOP))
  stream.close()
  await waitFor(() => expect(screen.queryAllByText('Ordenando las vueltas…')).toHaveLength(0))
  expect(mapRoutes()).toHaveLength(1)
})

it('cancelling keeps the loops found so far without an error', async () => {
  const stream = controlledStream()
  serve(stream)
  render(<App />)
  await screen.findByTestId('map-stub')
  await userEvent.click(screen.getByRole('button', { name: 'Generar ruta' }))

  stream.push(frame('loop', LOOP))
  await waitFor(() => expect(mapRoutes()).toHaveLength(1))

  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  await waitFor(() => expect(screen.queryAllByText('Ordenando las vueltas…')).toHaveLength(0))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(mapRoutes()).toHaveLength(1)
})
