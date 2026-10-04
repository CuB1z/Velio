/**
 * El refresh token es lo único que persiste. El access token vive solo en
 * memoria: es lo que se puede hacer sin apoyo del backend, que entrega los
 * tokens en el cuerpo de la respuesta y no como cookie httpOnly.
 */
const REFRESH_KEY = 'velio.refresh'

/** En modo privado o con las cookies bloqueadas, localStorage lanza al escribir. */
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
