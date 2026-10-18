import { Button, InputOTP } from '@heroui/react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import * as authApi from '@/api/auth'
import { PasswordRules } from '@/components/auth/passwordRules'
import { useApiErrorMessage } from '@/components/common/apiErrorMessage'
import { PasswordInput, TextInput } from '@/components/common/field'
import { AuthLayout } from '@/components/layout/authLayout'
import { isPasswordValid } from '@/lib/passwordPolicy'
import { useLangPath } from '@/lib/paths'

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const to = useLangPath()
  const [params] = useSearchParams()
  const describe = useApiErrorMessage()

  const [email, setEmail] = useState(params.get('email') ?? '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => authApi.resetPassword({ email, code, new_password: password }),
    onSuccess: () => void navigate(to('/login'), { state: { notice: t('auth.resetDone') } }),
    onError: (cause) => setError(describe(cause)),
  })

  const canSubmit = email.includes('@') && code.length === 6 && isPasswordValid(password, email)

  return (
    <AuthLayout
      footer={
        <Link to={to('/login')} className="font-semibold">
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
        <div className="mb-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">{t('auth.resetTitle')}</h1>
          <p className="mt-2 text-sm text-muted">{t('auth.resetSubtitle', { email })}</p>
        </div>

        {params.get('email') ? null : (
          <TextInput
            label={t('auth.email')}
            value={email}
            onChange={setEmail}
            type="email"
            inputMode="email"
            isRequired
          />
        )}

        <div className="flex justify-center">
          <InputOTP value={code} onChange={setCode} maxLength={6} aria-label={t('auth.verifyCode')} className="w-fit">
            <InputOTP.Group>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <InputOTP.Slot key={index} index={index} />
              ))}
            </InputOTP.Group>
          </InputOTP>
        </div>

        <div className="flex flex-col gap-3">
          <PasswordInput
            label={t('account.newPassword')}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            isRequired
            errorMessage={error ?? undefined}
          />
          <PasswordRules password={password} email={email} />
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          className="min-h-12"
          isDisabled={!canSubmit || mutation.isPending}
        >
          {t('auth.resetSubmit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
