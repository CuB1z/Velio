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

/** Creates a pending account and emails the code. Returns the user, without tokens. */
export function register(payload: RegisterRequest): Promise<User> {
  return request<User>('/auth/register', { method: 'POST', body: payload })
}

/** Confirms the six-digit code and activates the account. Idempotent if already active. */
export function verify(payload: VerifyRequest): Promise<User> {
  return request<User>('/auth/verify', { method: 'POST', body: payload })
}

/** Always 202, so the endpoint can't reveal whether an email is registered. */
export function resendVerification(email: string): Promise<void> {
  return request<void>('/auth/resend-verification', { method: 'POST', body: { email } })
}

export function login(payload: LoginRequest): Promise<AuthSession> {
  return request<AuthSession>('/auth/login', { method: 'POST', body: payload })
}

/** Rotates the token pair; the used refresh token is revoked. */
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

/** Revokes every session except the caller's. */
export function revokeOtherSessions(): Promise<void> {
  return request<void>('/auth/sessions', { method: 'DELETE', auth: true })
}

/** Always 202. Codes go only to active accounts with a local password. */
export function forgotPassword(payload: ForgotPasswordRequest): Promise<void> {
  return request<void>('/auth/forgot-password', { method: 'POST', body: payload })
}

/** Sets the new password and revokes every session. */
export function resetPassword(payload: ResetPasswordRequest): Promise<void> {
  return request<void>('/auth/reset-password', { method: 'POST', body: payload })
}

/** Changes the password and revokes every session, the current one included. */
export function changePassword(payload: ChangePasswordRequest): Promise<void> {
  return request<void>('/auth/change-password', { method: 'POST', body: payload, auth: true })
}

/** Deletion step 1: emails the code. Always 202. */
export function requestAccountDeletion(): Promise<void> {
  return request<void>('/auth/me/delete-request', { method: 'POST', auth: true })
}

/** Deletion step 2: irreversible, cascades to routes, sessions and identities. */
export function deleteAccount(code: string): Promise<void> {
  return request<void>('/auth/me', { method: 'DELETE', body: { code }, auth: true })
}

/** The backend answers 307 to the provider, so navigate to it instead of fetching. */
export function oauthAuthorizeUrl(provider: OAuthProvider): string {
  return `${API_BASE_URL}/auth/${provider}/authorize`
}

/**
 * Completes the OAuth flow for a client that can read the response.
 * Unused by the web app, which receives the tokens in the /oauth/callback fragment.
 */
export function oauthCallback(
  provider: OAuthProvider,
  params: { code: string; state: string },
): Promise<AuthSession> {
  return request<AuthSession>(`/auth/${provider}/callback`, { query: params })
}
