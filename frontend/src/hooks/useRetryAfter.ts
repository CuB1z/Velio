import { useEffect, useState } from 'react'

import { isApiError } from '@/api/errors'

const retryAfterOf = (error: unknown) =>
  isApiError(error) && error.code === 'RATE_LIMITED' ? (error.retryAfter ?? 0) : 0

export function useRetryAfter(error: unknown): number {
  const [state, setState] = useState(() => ({ error, left: retryAfterOf(error) }))
  if (state.error !== error) setState({ error, left: retryAfterOf(error) })

  useEffect(() => {
    if (retryAfterOf(state.error) <= 0) return
    const timer = window.setInterval(
      () => setState((current) => (current.left > 0 ? { ...current, left: current.left - 1 } : current)),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [state.error])

  return state.error === error ? state.left : retryAfterOf(error)
}
