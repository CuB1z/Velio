import type { ApiErrorBody, ErrorCode } from '@/types/api'

/** Error tipado de la API. Todo fallo de red o de negocio llega como esto. */
export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: Record<string, unknown>
  /** Segundos hasta el próximo intento, solo en 429. */
  readonly retryAfter?: number

  constructor(init: {
    code: ErrorCode
    message: string
    status: number
    details?: Record<string, unknown>
    retryAfter?: number
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.code = init.code
    this.status = init.status
    this.details = init.details
    this.retryAfter = init.retryAfter
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

/** Códigos ante los que reintentar no sirve de nada. */
const TERMINAL: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'EMAIL_ALREADY_REGISTERED',
  'EMAIL_NOT_VERIFIED',
  'ACCOUNT_SUSPENDED',
  'NOT_FOUND',
  'VERIFY_ERROR',
  'RESET_ERROR',
  'DELETE_ERROR',
  'OAUTH_ERROR',
  'NO_LOCAL_PASSWORD',
  'ROUTING_ERROR',
])

export function isRetryable(error: unknown): boolean {
  if (!isApiError(error)) return false
  return !TERMINAL.has(error.code)
}

function derivedCode(status: number): ErrorCode {
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'EMAIL_ALREADY_REGISTERED'
  if (status === 422) return 'VALIDATION_ERROR'
  if (status === 429) return 'RATE_LIMITED'
  if (status >= 500) return 'SERVICE_UNAVAILABLE'
  return 'UNKNOWN'
}

/** Traduce una respuesta fallida al error tipado, tolerando cuerpos no-JSON. */
export async function errorFromResponse(response: Response): Promise<ApiError> {
  const retryAfterHeader = response.headers.get('retry-after')
  let body: Partial<ApiErrorBody> = {}

  try {
    body = (await response.json()) as Partial<ApiErrorBody>
  } catch {
    // Un proxy o un 502 pueden devolver HTML: nos quedamos con el estado.
  }

  return new ApiError({
    code: body.error ?? derivedCode(response.status),
    message: body.message ?? `La petición falló con estado ${response.status}`,
    status: response.status,
    details: body.details,
    retryAfter: retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined,
  })
}
