export type SseEvent = { event: string; data: string }

function parseFrame(frame: string): SseEvent | null {
  let event = 'message'
  const data: string[] = []
  for (const line of frame.split('\n')) {
    if (!line || line.startsWith(':')) continue
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }
  return data.length ? { event, data: data.join('\n') } : null
}

/** Server-Sent Events from a response body; stopping early cancels the body. */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      let end = buffer.indexOf('\n\n')
      while (end !== -1) {
        const parsed = parseFrame(buffer.slice(0, end))
        buffer = buffer.slice(end + 2)
        if (parsed) yield parsed
        end = buffer.indexOf('\n\n')
      }
    }
    const tail = parseFrame(buffer + decoder.decode())
    if (tail) yield tail
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}
