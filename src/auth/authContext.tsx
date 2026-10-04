import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'

import * as authApi from '@/api/auth'
import { setAuthHandlers } from '@/api/client'
import type { AuthSession, LoginRequest, RegisterRequest, Tokens, User } from '@/types/api'
import { AuthContext, type AuthContextValue, type AuthStatus } from './context'
import { clearRefreshToken, readRefreshToken, writeRefreshToken } from './storage'

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const accessToken = useRef<string | null>(null)
  const bootstrapped = useRef(false)

  const applySession = useCallback((session: AuthSession) => {
    accessToken.current = session.tokens.access_token
    writeRefreshToken(session.tokens.refresh_token)
    setUser(session.user)
    setStatus('authenticated')
  }, [])

  const clearSession = useCallback(() => {
    accessToken.current = null
    clearRefreshToken()
    setUser(null)
    setStatus('anonymous')
  }, [])

  // Debe quedar registrado antes de que ningún hijo lance una petición autenticada.
  useLayoutEffect(() => {
    setAuthHandlers({
      getAccessToken: () => accessToken.current,
      refresh: async () => {
        const token = readRefreshToken()
        if (!token) return false
        try {
          applySession(await authApi.refresh(token))
          return true
        } catch {
          clearSession()
          return false
        }
      },
      onSessionLost: clearSession,
    })
    return () => setAuthHandlers(null)
  }, [applySession, clearSession])

  // Arranque: si hay refresh token guardado, se canjea por una sesión viva.
  // El setState aquí es deliberado: sincroniza con dos sistemas externos
  // (localStorage y el backend), que es justo para lo que existen los efectos.
  // oxlint-disable-next-line react/set-state-in-effect
  useLayoutEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true

    const token = readRefreshToken()
    if (!token) {
      setStatus('anonymous')
      return
    }

    void (async () => {
      try {
        applySession(await authApi.refresh(token))
      } catch {
        clearSession()
      }
    })()
  }, [applySession, clearSession])

  /** El fragmento solo trae tokens, así que el perfil se pide aparte. */
  const adoptTokens = useCallback(
    async (tokens: Tokens) => {
      accessToken.current = tokens.access_token
      writeRefreshToken(tokens.refresh_token)
      try {
        setUser(await authApi.me())
        setStatus('authenticated')
      } catch (cause) {
        clearSession()
        throw cause
      }
    },
    [clearSession],
  )

  const login = useCallback(
    async (payload: LoginRequest) => {
      applySession(await authApi.login(payload))
    },
    [applySession],
  )

  const register = useCallback((payload: RegisterRequest) => authApi.register(payload), [])

  const logout = useCallback(async () => {
    const token = readRefreshToken()
    // La sesión local se cierra pase lo que pase: si el backend no responde,
    // dejar al usuario dentro sería peor que un refresh token huérfano.
    try {
      if (token) await authApi.logout(token)
    } catch {
      // sin efecto
    } finally {
      clearSession()
    }
  }, [clearSession])

  const reloadUser = useCallback(async () => {
    try {
      setUser(await authApi.me())
    } catch {
      clearSession()
    }
  }, [clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login,
      register,
      logout,
      adoptSession: applySession,
      adoptTokens,
      reloadUser,
      oauthAuthorizeUrl: authApi.oauthAuthorizeUrl,
    }),
    [status, user, login, register, logout, applySession, adoptTokens, reloadUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
