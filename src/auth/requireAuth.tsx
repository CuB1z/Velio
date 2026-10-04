import { Spinner } from '@heroui/react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from './useAuth'

/**
 * Keeps the app behind login, since routing endpoints require a Bearer token.
 * Waits for the refresh exchange before deciding, so a reload doesn't kick out a valid session.
 */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <Spinner aria-label="Comprobando la sesión" />
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

/** Auth routes: signed-in users shouldn't see the login. */
export function RedirectIfAuthenticated() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <Spinner aria-label="Comprobando la sesión" />
      </div>
    )
  }

  if (status === 'authenticated') {
    return <Navigate to="/loops" replace />
  }

  return <Outlet />
}
