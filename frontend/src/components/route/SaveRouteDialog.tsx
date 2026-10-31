import { Button, useOverlayState } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import * as savedRoutes from '@/api/savedRoutes'
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage'
import { TextInput } from '../common/Field'
import { ResponsiveDialog } from '../common/ResponsiveDialog'

type Props = {
  /** Verbatim response of the compute endpoint: it is what the backend stores. */
  payload: Record<string, unknown>
  defaultName: string
  isDisabled?: boolean
  onSaved?: (id: string) => void
}

export function SaveRouteDialog({ payload, defaultName, isDisabled, onSaved }: Props) {
  const { t } = useTranslation()
  const describe = useApiErrorMessage()
  const state = useOverlayState()
  const client = useQueryClient()
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const saved = await savedRoutes.save({ name: name.trim(), payload })
      setDone(true)
      state.close()
      void client.invalidateQueries({ queryKey: ['savedRoutes'] })
      onSaved?.(saved.id)
    } catch (cause) {
      setError(describe(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        isDisabled={isDisabled}
        className="min-h-11"
        onPress={() => {
          setName(defaultName)
          setError(null)
          state.open()
        }}
      >
        <BookmarkIcon />
        {done ? t('result.saved') : t('result.save')}
      </Button>

      <ResponsiveDialog state={state}>
        <ResponsiveDialog.Header>
          <ResponsiveDialog.Heading>{t('result.saveDialogTitle')}</ResponsiveDialog.Heading>
        </ResponsiveDialog.Header>
        <ResponsiveDialog.Body className="flex flex-col gap-3">
          <TextInput
            label={t('result.saveDialogName')}
            value={name}
            onChange={setName}
            placeholder={t('result.saveDialogPlaceholder')}
            errorMessage={error ?? undefined}
            autoFocus
            isRequired
          />
        </ResponsiveDialog.Body>
        <ResponsiveDialog.Footer>
          <Button variant="ghost" onPress={state.close} className="min-h-11">
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onPress={() => void submit()}
            isDisabled={busy || !name.trim()}
            className="min-h-11"
          >
            {t('common.save')}
          </Button>
        </ResponsiveDialog.Footer>
      </ResponsiveDialog>
    </>
  )
}

function BookmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 2.5h8v11l-4-2.9-4 2.9v-11Z" />
    </svg>
  )
}
