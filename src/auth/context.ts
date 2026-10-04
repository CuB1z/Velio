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
  /** Consume la sesión que devuelve el callback de OAuth. */
  adoptSession: (session: AuthSession) => void
  /** Adopta un par de tokens suelto (vuelta de OAuth por el fragmento). */
  adoptTokens: (tokens: Tokens) => Promise<void>
  /** Relee /auth/me, p. ej. tras verificar el correo. */
  reloadUser: () => Promise<void>
  oauthAuthorizeUrl: (provider: OAuthProvider) => string
}

export const AuthContext = createContext<AuthContextValue | null>(null)
