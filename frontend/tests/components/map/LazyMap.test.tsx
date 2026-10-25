import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

import { LazyMap } from '@/components/map/LazyMap'
import { FALLBACK_BOUNDS } from '@/lib/mapStyles'
import { COVERAGE } from '../../fixtures/coverage'

const mapProps: { current: Record<string, unknown> | null } = { current: null }

vi.mock('@/components/map/MapView', () => ({
  MapView: (props: Record<string, unknown>) => {
    mapProps.current = props
    return <div data-testid="map" />
  },
}))

function renderMap(response: Response) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <LazyMap styleId="map" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  mapProps.current = null
})

it('bounds every map by the coverage', async () => {
  renderMap(new Response(JSON.stringify(COVERAGE), { status: 200 }))
  await waitFor(() =>
    expect(mapProps.current?.maxBounds).toEqual([
      [-11.6, 34],
      [5.4, 45.8],
    ]),
  )
})

it('keeps the fallback box when the coverage is unavailable', async () => {
  renderMap(new Response(null, { status: 404 }))
  await waitFor(() => expect(mapProps.current).not.toBeNull())
  expect(mapProps.current?.maxBounds).toEqual(FALLBACK_BOUNDS)
})
