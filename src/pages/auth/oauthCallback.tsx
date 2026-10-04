import { Button, Spinner } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/useAuth'
import { useApiErrorMessage } from '@/components/common/apiErrorMessage'
import { AuthLayout } from '@/components/layout/authLayout'

/**
 * Vuelta de OAuth.
 *
 * El backend redirige aquí con el resultado en el fragmento (`#`), que nunca
 * viaja al servidor: así los tokens no acaban en logs de acceso, proxies ni en
 * la cabecera Referer. Requiere `OAUTH_SUCCESS_REDIRECT` apuntando a esta ruta;
 * sin esa variable el backend responde JSON y el navegador nunca llega hasta
 * aquí.
 */
export function OAuthCallbackPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { adoptTokens } = useAuth()
  const describe = useApiErrorMessage()
  const [error, setError] = useState<string | null>(null)
  const done = useRef(false)

  // El intercambio ocurre una sola vez, contra un sistema externo.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    if (done.current) return
    done.current = true

    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    // Se borra de la barra y del historial en cuanto se ha leído.
    window.history.replaceState(null, '', window.location.pathname)

    const failure = fragment.get('error')
    if (failure) {
      setError(fragment.get('message') || t('auth.oauthError'))
      return
    }

    const accessToken = fragment.get('access_token')
    const refreshToken = fragment.get('refresh_token')
    if (!accessToken || !refreshToken) {
      setError(t('auth.oauthError'))
      return
    }

    void (async () => {
      try {
        await adoptTokens({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'bearer',
        })
        void navigate('/loops', { replace: true })
      } catch (cause) {
        setError(describe(cause))
      }
    })()
  }, [adoptTokens, navigate, describe, t])

  return (
    <AuthLayout>
      <div className="flex flex-col items-start gap-5">
        {error ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{t('error.title')}</h1>
            <p className="text-sm text-muted">{error}</p>
            <Button variant="primary" className="min-h-12" onPress={() => void navigate('/login')}>
              {t('auth.backToLogin')}
            </Button>
          </>
        ) : (
          <>
            <Spinner aria-label={t('auth.oauthTitle')} />
            <p className="text-sm text-muted">{t('auth.oauthTitle')}</p>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
