import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { useMediaQuery } from '@/hooks/useMediaQuery'

afterEach(() => vi.unstubAllGlobals())

it('follows the media query as it starts and stops matching', () => {
  let matches = false
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return matches
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }))

  const { result, unmount } = renderHook(() => useMediaQuery('(width < 48rem)'))
  expect(result.current).toBe(false)

  matches = true
  act(() => listeners.forEach((listener) => listener()))
  expect(result.current).toBe(true)

  unmount()
  expect(listeners.size).toBe(0)
})
