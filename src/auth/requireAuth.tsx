import { Spinner } from '@heroui/react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from './useAuth'

/**
 * Los endpoints de cálculo exigen Bearer, así que el planificador entero vive
 * detrás del login. Mientras se canjea el refresh token no se decide nada: si
 * redirigiéramos, un recargado de página echaría fuera a quien sí tiene sesión.
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

/** Rutas de acceso: quien ya tiene sesión no debe ver el login. */
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
