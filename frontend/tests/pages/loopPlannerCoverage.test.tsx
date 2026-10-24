import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'

import App from '@/App'
import i18n from '@/i18n'
import { COVERAGE, LISBON, MADRID, PARIS } from '../fixtures/coverage'

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

function originMarker() {
  const markers = mapProps.current?.markers as { id: string; coordinate: [number, number] }[]
  return markers.find((marker) => marker.id === 'origin')?.coordinate
}

function locateAt(position: { lat: number; lon: number } | null) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: position
      ? {
          getCurrentPosition: (ok: PositionCallback) =>
            setTimeout(() => ok({ coords: { latitude: position.lat, longitude: position.lon } } as GeolocationPosition)),
        }
      : undefined,
  })
}

async function openPlanner() {
  render(<App />)
  await waitFor(() => expect(screen.getByTestId('map-stub')).toBeInTheDocument())
}

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  mapProps.current = null
  locateAt(null)
  window.history.pushState({}, '', '/es/loops')
  localStorage.setItem('velio.refresh', 'refresh-1')
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.includes('/auth/refresh')) return new Response(JSON.stringify(SESSION), { status: 200 })
    if (url.includes('/coverage')) return new Response(JSON.stringify(COVERAGE), { status: 200 })
    return new Response(null, { status: 404 })
  })
})

afterEach(() => {
  locateAt(null)
})

it('a click outside the coverage shows the notice and sets nothing', async () => {
  await openPlanner()
  await userEvent.click(screen.getAllByLabelText('Elegir en el mapa')[0])
  expect(await screen.findAllByText('Pulsa en el mapa para colocar el punto')).not.toHaveLength(0)

  const onMapClick = mapProps.current?.onMapClick as (coordinate: [number, number]) => Promise<void>
  await act(() => onMapClick([PARIS.lon, PARIS.lat]))

  expect(
    await screen.findAllByText(
      'Ese punto queda fuera de la zona que cubrimos por ahora (España y Portugal). Elige otro en el mapa.',
    ),
  ).not.toHaveLength(0)
  expect(originMarker()).toEqual([MADRID.lon, MADRID.lat])

  await act(() => onMapClick([LISBON.lon, LISBON.lat]))
  await waitFor(() => expect(originMarker()).toEqual([LISBON.lon, LISBON.lat]))
  expect(screen.queryAllByText(/Ese punto queda fuera|Pulsa en el mapa/)).toHaveLength(0)
})

it('a user located in Paris keeps the default start and is told why', async () => {
  locateAt(PARIS)
  await openPlanner()

  expect(
    await screen.findByText(
      'Tu ubicación queda fuera de la zona que cubrimos por ahora (España y Portugal), así que no la usamos como punto de partida.',
    ),
  ).toBeInTheDocument()
  expect(originMarker()).toEqual([MADRID.lon, MADRID.lat])
})

it('a user located in Lisbon starts there', async () => {
  locateAt(LISBON)
  await openPlanner()

  await waitFor(() => expect(originMarker()).toEqual([LISBON.lon, LISBON.lat]))
  expect(screen.queryByText(/queda fuera/)).not.toBeInTheDocument()
})
