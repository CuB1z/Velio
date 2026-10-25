import { Button, Checkbox } from '@heroui/react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/useAuth'
import { Divider } from '@/components/auth/divider'
import { GoogleButton } from '@/components/auth/googleButton'
import { useLegalLinks } from '@/components/auth/legalLinks'
import { PasswordRules } from '@/components/auth/passwordRules'
import { useApiErrorMessage } from '@/components/common/apiErrorMessage'
import { PasswordInput, TextInput } from '@/components/common/field'
import { AuthLayout } from '@/components/layout/authLayout'
import { useRetryAfter } from '@/hooks/useRetryAfter'
import { isPasswordValid } from '@/lib/passwordPolicy'
import { useLangPath } from '@/lib/paths'

export function RegisterPage() {
  const { t } = useTranslation()
  const { register } = useAuth()
  const navigate = useNavigate()
  const to = useLangPath()
  const describe = useApiErrorMessage()
  const legalLinks = useLegalLinks()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => register({ email, password }),
    onSuccess: () => void navigate(`${to('/verify')}?email=${encodeURIComponent(email)}`),
    onError: (cause) => setError(describe(cause)),
  })
  const retryIn = useRetryAfter(mutation.error)

  const canSubmit = accepted && email.includes('@') && isPasswordValid(password, email)

  return (
    <AuthLayout
      eyebrow={t('auth.registerEyebrow')}
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSubtitle')}
      footer={
        <>
          {t('auth.hasAccount')}{' '}
          <Link to={to('/login')} className="font-semibold">
            {t('auth.submitLogin')}
          </Link>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          mutation.mutate()
        }}
      >
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

        <div className="flex flex-col gap-3">
          <PasswordInput
            label={t('auth.password')}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            isRequired
            errorMessage={error ?? undefined}
          />
          {password ? (
            <PasswordRules password={password} email={email} />
          ) : (
            <span className="text-xs text-muted">{t('auth.passwordRules')}</span>
          )}
        </div>

        <Checkbox isSelected={accepted} onChange={setAccepted}>
          <Checkbox.Content className="flex flex-row items-start gap-3 text-xs text-muted">
            <Checkbox.Control className="mt-0.5 [--field-border:color-mix(in_oklch,var(--muted)_70%,transparent)]">
              <Checkbox.Indicator />
            </Checkbox.Control>
            <span>
              <Trans i18nKey="auth.terms" components={legalLinks} />
            </span>
          </Checkbox.Content>
        </Checkbox>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          className="min-h-12"
          isDisabled={!canSubmit || mutation.isPending || retryIn > 0}
        >
          {retryIn > 0 ? t('common.retryIn', { seconds: retryIn }) : t('auth.submitRegister')}
        </Button>

        <Divider label={t('auth.or')} />
        <GoogleButton />
      </form>
    </AuthLayout>
  )
}
