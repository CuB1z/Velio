import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'

import { useCoverage } from '@/hooks/useCoverage'
import { FALLBACK_BOUNDS } from '@/lib/mapStyles'
import { COVERAGE, LISBON, MADRID, PARIS } from '../fixtures/coverage'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function serveCoverage(response: () => Response) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response())
}

beforeEach(() => {
  vi.restoreAllMocks()
})

it('bounds the map to the covered bbox with a margin', async () => {
  serveCoverage(() => new Response(JSON.stringify(COVERAGE), { status: 200 }))
  const { result } = renderHook(() => useCoverage(), { wrapper })

  expect(result.current.bounds).toEqual(FALLBACK_BOUNDS)
  await waitFor(() =>
    expect(result.current.bounds).toEqual([
      [-11.6, 34],
      [5.4, 45.8],
    ]),
  )
})

it('covers points inside the regions only', async () => {
  serveCoverage(() => new Response(JSON.stringify(COVERAGE), { status: 200 }))
  const { result } = renderHook(() => useCoverage(), { wrapper })

  await expect(result.current.covers(MADRID)).resolves.toBe(true)
  await expect(result.current.covers(LISBON)).resolves.toBe(true)
  await expect(result.current.covers(PARIS)).resolves.toBe(false)
})

it('lets every point through when the coverage cannot be loaded', async () => {
  serveCoverage(() => new Response(null, { status: 404 }))
  const { result } = renderHook(() => useCoverage(), { wrapper })

  await expect(result.current.covers(PARIS)).resolves.toBe(true)
  expect(result.current.bounds).toEqual(FALLBACK_BOUNDS)
})
