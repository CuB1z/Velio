import { Button } from '@heroui/react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { isApiError } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import { GoogleButton } from '@/components/auth/googleButton'
import { useApiErrorMessage } from '@/components/common/apiErrorMessage'
import { PasswordInput, TextInput } from '@/components/common/field'
import { AuthLayout } from '@/components/layout/authLayout'
import { useRetryAfter } from '@/hooks/useRetryAfter'
import { Divider } from './divider'

export function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const describe = useApiErrorMessage()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: () => {
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
      void navigate(from ?? '/loops', { replace: true })
    },
    onError: (cause) => {
      // An unverified account isn't a form error: it's the next step.
      if (isApiError(cause) && cause.code === 'EMAIL_NOT_VERIFIED') {
        void navigate(`/verify?email=${encodeURIComponent(email)}`)
        return
      }
      setError(describe(cause))
    },
  })
  const retryIn = useRetryAfter(mutation.error)

  return (
    <AuthLayout
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-semibold">
            {t('auth.createOne')}
          </Link>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          mutation.mutate()
        }}
      >
        <div className="mb-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">{t('auth.loginTitle')}</h1>
          <p className="mt-2 text-sm text-muted">{t('auth.loginSubtitle')}</p>
        </div>

        <TextInput
          label={t('auth.email')}
          value={email}
          onChange={setEmail}
          type="email"
          inputMode="email"
          autoComplete="email"
          isRequired
          autoFocus
        />

        <PasswordInput
          label={t('auth.password')}
          value={password}
          onChange={setPassword}
          isRequired
          errorMessage={error ?? undefined}
          labelAction={
            <Link to="/forgot-password" className="text-xs">
              {t('auth.forgot')}
            </Link>
          }
        />

        <Button
          type="submit"
          variant="primary"
          fullWidth
          className="min-h-12"
          isDisabled={!email || !password || mutation.isPending || retryIn > 0}
        >
          {retryIn > 0 ? t('common.retryIn', { seconds: retryIn }) : t('auth.submitLogin')}
        </Button>

        <Divider label={t('auth.or')} />
        <GoogleButton />
      </form>
    </AuthLayout>
  )
}
