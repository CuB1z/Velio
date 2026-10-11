import { Alert, Button, InputOTP } from '@heroui/react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import * as authApi from '@/api/auth'
import { useApiErrorMessage } from '@/components/common/apiErrorMessage'
import { AuthLayout } from '@/components/layout/authLayout'
import { useCooldown } from '@/hooks/useCooldown'

export function VerifyEmailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const describe = useApiErrorMessage()

  const email = params.get('email') ?? ''
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const cooldown = useCooldown(60)

  const verify = useMutation({
    mutationFn: () => authApi.verify({ email, code }),
    onSuccess: () => void navigate('/login', { state: { notice: t('auth.verifyDone') } }),
    onError: (cause) => setError(describe(cause)),
  })

  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(email),
    onSuccess: () => {
      setNotice(t('auth.verifyResent'))
      cooldown.start()
    },
    onError: (cause) => setError(describe(cause)),
  })

  return (
    <AuthLayout
      footer={
        <Link to="/register" className="font-semibold">
          {t('auth.verifyOtherEmail')}
        </Link>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          verify.mutate()
        }}
      >
        <div className="flex size-12 items-center justify-center self-center rounded-xl bg-accent-soft text-accent">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6.5h18v11H3v-11Z" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </div>

        <div className="mb-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">{t('auth.verifyTitle')}</h1>
          <p className="mt-2 text-sm text-muted">{t('auth.verifySubtitle', { email })}</p>
        </div>

        {notice ? (
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{notice}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        <div className="flex justify-center">
          <InputOTP value={code} onChange={setCode} maxLength={6} aria-label={t('auth.verifyCode')} className="w-fit">
            <InputOTP.Group>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <InputOTP.Slot key={index} index={index} />
              ))}
            </InputOTP.Group>
          </InputOTP>
        </div>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          fullWidth
          className="min-h-12"
          isDisabled={code.length !== 6 || verify.isPending}
        >
          {t('auth.verifySubmit')}
        </Button>

        <div className="flex items-center justify-center gap-3 text-xs text-muted">
          {cooldown.left > 0 ? (
            <span className="tnum">{t('auth.verifyResendIn', { seconds: cooldown.left })}</span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 px-0"
              isDisabled={resend.isPending || !email}
              onPress={() => resend.mutate()}
            >
              {t('auth.verifyResend')}
            </Button>
          )}
        </div>

        <p className="rounded-lg border border-border bg-surface-secondary p-3 text-xs text-muted">
          {t('auth.verifyAttempts')}
        </p>
      </form>
    </AuthLayout>
  )
}
