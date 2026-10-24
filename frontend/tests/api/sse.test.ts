import { describe, expect, it } from 'vitest'

import { parseSse, type SseEvent } from '@/api/sse'

function body(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
      }
      controller.close()
    },
  })
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<SseEvent[]> {
  const events: SseEvent[] = []
  for await (const event of parseSse(stream)) events.push(event)
  return events
}

describe('parseSse', () => {
  it('reassembles frames split across chunks', async () => {
    const events = await collect(
      body(['event: progress\ndata: {"seed"', ':1}\n', '\nevent: result\ndata: {}\n\n']),
    )
    expect(events).toEqual([
      { event: 'progress', data: '{"seed":1}' },
      { event: 'result', data: '{}' },
    ])
  })

  it('keeps a multibyte character split between chunks', async () => {
    const bytes = new TextEncoder().encode('event: loop\ndata: "Vellón"\n\n')
    const cut = bytes.indexOf(0xc3) + 1
    const events = await collect(body([bytes.slice(0, cut), bytes.slice(cut)]))
    expect(events).toEqual([{ event: 'loop', data: '"Vellón"' }])
  })

  it('skips comments, joins data lines and reads a frame without a trailing blank line', async () => {
    const events = await collect(body([': keepalive\n\ndata: a\ndata: b\n\r\n', 'event: x\ndata: tail']))
    expect(events).toEqual([
      { event: 'message', data: 'a\nb' },
      { event: 'x', data: 'tail' },
    ])
  })

  it('cancels the body when the consumer stops early', async () => {
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: 1\n\ndata: 2\n\n'))
      },
      cancel() {
        cancelled = true
      },
    })
    for await (const event of parseSse(stream)) {
      expect(event.data).toBe('1')
      break
    }
    expect(cancelled).toBe(true)
  })
})
