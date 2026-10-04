import { Alert, Button } from '@heroui/react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import * as authApi from '@/api/auth'
import { useApiErrorMessage } from '@/components/common/apiErrorMessage'
import { TextInput } from '@/components/common/field'
import { AuthLayout } from '@/components/layout/authLayout'

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const describe = useApiErrorMessage()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => authApi.forgotPassword({ email }),
    onSuccess: () => setSent(true),
    onError: (cause) => setError(describe(cause)),
  })

  return (
    <AuthLayout
      footer={
        <Link to="/login" className="font-semibold">
          {t('auth.backToLogin')}
        </Link>
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
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('auth.forgotTitle')}</h1>
          <p className="mt-2 text-sm text-muted">{t('auth.forgotSubtitle')}</p>
        </div>

        {sent ? (
          <>
            <Alert status="success">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{t('auth.forgotSent')}</Alert.Description>
              </Alert.Content>
            </Alert>
            <Button
              variant="primary"
              fullWidth
              className="min-h-12"
              onPress={() =>
                void navigate(`/reset-password?email=${encodeURIComponent(email)}`)
              }
            >
              {t('common.continue')}
            </Button>
          </>
        ) : (
          <>
            <TextInput
              label={t('auth.email')}
              value={email}
              onChange={setEmail}
              type="email"
              inputMode="email"
              autoComplete="email"
              isRequired
              autoFocus
              errorMessage={error ?? undefined}
            />
            <Button
              type="submit"
              variant="primary"
              fullWidth
              className="min-h-12"
              isDisabled={!email.includes('@') || mutation.isPending}
            >
              {t('auth.forgotSubmit')}
            </Button>
          </>
        )}
      </form>
    </AuthLayout>
  )
}
