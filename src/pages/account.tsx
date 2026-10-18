import { Button, InputOTP, Modal, Spinner, useOverlayState } from '@heroui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import * as authApi from '@/api/auth'
import { useAuth } from '@/auth/useAuth'
import { ProfileForm } from '@/components/account/profileForm'
import { SettingRow } from '@/components/account/settingRow'
import { useApiErrorMessage } from '@/components/common/apiErrorMessage'
import { ErrorState } from '@/components/common/errorState'
import { PasswordInput } from '@/components/common/field'
import { PageHeader } from '@/components/common/pageHeader'
import { SegmentedControl } from '@/components/common/segmentedControl'
import { useActiveSection } from '@/hooks/useActiveSection'
import { useTheme, type ThemePreference } from '@/hooks/useTheme'
import i18n, { LANGUAGE_INFO, LANGUAGES, type Language } from '@/i18n'
import { cn } from '@/lib/cn'
import { swapLang, useLangPath } from '@/lib/paths'
import { formatDateTime } from '@/lib/format'
import { parseUserAgent } from '@/lib/userAgent'
import type { AccountStatus, DeviceSession } from '@/types/api'

const STATUS_TONE: Record<AccountStatus, string> = {
  active: 'text-accent-text',
  pending: 'text-warning',
  suspended: 'text-danger',
}

const STATUS_KEY: Record<AccountStatus, string> = {
  active: 'account.verified',
  pending: 'account.pending',
  suspended: 'account.suspended',
}

const SECTIONS = [
  { id: 'perfil', key: 'account.navProfile' },
  { id: 'preferencias', key: 'account.navPreferences' },
  { id: 'seguridad', key: 'account.navSecurity' },
  { id: 'sesiones', key: 'account.navSessions' },
  { id: 'cuenta', key: 'account.navAccount' },
]
const SECTION_IDS = SECTIONS.map((section) => section.id)

const THEMES: ThemePreference[] = ['light', 'dark', 'system']

export function AccountPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const to = useLangPath()
  const client = useQueryClient()
  const describe = useApiErrorMessage()
  const { preference, setPreference } = useTheme()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [deleteCode, setDeleteCode] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null)
  const deleteDialog = useOverlayState()
  const active = useActiveSection(SECTION_IDS)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = navRef.current
    const item = nav?.querySelector<HTMLElement>('[aria-current]')
    if (!nav || !item || nav.scrollWidth <= nav.clientWidth) return
    nav.scrollTo({ left: item.offsetLeft - 16, behavior: 'smooth' })
  }, [active])

  const sessions = useQuery({ queryKey: ['sessions'], queryFn: authApi.sessions })

  const changePassword = useMutation({
    mutationFn: () =>
      authApi.changePassword({ current_password: current, new_password: next }),
    onSuccess: () => {
      setPasswordNotice(t('account.passwordChanged'))
      setCurrent('')
      setNext('')
      // The backend revokes every session, this one included.
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

  const initials = (user?.full_name || user?.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  const language = (i18n.language.slice(0, 2) as Language) ?? 'es'

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-10 p-4 sm:p-6 lg:p-10">
      <PageHeader eyebrow={t('account.eyebrow')} title={t('account.heading')} />

      <div className="grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-20">
        <nav
          ref={navRef}
          aria-label={t('account.heading')}
          className="no-scrollbar sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-border bg-background/90 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:top-10 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        >
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active === section.id ? 'true' : undefined}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                active === section.id
                  ? 'bg-surface-hover text-foreground'
                  : 'text-muted hover:bg-surface-hover hover:text-foreground',
              )}
            >
              {t(section.key)}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-16">
          <section id="perfil" className="flex flex-col gap-6 scroll-mt-16 lg:scroll-mt-10">
            <div className="flex items-center gap-5">
              <span
                aria-hidden="true"
                className="code flex size-16 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-semibold text-accent-soft-foreground"
              >
                {initials}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h2 className="truncate text-2xl font-semibold tracking-tight">{user?.full_name || user?.email}</h2>
                  {user ? (
                    <span className={cn('eyebrow', STATUS_TONE[user.status])}>● {t(STATUS_KEY[user.status])}</span>
                  ) : null}
                </div>
                <p className="truncate text-sm text-muted">{user?.email}</p>
              </div>
            </div>
            <div>
              <SettingRow label={t('account.name')} description={t('account.nameHint')} align="start">
                {user ? <ProfileForm key={user.full_name} name={user.full_name} /> : null}
              </SettingRow>
              <SettingRow label={t('account.email')} description={t('account.emailHint')} className="border-b border-border">
                <span className="code text-sm">{user?.email}</span>
                {user?.status === 'active' ? <span className="eyebrow text-accent-text">{t('account.verified')}</span> : null}
              </SettingRow>
            </div>
          </section>

          <section id="preferencias" className="flex flex-col gap-6 scroll-mt-16 lg:scroll-mt-10">
            <SectionTitle eyebrow={t('account.navPreferences')} title={t('account.preferencesTitle')} />
            <div>
              <SettingRow label={t('account.language')} description={t('account.languageHint')}>
                <SegmentedControl
                  label={t('account.language')}
                  options={LANGUAGES.map((id) => ({ id, label: LANGUAGE_INFO[id].name }))}
                  value={language}
                  onChange={(id) =>
                    void navigate(
                      { pathname: swapLang(location.pathname, id), search: location.search },
                      { replace: true },
                    )
                  }
                  className="w-full lg:w-64"
                />
              </SettingRow>
              <SettingRow label={t('account.theme')} description={t('account.themeHint')} className="border-b border-border">
                <SegmentedControl
                  label={t('account.theme')}
                  options={THEMES.map((id) => ({ id, label: t(`theme.${id}`) }))}
                  value={preference}
                  onChange={setPreference}
                  className="w-full lg:w-auto"
                />
              </SettingRow>
            </div>
          </section>

          <section id="seguridad" className="flex flex-col gap-6 scroll-mt-16 lg:scroll-mt-10">
            <SectionTitle eyebrow={t('account.navSecurity')} title={t('account.securityTitle')} />
            <SettingRow
              label={t('account.passwordRow')}
              description={t('account.passwordRowHint')}
              align="start"
              className="border-b border-border"
            >
              <form
                className="flex w-full flex-col gap-3 lg:max-w-sm"
                onSubmit={(event) => {
                  event.preventDefault()
                  setPasswordError(null)
                  changePassword.mutate()
                }}
              >
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
                {passwordNotice ? (
                  <p className="eyebrow text-accent-text" role="status">
                    {passwordNotice}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  variant="secondary"
                  className="min-h-11 self-end"
                  isDisabled={!current || !next || changePassword.isPending}
                >
                  {t('account.changePassword')}
                </Button>
              </form>
            </SettingRow>
          </section>

          <section id="sesiones" className="flex flex-col gap-6 scroll-mt-16 lg:scroll-mt-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionTitle eyebrow={t('account.navSessions')} title={t('account.sessionsTitle')} />
              <Button
                variant="outline"
                className="min-h-11"
                isDisabled={revokeOthers.isPending || (sessions.data?.length ?? 0) < 2}
                onPress={() => revokeOthers.mutate()}
              >
                {t('account.revokeOthers')}
              </Button>
            </div>
            {sessions.isLoading ? (
              <Spinner aria-label={t('common.loading')} />
            ) : sessions.isError ? (
              <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
            ) : (
              <ul className="flex flex-col border-b border-border">
                {sessions.data?.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    isRevoking={revoke.isPending}
                    onRevoke={() => revoke.mutate(session.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section id="cuenta" className="flex flex-col gap-6 scroll-mt-16 lg:scroll-mt-10">
            <SectionTitle eyebrow={t('account.navAccount')} title={t('account.accountTitle')} />
            <div className="flex flex-col gap-4">
              <SettingRow label={t('nav.logout')} description={t('account.logoutHint')} className="border-b border-border">
                <Button
                  variant="outline"
                  className="min-h-11"
                  onPress={() => {
                    void navigate(to('/'))
                    void logout()
                  }}
                >
                  {t('nav.logout')}
                </Button>
              </SettingRow>
              <div className="grid gap-4 rounded-3xl p-6 ring-1 ring-danger/40 lg:grid-cols-2 lg:items-start lg:gap-8">
                <div className="flex flex-col gap-1">
                  <span className="text-base font-medium text-danger">{t('account.danger')}</span>
                  <span className="text-sm text-muted text-pretty">{t('account.dangerBody')}</span>
                  {deleteError ? (
                    <p className="mt-2 text-sm text-danger" role="alert">
                      {deleteError}
                    </p>
                  ) : null}
                </div>
                <div className="flex lg:justify-end">
                  <Button
                    variant="danger-soft"
                    className="min-h-11"
                    isDisabled={requestDeletion.isPending}
                    onPress={() => {
                      setDeleteError(null)
                      requestDeletion.mutate()
                    }}
                  >
                    {t('account.dangerAction')}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

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

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
    </div>
  )
}

function SessionRow({
  session,
  isRevoking,
  onRevoke,
}: {
  session: DeviceSession
  isRevoking: boolean
  onRevoke: () => void
}) {
  const { t } = useTranslation()
  const device = parseUserAgent(session.user_agent)
  const label =
    device.browser && device.platform
      ? t('account.deviceOn', { browser: device.browser, platform: device.platform })
      : (device.browser ?? device.platform ?? t('account.deviceUnknown'))

  return (
    <li className="flex items-center justify-between gap-4 border-t border-border py-4">
      <div className="flex min-w-0 items-center gap-4">
        <span className="shrink-0 text-muted" aria-hidden="true">
          {device.mobile ? <PhoneIcon /> : <ScreenIcon />}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="truncate text-base font-medium" title={session.user_agent ?? undefined}>
              {label}
            </span>
            {session.current ? <span className="eyebrow text-accent-text">{t('account.sessionCurrent')}</span> : null}
          </span>
          <span className="eyebrow">{t('account.sessionStarted', { date: formatDateTime(session.created_at) })}</span>
        </div>
      </div>
      {session.current ? null : (
        <Button variant="outline" className="min-h-10 shrink-0" isDisabled={isRevoking} onPress={onRevoke}>
          {t('account.revoke')}
        </Button>
      )}
    </li>
  )
}

function ScreenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  )
}
