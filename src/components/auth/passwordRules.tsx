import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { checkPassword } from '@/lib/passwordPolicy'

const LABEL: Record<string, string> = {
  length: 'auth.ruleLength',
  lower: 'auth.ruleLower',
  upper: 'auth.ruleUpper',
  digit: 'auth.ruleDigit',
  notEmail: 'auth.ruleNotEmail',
}

/** Estado de la política de contraseña. El icono acompaña al color, nunca lo sustituye. */
export function PasswordRules({ password, email }: { password: string; email?: string }) {
  const { t } = useTranslation()
  const rules = checkPassword(password, email)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{t('auth.passwordRules')}</span>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-center gap-2 text-xs">
            {rule.passed ? <CheckIcon /> : <DotIcon />}
            <span className={cn(rule.passed ? 'text-foreground' : 'text-muted')}>
              {t(LABEL[rule.id])}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--success)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.4 6.4 11.3 12.5 5" />
    </svg>
  )
}

function DotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-muted" aria-hidden="true">
      <circle cx="8" cy="8" r="5.2" />
    </svg>
  )
}
