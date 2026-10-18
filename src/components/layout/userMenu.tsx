import { Avatar, Dropdown } from '@heroui/react'
import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/useAuth'
import { dropdownTriggerClass } from '@/components/common/dropdownTrigger'
import { useTheme, type ThemePreference } from '@/hooks/useTheme'
import { cn } from '@/lib/cn'
import { useLangPath } from '@/lib/paths'

const THEMES: ThemePreference[] = ['light', 'dark', 'system']

export function UserMenu() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { preference, setPreference } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const to = useLangPath()
  const onAccount = location.pathname === to('/account')

  const initials = (user?.full_name || user?.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={t('nav.account')}
        className={dropdownTriggerClass({ variant: 'ghost', isIconOnly: true }, 'size-11')}
      >
        <Avatar
          className={cn(
            'size-8 bg-accent-soft',
            onAccount && 'ring-2 ring-accent ring-offset-2 ring-offset-background',
          )}
        >
          <Avatar.Fallback className="code text-xs font-semibold text-accent-soft-foreground">
            {initials}
          </Avatar.Fallback>
        </Avatar>
      </Dropdown.Trigger>
      <Dropdown.Popover className="w-64 p-1.5">
        <div className="mb-1.5 flex items-center gap-3 border-b border-border px-2.5 pb-2.5 pt-1.5">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{user?.full_name || user?.email}</span>
          <div role="group" aria-label={t('account.theme')} className="flex shrink-0 gap-0.5 rounded-full bg-surface-secondary p-0.5">
            {THEMES.map((id) => (
              <button
                key={id}
                type="button"
                aria-label={t(`theme.${id}`)}
                aria-pressed={preference === id}
                title={t(`theme.${id}`)}
                onClick={() => setPreference(id)}
                className={cn(
                  'flex size-8 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  preference === id ? 'bg-foreground text-background' : 'text-muted hover:text-foreground',
                )}
              >
                {THEME_ICON[id]}
              </button>
            ))}
          </div>
        </div>
        <Dropdown.Menu
          className="p-0"
          onAction={(key) => {
            if (key === 'account') void navigate(to('/account'))
            else if (key === 'logout') {
              void navigate(to('/'))
              void logout()
            }
          }}
        >
          <Dropdown.Section>
            <Dropdown.Item id="account" className="px-2.5">
              <SlidersIcon />
              {t('nav.account')}
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Section className="mt-1.5 border-t border-border pt-1.5">
            <Dropdown.Item id="logout" className="px-2.5 text-danger">
              <LogoutIcon />
              {t('nav.logout')}
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

const ICON = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

const THEME_ICON: Record<ThemePreference, JSX.Element> = {
  light: (
    <svg {...ICON}>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1" />
    </svg>
  ),
  dark: (
    <svg {...ICON}>
      <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" />
    </svg>
  ),
  system: (
    <svg {...ICON}>
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" />
      <path d="M5.5 14h5M8 11.5V14" />
    </svg>
  ),
}

function SlidersIcon() {
  return (
    <svg {...ICON}>
      <path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" />
      <circle cx="10" cy="4.5" r="1.5" />
      <circle cx="6" cy="11.5" r="1.5" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg {...ICON}>
      <path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6M10 11l3-3-3-3M13 8H6.5" />
    </svg>
  )
}
