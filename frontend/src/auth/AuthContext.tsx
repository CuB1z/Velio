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

  // Must be registered before any child fires an authenticated request.
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

  // On startup, exchange a stored refresh token for a live session.
  // setState is deliberate here: the effect syncs with localStorage and the backend.
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

  /** The fragment only carries tokens, so the profile is fetched separately. */
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
    // Always clear locally: an orphaned refresh token beats keeping the user signed in.
    try {
      if (token) await authApi.logout(token)
    } catch {
      // ignored
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
