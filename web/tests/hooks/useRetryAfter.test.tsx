import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/errors'
import { useRetryAfter } from '@/hooks/useRetryAfter'

const limited = (seconds: number) =>
  new ApiError({ code: 'RATE_LIMITED', message: 'slow down', status: 429, retryAfter: seconds })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

it('counts a Retry-After down to zero', () => {
  const { result } = renderHook(({ error }) => useRetryAfter(error), { initialProps: { error: limited(3) as unknown } })
  expect(result.current).toBe(3)

  act(() => vi.advanceTimersByTime(1000))
  expect(result.current).toBe(2)

  act(() => vi.advanceTimersByTime(2000))
  expect(result.current).toBe(0)

  act(() => vi.advanceTimersByTime(5000))
  expect(result.current).toBe(0)
})

it('restarts for a new error and ignores anything that is not a 429', () => {
  const { result, rerender } = renderHook(({ error }) => useRetryAfter(error), {
    initialProps: { error: limited(2) as unknown },
  })
  act(() => vi.advanceTimersByTime(2000))
  expect(result.current).toBe(0)

  rerender({ error: limited(5) })
  expect(result.current).toBe(5)

  rerender({ error: new ApiError({ code: 'VALIDATION_ERROR', message: 'bad', status: 422 }) })
  expect(result.current).toBe(0)

  rerender({ error: null })
  expect(result.current).toBe(0)
})
