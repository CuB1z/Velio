import { useTranslation } from 'react-i18next'

import { isApiError } from '@/api/errors'

/** Traduce cualquier fallo a una frase útil, sin filtrar detalles del backend. */
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
    // i18next devuelve la clave cuando no existe: ahí cae al mensaje genérico.
    return message === key ? t('error.generic') : message
  }
}
