/**
 * Only the refresh token is persisted; the access token lives in memory.
 * The backend returns tokens in the response body, not as an httpOnly cookie.
 */
const REFRESH_KEY = 'velio.refresh'

/** localStorage throws on write in private mode or with cookies blocked. */
function safe<T>(operation: () => T, fallback: T): T {
  try {
    return operation()
  } catch {
    return fallback
  }
}

export function readRefreshToken(): string | null {
  return safe(() => localStorage.getItem(REFRESH_KEY), null)
}

export function writeRefreshToken(token: string): void {
  safe(() => localStorage.setItem(REFRESH_KEY, token), undefined)
}

export function clearRefreshToken(): void {
  safe(() => localStorage.removeItem(REFRESH_KEY), undefined)
}
