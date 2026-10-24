import { ApiError, errorFromResponse } from './errors'
import { parseSse, type SseEvent } from './sse'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

type RequestOptions = {
  method?: Method
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  /** Adds the Bearer token and enables automatic refresh on 401. */
  auth?: boolean
  signal?: AbortSignal
  /** Returns the body as a Blob instead of JSON (GPX/GeoJSON export). */
  blob?: boolean
}

type AuthHandlers = {
  getAccessToken: () => string | null
  /** Rotates the refresh token. Returns true if a usable new session exists. */
  refresh: () => Promise<boolean>
  /** The session is unrecoverable: sign the user out. */
  onSessionLost: () => void
}

let handlers: AuthHandlers | null = null

export function setAuthHandlers(next: AuthHandlers | null): void {
  handlers = next
}

/**
 * Single in-flight refresh: concurrent 401s would otherwise rotate in parallel, which the
 * backend treats as refresh-token reuse (theft) and answers by revoking every session.
 */
let inFlightRefresh: Promise<boolean> | null = null

function refreshOnce(): Promise<boolean> {
  if (!handlers) return Promise.resolve(false)
  inFlightRefresh ??= handlers.refresh().finally(() => {
    inFlightRefresh = null
  })
  return inFlightRefresh
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE_URL}${path}`
  if (!query) return url

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', body, query, auth = false, signal } = options
  const headers: Record<string, string> = {}

  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = handlers?.getAccessToken() ?? null
    if (token) headers.Authorization = `Bearer ${token}`
  }

  try {
    return await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server.',
      status: 0,
    })
  }
}

async function sendWithRefresh(path: string, options: RequestOptions): Promise<Response> {
  const response = await send(path, options)

  // 401 with a session: rotate once and retry.
  if (response.status === 401 && options.auth && handlers) {
    const recovered = await refreshOnce()
    if (recovered) return send(path, options)
    handlers.onSessionLost()
  }
  return response
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await sendWithRefresh(path, options)

  if (!response.ok) throw await errorFromResponse(response)

  if (options.blob) return (await response.blob()) as T
  if (response.status === 204) return undefined as T

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Server-Sent Events; an answer that is not an event stream arrives as one `result` event. */
export async function* stream(path: string, options: RequestOptions = {}): AsyncGenerator<SseEvent> {
  const response = await sendWithRefresh(path, options)
  if (!response.ok) throw await errorFromResponse(response)

  const type = response.headers.get('content-type') ?? ''
  if (!type.includes('text/event-stream') || !response.body) {
    yield { event: 'result', data: await response.text() }
    return
  }
  yield* parseSse(response.body)
}

/** Pings /api/health, which lives outside /api/v1. */
export async function health(): Promise<{ status: string; version: string }> {
  const base = API_BASE_URL.replace(/\/v\d+$/, '')
  const response = await fetch(`${base}/health`)
  if (!response.ok) throw await errorFromResponse(response)
  return (await response.json()) as { status: string; version: string }
}
