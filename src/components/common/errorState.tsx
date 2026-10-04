import { Alert, Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { useApiErrorMessage } from './apiErrorMessage'

type Props = {
  error: unknown
  onRetry?: () => void
  className?: string
}

/** Bloque de error en línea. No hay sistema de toasts: el aviso sale donde ocurrió. */
export function ErrorState({ error, onRetry, className }: Props) {
  const { t } = useTranslation()
  const describe = useApiErrorMessage()

  if (!error) return null

  return (
    <Alert status="danger" className={className}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t('error.title')}</Alert.Title>
        <Alert.Description>{describe(error)}</Alert.Description>
      </Alert.Content>
      {onRetry ? (
        <Button variant="ghost" size="sm" onPress={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </Alert>
  )
}
