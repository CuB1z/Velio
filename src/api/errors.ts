import type { ApiErrorBody, ErrorCode } from '@/types/api'

/** Typed API error; every network or business failure arrives as one. */
export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: Record<string, unknown>
  /** Seconds until the next attempt, only on 429. */
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

/** Codes where retrying never helps. */
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

/** Turns a failed response into a typed error, tolerating non-JSON bodies. */
export async function errorFromResponse(response: Response): Promise<ApiError> {
  const retryAfterHeader = response.headers.get('retry-after')
  let body: Partial<ApiErrorBody> = {}

  try {
    body = (await response.json()) as Partial<ApiErrorBody>
  } catch {
    // A proxy or a 502 may return HTML: keep just the status.
  }

  return new ApiError({
    code: body.error ?? derivedCode(response.status),
    message: body.message ?? `Request failed with status ${response.status}`,
    status: response.status,
    details: body.details,
    retryAfter: retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined,
  })
}
