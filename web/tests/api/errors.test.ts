import { describe, expect, it } from 'vitest'

import { errorFromResponse, isRetryable } from '@/api/errors'

function response(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers })
}

describe('API errors', () => {
  it('reads the {error, message, details} body', async () => {
    const error = await errorFromResponse(
      response(422, { error: 'ROUTING_ERROR', message: 'Sin ruta ciclable', details: { leg: 2 } }),
    )
    expect(error.code).toBe('ROUTING_ERROR')
    expect(error.message).toBe('Sin ruta ciclable')
    expect(error.details).toEqual({ leg: 2 })
  })

  it('derives the code from the status when the body is not JSON', async () => {
    const error = await errorFromResponse(new Response('<html>502</html>', { status: 502 }))
    expect(error.code).toBe('SERVICE_UNAVAILABLE')
    expect(error.status).toBe(502)
  })

  it('reads Retry-After on 429', async () => {
    const error = await errorFromResponse(
      response(429, { error: 'RATE_LIMITED', message: 'demasiadas' }, { 'retry-after': '42' }),
    )
    expect(error.retryAfter).toBe(42)
  })

  it('does not retry errors that will never change', async () => {
    expect(isRetryable(await errorFromResponse(response(422, { error: 'VALIDATION_ERROR', message: 'x' })))).toBe(false)
    expect(isRetryable(await errorFromResponse(response(503, { error: 'SERVICE_UNAVAILABLE', message: 'x' })))).toBe(true)
  })
})
