import { Alert, Button, Card, Chip, InputOTP, Modal, Spinner, useOverlayState } from '@heroui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import * as authApi from '@/api/auth'
import { useAuth } from '@/auth/useAuth'
import { useApiErrorMessage } from '@/components/common/apiErrorMessage'
import { ErrorState } from '@/components/common/errorState'
import { PasswordInput } from '@/components/common/field'
import { PageHeader } from '@/components/common/pageHeader'
import { formatDateTime } from '@/lib/format'
import type { AccountStatus } from '@/types/api'

const STATUS_COLOR: Record<AccountStatus, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
}

const STATUS_KEY: Record<AccountStatus, string> = {
  active: 'account.verified',
  pending: 'account.pending',
  suspended: 'account.suspended',
}

export function AccountPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const client = useQueryClient()
  const describe = useApiErrorMessage()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [deleteCode, setDeleteCode] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null)
  const deleteDialog = useOverlayState()

  const sessions = useQuery({ queryKey: ['sessions'], queryFn: authApi.sessions })

  const changePassword = useMutation({
    mutationFn: () =>
      authApi.changePassword({ current_password: current, new_password: next }),
    onSuccess: () => {
      setPasswordNotice(t('account.passwordChanged'))
      setCurrent('')
      setNext('')
      // El backend revoca todas las sesiones, esta incluida.
      window.setTimeout(() => void logout(), 1500)
    },
    onError: (error) => setPasswordError(describe(error)),
  })

  const revoke = useMutation({
    mutationFn: (id: number) => authApi.revokeSession(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['sessions'] }),
  })

  const revokeOthers = useMutation({
    mutationFn: () => authApi.revokeOtherSessions(),
    onSuccess: () => client.invalidateQueries({ queryKey: ['sessions'] }),
  })

  const requestDeletion = useMutation({
    mutationFn: () => authApi.requestAccountDeletion(),
    onSuccess: () => {
      setDeleteNotice(t('account.dangerCodeSent', { email: user?.email ?? '' }))
      deleteDialog.open()
    },
    onError: (error) => setDeleteError(describe(error)),
  })

  const confirmDeletion = useMutation({
    mutationFn: () => authApi.deleteAccount(deleteCode),
    onSuccess: () => void logout(),
    onError: (error) => setDeleteError(describe(error)),
  })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <PageHeader title={t('account.title')} subtitle={t('account.subtitle')} />

      <Card>
        <Card.Content className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
            {(user?.full_name || user?.email || '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-semibold">
                {user?.full_name || user?.email}
              </span>
              {user ? (
                <Chip color={STATUS_COLOR[user.status]} variant="soft" size="sm">
                  <Chip.Label>{t(STATUS_KEY[user.status])}</Chip.Label>
                </Chip>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-sm text-muted">{user?.email}</p>
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="p-5 pb-0">
          <Card.Title>{t('account.password')}</Card.Title>
          <Card.Description>{t('account.passwordHint')}</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4 p-5">
          {passwordNotice ? (
            <Alert status="success">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{passwordNotice}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
          <PasswordInput
            label={t('account.currentPassword')}
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
          />
          <PasswordInput
            label={t('account.newPassword')}
            value={next}
            onChange={setNext}
            autoComplete="new-password"
            errorMessage={passwordError ?? undefined}
          />
          <Button
            variant="secondary"
            className="min-h-11 self-start"
            isDisabled={!current || !next || changePassword.isPending}
            onPress={() => {
              setPasswordError(null)
              changePassword.mutate()
            }}
          >
            {t('account.changePassword')}
          </Button>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="flex flex-wrap items-start justify-between gap-3 p-5 pb-0">
          <div>
            <Card.Title>{t('account.sessions')}</Card.Title>
            <Card.Description>{t('account.sessionsHint')}</Card.Description>
          </div>
          <Button
            variant="ghost"
            className="min-h-11"
            isDisabled={revokeOthers.isPending || (sessions.data?.length ?? 0) < 2}
            onPress={() => revokeOthers.mutate()}
          >
            {t('account.revokeOthers')}
          </Button>
        </Card.Header>
        <Card.Content className="p-5">
          {sessions.isLoading ? (
            <Spinner aria-label={t('common.loading')} />
          ) : sessions.isError ? (
            <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {sessions.data?.map((session) => (
                <li key={session.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {session.user_agent || '—'}
                      </span>
                      {session.current ? (
                        <Chip color="accent" variant="soft" size="sm">
                          <Chip.Label>{t('account.sessionCurrent')}</Chip.Label>
                        </Chip>
                      ) : null}
                    </div>
                    <p className="tnum mt-0.5 text-xs text-muted">
                      {t('account.sessionStarted', { date: formatDateTime(session.created_at) })}
                    </p>
                  </div>
                  {session.current ? null : (
                    <Button
                      variant="ghost"
                      className="min-h-11 shrink-0"
                      isDisabled={revoke.isPending}
                      onPress={() => revoke.mutate(session.id)}
                    >
                      {t('account.revoke')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card.Content>
      </Card>

      <Card className="border-danger/40">
        <Card.Content className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-danger">{t('account.danger')}</p>
            <p className="mt-1.5 max-w-prose text-sm text-muted">{t('account.dangerBody')}</p>
            {deleteError ? (
              <p className="mt-2 text-sm text-danger" role="alert">
                {deleteError}
              </p>
            ) : null}
          </div>
          <Button
            variant="danger-soft"
            className="min-h-11 shrink-0"
            isDisabled={requestDeletion.isPending}
            onPress={() => {
              setDeleteError(null)
              requestDeletion.mutate()
            }}
          >
            {t('account.dangerAction')}
          </Button>
        </Card.Content>
      </Card>

      <Modal state={deleteDialog}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{t('account.dangerConfirmTitle')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <p className="text-sm text-muted">{t('account.dangerConfirmBody')}</p>
                {deleteNotice ? <p className="text-sm">{deleteNotice}</p> : null}
                <InputOTP
                  value={deleteCode}
                  onChange={setDeleteCode}
                  maxLength={6}
                  aria-label={t('auth.verifyCode')}
                >
                  <InputOTP.Group>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTP.Slot key={index} index={index} />
                    ))}
                  </InputOTP.Group>
                </InputOTP>
                {deleteError ? (
                  <p className="text-sm text-danger" role="alert">
                    {deleteError}
                  </p>
                ) : null}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button variant="ghost" className="min-h-11" onPress={deleteDialog.close}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="danger"
                  className="min-h-11"
                  isDisabled={deleteCode.length !== 6 || confirmDeletion.isPending}
                  onPress={() => {
                    setDeleteError(null)
                    confirmDeletion.mutate()
                  }}
                >
                  {t('common.confirm')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  )
}
