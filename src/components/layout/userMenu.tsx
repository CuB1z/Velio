import { Avatar, Dropdown } from '@heroui/react'

import { dropdownTriggerClass } from '@/components/common/dropdownTrigger'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/useAuth'
import i18n, { LANGUAGES } from '@/i18n'
import { cn } from '@/lib/cn'

export function UserMenu() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const onAccount = useLocation().pathname.startsWith('/account')

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
      <Dropdown.Popover>
        <Dropdown.Menu
          onAction={(key) => {
            if (key === 'account') void navigate('/account')
            else if (key === 'logout') {
              void navigate('/')
              void logout()
            }
            else if (typeof key === 'string' && key.startsWith('lang:')) {
              void i18n.changeLanguage(key.slice(5))
            }
          }}
        >
          <Dropdown.Section>
            <Dropdown.Item id="account">{t('nav.account')}</Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Section>
            {LANGUAGES.map((language) => (
              <Dropdown.Item key={language} id={`lang:${language}`}>
                {language === 'es' ? 'Español' : 'English'}
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
          <Dropdown.Section>
            {/* Red: the only menu action a click cannot undo. */}
            <Dropdown.Item id="logout" variant="danger">
              {t('nav.logout')}
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
