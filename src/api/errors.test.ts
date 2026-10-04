import { describe, expect, it } from 'vitest'

import { errorFromResponse, isRetryable } from './errors'

function response(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers })
}

describe('errores de la API', () => {
  it('lee el cuerpo {error, message, details}', async () => {
    const error = await errorFromResponse(
      response(422, { error: 'ROUTING_ERROR', message: 'Sin ruta ciclable', details: { leg: 2 } }),
    )
    expect(error.code).toBe('ROUTING_ERROR')
    expect(error.message).toBe('Sin ruta ciclable')
    expect(error.details).toEqual({ leg: 2 })
  })

  it('deduce el código del estado cuando el cuerpo no es JSON', async () => {
    const error = await errorFromResponse(new Response('<html>502</html>', { status: 502 }))
    expect(error.code).toBe('SERVICE_UNAVAILABLE')
    expect(error.status).toBe(502)
  })

  it('recoge Retry-After en los 429', async () => {
    const error = await errorFromResponse(
      response(429, { error: 'RATE_LIMITED', message: 'demasiadas' }, { 'retry-after': '42' }),
    )
    expect(error.retryAfter).toBe(42)
  })

  it('no reintenta lo que nunca va a cambiar', async () => {
    expect(isRetryable(await errorFromResponse(response(422, { error: 'VALIDATION_ERROR', message: 'x' })))).toBe(false)
    expect(isRetryable(await errorFromResponse(response(503, { error: 'SERVICE_UNAVAILABLE', message: 'x' })))).toBe(true)
  })
})
