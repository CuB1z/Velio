import type {
  AuthSession,
  ChangePasswordRequest,
  DeviceSession,
  ForgotPasswordRequest,
  LoginRequest,
  OAuthProvider,
  RegisterRequest,
  ResetPasswordRequest,
  User,
  VerifyRequest,
} from '@/types/api'
import { API_BASE_URL, request } from './client'

/** Crea una cuenta pendiente y dispara el correo con el código. Devuelve el usuario, sin tokens. */
export function register(payload: RegisterRequest): Promise<User> {
  return request<User>('/auth/register', { method: 'POST', body: payload })
}

/** Confirma el código de seis dígitos y activa la cuenta. Idempotente si ya está activa. */
export function verify(payload: VerifyRequest): Promise<User> {
  return request<User>('/auth/verify', { method: 'POST', body: payload })
}

/** Siempre 202: el endpoint no permite averiguar si un correo está registrado. */
export function resendVerification(email: string): Promise<void> {
  return request<void>('/auth/resend-verification', { method: 'POST', body: { email } })
}

export function login(payload: LoginRequest): Promise<AuthSession> {
  return request<AuthSession>('/auth/login', { method: 'POST', body: payload })
}

/** Rota el par de tokens. El refresh usado queda revocado. */
export function refresh(refreshToken: string): Promise<AuthSession> {
  return request<AuthSession>('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  })
}

export function logout(refreshToken: string): Promise<void> {
  return request<void>('/auth/logout', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  })
}

export function me(): Promise<User> {
  return request<User>('/auth/me', { auth: true })
}

export function sessions(): Promise<DeviceSession[]> {
  return request<DeviceSession[]>('/auth/sessions', { auth: true })
}

export function revokeSession(id: number): Promise<void> {
  return request<void>(`/auth/sessions/${id}`, { method: 'DELETE', auth: true })
}

/** Cierra todas menos la del llamante. */
export function revokeOtherSessions(): Promise<void> {
  return request<void>('/auth/sessions', { method: 'DELETE', auth: true })
}

/** Siempre 202. Solo se envía código a cuentas activas con credencial local. */
export function forgotPassword(payload: ForgotPasswordRequest): Promise<void> {
  return request<void>('/auth/forgot-password', { method: 'POST', body: payload })
}

/** Fija la contraseña nueva y revoca todas las sesiones. */
export function resetPassword(payload: ResetPasswordRequest): Promise<void> {
  return request<void>('/auth/reset-password', { method: 'POST', body: payload })
}

/** Rota la credencial. También revoca todas las sesiones, incluida la actual. */
export function changePassword(payload: ChangePasswordRequest): Promise<void> {
  return request<void>('/auth/change-password', { method: 'POST', body: payload, auth: true })
}

/** Paso 1 del borrado: pide el código por correo. Siempre 202. */
export function requestAccountDeletion(): Promise<void> {
  return request<void>('/auth/me/delete-request', { method: 'POST', auth: true })
}

/** Paso 2 del borrado: irreversible, en cascada sobre rutas, sesiones e identidades. */
export function deleteAccount(code: string): Promise<void> {
  return request<void>('/auth/me', { method: 'DELETE', body: { code }, auth: true })
}

/**
 * El backend responde 307 hacia el proveedor, así que se navega, no se hace fetch.
 */
export function oauthAuthorizeUrl(provider: OAuthProvider): string {
  return `${API_BASE_URL}/auth/${provider}/authorize`
}

/**
 * Cierra la vuelta de OAuth desde un cliente que sí puede leer la respuesta.
 *
 * La web no la usa: con OAUTH_SUCCESS_REDIRECT configurado, el backend redirige
 * el navegador a /oauth/callback con los tokens en el fragmento. Queda por si
 * hace falta cerrar la vuelta desde código.
 */
export function oauthCallback(
  provider: OAuthProvider,
  params: { code: string; state: string },
): Promise<AuthSession> {
  return request<AuthSession>(`/auth/${provider}/callback`, { query: params })
}
