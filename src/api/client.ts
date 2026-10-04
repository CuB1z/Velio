import { ApiError, errorFromResponse } from './errors'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

type RequestOptions = {
  method?: Method
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  /** Añade el Bearer y activa el refresco automático ante un 401. */
  auth?: boolean
  signal?: AbortSignal
  /** Devuelve el cuerpo como Blob en vez de JSON (export GPX/GeoJSON). */
  blob?: boolean
}

type AuthHandlers = {
  getAccessToken: () => string | null
  /** Rota el refresh token. Devuelve true si hay una sesión nueva utilizable. */
  refresh: () => Promise<boolean>
  /** La sesión ya no se puede recuperar: hay que echar al usuario. */
  onSessionLost: () => void
}

let handlers: AuthHandlers | null = null

export function setAuthHandlers(next: AuthHandlers | null): void {
  handlers = next
}

/**
 * Un solo refresco en vuelo. Sin esto, cinco peticiones simultáneas con el
 * token caducado dispararían cinco rotaciones y el backend, que trata la
 * reutilización de un refresh token como robo, cerraría todas las sesiones.
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
      message: 'No se pudo contactar con el servidor.',
      status: 0,
    })
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options)

  // 401 con sesión: intentamos rotar una vez y repetir.
  if (response.status === 401 && options.auth && handlers) {
    const recovered = await refreshOnce()
    if (recovered) {
      response = await send(path, options)
    } else {
      handlers.onSessionLost()
    }
  }

  if (!response.ok) throw await errorFromResponse(response)

  if (options.blob) return (await response.blob()) as T
  if (response.status === 204) return undefined as T

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Sondea /api/health, que cuelga fuera de /api/v1. */
export async function health(): Promise<{ status: string; version: string }> {
  const base = API_BASE_URL.replace(/\/v\d+$/, '')
  const response = await fetch(`${base}/health`)
  if (!response.ok) throw await errorFromResponse(response)
  return (await response.json()) as { status: string; version: string }
}
