import { Button, Spinner } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/useAuth'
import { useApiErrorMessage } from '@/components/common/apiErrorMessage'
import { AuthLayout } from '@/components/layout/authLayout'
import { useLangPath } from '@/lib/paths'

/**
 * OAuth callback: reads the result from the URL fragment, which keeps tokens out of server logs, proxies and Referer.
 * Requires the backend's `OAUTH_SUCCESS_REDIRECT` to point at this route.
 */
export function OAuthCallbackPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const to = useLangPath()
  const { adoptTokens } = useAuth()
  const describe = useApiErrorMessage()
  const [error, setError] = useState<string | null>(null)
  const done = useRef(false)

  // The exchange runs once, against an external system.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    if (done.current) return
    done.current = true

    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    // Clear it from the address bar and history as soon as it's read.
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
        void navigate(to('/loops'), { replace: true })
      } catch (cause) {
        setError(describe(cause))
      }
    })()
  }, [adoptTokens, navigate, describe, t, to])

  return (
    <AuthLayout eyebrow={t('auth.loginEyebrow')} title={error ? t('error.title') : t('auth.oauthTitle')}>
      {error ? (
        <div className="flex flex-col items-start gap-5">
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
          <Button variant="primary" className="min-h-12" onPress={() => void navigate(to('/login'))}>
            {t('auth.backToLogin')}
          </Button>
        </div>
      ) : (
        <Spinner aria-label={t('auth.oauthTitle')} />
      )}
    </AuthLayout>
  )
}
