import { Button } from '@heroui/react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import * as authApi from '@/api/auth'
import { useAuth } from '@/auth/useAuth'
import { useApiErrorMessage } from '@/components/common/apiErrorMessage'
import { TextInput } from '@/components/common/field'

/** Display name editor; the backend tidies whitespace, the session reloads after saving. */
export function ProfileForm({ name }: { name: string }) {
  const { t } = useTranslation()
  const { reloadUser } = useAuth()
  const describe = useApiErrorMessage()
  const [draft, setDraft] = useState(name)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => authApi.updateProfile({ full_name: draft.trim() }),
    onSuccess: async () => {
      setNotice(t('account.nameSaved'))
      await reloadUser()
    },
    onError: (failure) => setError(describe(failure)),
  })

  const unchanged = draft.trim() === name || draft.trim().length === 0

  return (
    <form
      className="flex w-full flex-col gap-2 lg:max-w-sm"
      onSubmit={(event) => {
        event.preventDefault()
        if (unchanged) return
        setNotice(null)
        setError(null)
        save.mutate()
      }}
    >
      <div className="flex items-start gap-2">
        <TextInput
          label={t('account.name')}
          labelHidden
          value={draft}
          onChange={setDraft}
          autoComplete="name"
          errorMessage={error ?? undefined}
          className="flex-1"
        />
        <Button type="submit" variant="secondary" className="min-h-11 shrink-0" isDisabled={unchanged || save.isPending}>
          {t('account.nameSave')}
        </Button>
      </div>
      {notice ? (
        <p className="eyebrow text-accent-text" role="status">
          {notice}
        </p>
      ) : null}
    </form>
  )
}
