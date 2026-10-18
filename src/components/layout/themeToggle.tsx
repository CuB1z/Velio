import { Dropdown } from '@heroui/react'

import { dropdownTriggerClass } from '@/components/common/dropdownTrigger'
import { useTranslation } from 'react-i18next'

import { useTheme, type ThemePreference } from '@/hooks/useTheme'

export function ThemeToggle() {
  const { t } = useTranslation()
  const { preference, resolved, setPreference } = useTheme()

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={t('theme.toggle')}
        className={dropdownTriggerClass({ variant: 'ghost', isIconOnly: true }, 'size-11 bg-surface-secondary hover:bg-surface-hover')}
      >
        {resolved === 'dark' ? <MoonIcon /> : <SunIcon />}
      </Dropdown.Trigger>
      <Dropdown.Popover>
        <Dropdown.Menu
          selectionMode="single"
          selectedKeys={[preference]}
          onSelectionChange={(keys) => {
            const next = [...keys][0]
            if (next === 'light' || next === 'dark' || next === 'system') {
              setPreference(next as ThemePreference)
            }
          }}
        >
          <Dropdown.Item id="light" textValue={t('theme.light')}>
            <Dropdown.ItemIndicator />
            {t('theme.light')}
          </Dropdown.Item>
          <Dropdown.Item id="dark" textValue={t('theme.dark')}>
            <Dropdown.ItemIndicator />
            {t('theme.dark')}
          </Dropdown.Item>
          <Dropdown.Item id="system" textValue={t('theme.system')}>
            <Dropdown.ItemIndicator />
            {t('theme.system')}
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" />
    </svg>
  )
}
