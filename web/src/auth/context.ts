import { createContext } from 'react'

import type {
  AuthSession,
  LoginRequest,
  OAuthProvider,
  RegisterRequest,
  Tokens,
  User,
} from '@/types/api'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export type AuthContextValue = {
  status: AuthStatus
  user: User | null
  login: (payload: LoginRequest) => Promise<void>
  register: (payload: RegisterRequest) => Promise<User>
  logout: () => Promise<void>
  /** Consumes the session returned by the OAuth callback. */
  adoptSession: (session: AuthSession) => void
  /** Adopts a bare token pair (OAuth return via the URL fragment). */
  adoptTokens: (tokens: Tokens) => Promise<void>
  /** Re-reads /auth/me, e.g. after verifying the email. */
  reloadUser: () => Promise<void>
  oauthAuthorizeUrl: (provider: OAuthProvider) => string
}

export const AuthContext = createContext<AuthContextValue | null>(null)
