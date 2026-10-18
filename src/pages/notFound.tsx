import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useLangPath } from '@/lib/paths'

export function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const to = useLangPath()

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t('error.notFoundTitle')}</h1>
      <p className="max-w-sm text-sm text-muted">{t('error.notFoundBody')}</p>
      <Button variant="primary" className="min-h-11" onPress={() => void navigate(to('/loops'))}>
        {t('error.notFoundAction')}
      </Button>
    </div>
  )
}
