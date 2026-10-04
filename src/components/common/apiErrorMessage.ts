import { useTranslation } from 'react-i18next'

import { isApiError } from '@/api/errors'

/** Turns any failure into a useful message without leaking backend details. */
export function useApiErrorMessage(): (error: unknown) => string {
  const { t } = useTranslation()

  return (error: unknown) => {
    if (!isApiError(error)) return t('error.generic')

    if (error.code === 'RATE_LIMITED') {
      return error.retryAfter
        ? t('error.RATE_LIMITED', { seconds: error.retryAfter })
        : t('error.RATE_LIMITED_NOW')
    }

    const key = `error.${error.code}`
    const message = t(key)
    // i18next returns the key when it is missing: fall back to the generic message.
    return message === key ? t('error.generic') : message
  }
}
