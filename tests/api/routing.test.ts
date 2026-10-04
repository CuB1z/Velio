import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/errors'
import { streamLoop } from '@/api/routing'
import type { LoopProgress, LoopRequest, LoopResult } from '@/types/api'

const REQUEST = { origin: { lat: 40.4, lon: -3.7 }, distance_km: 30 } as LoopRequest
const loop = (distance_km: number) => ({ distance_km, alternatives: null }) as unknown as LoopResult

function sse(frames: [string, unknown][]): Response {
  const text = frames.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('')
  return new Response(text, { headers: { 'content-type': 'text/event-stream' } })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.restoreAllMocks())

describe('streamLoop', () => {
  it('reports progress and each loop, then returns the ranked result', async () => {
    const progress: LoopProgress = { seed: 1, seeds: 9, iteration: 0, distance_km: null }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sse([
        ['progress', progress],
        ['loop', loop(29)],
        ['loop', loop(31)],
        ['result', { ...loop(31), alternatives: [loop(29)] }],
      ]),
    )
    const onProgress = vi.fn()
    const onLoop = vi.fn()

    const result = await streamLoop(REQUEST, { onProgress, onLoop })

    expect(onProgress).toHaveBeenCalledWith(progress)
    expect(onLoop.mock.calls.map(([l]) => l.distance_km)).toEqual([29, 31])
    expect(result.distance_km).toBe(31)
    expect(result.alternatives).toHaveLength(1)
  })

  it('turns an error event into an ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sse([['error', { status: 422, error: 'ROUTING_ERROR', message: 'No loop', details: {} }]]),
    )
    const error = await streamLoop(REQUEST).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'ROUTING_ERROR', status: 422 })
  })

  it('falls back to the JSON endpoint when the stream does not exist', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ error: 'NOT_FOUND', message: 'Not Found', details: {} }, 404))
      .mockResolvedValueOnce(json(loop(30)))

    const result = await streamLoop(REQUEST)

    expect(result.distance_km).toBe(30)
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/loops$/)
  })

  it('takes a plain JSON answer as the result', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(loop(42)))
    expect((await streamLoop(REQUEST)).distance_km).toBe(42)
  })

  it('fails when the stream ends without a result', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sse([['loop', loop(29)]]))
    await expect(streamLoop(REQUEST)).rejects.toMatchObject({ code: 'UNKNOWN' })
  })
})
