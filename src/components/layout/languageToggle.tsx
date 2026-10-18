import { Dropdown } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { dropdownTriggerClass } from '@/components/common/dropdownTrigger'
import { isLanguage, LANGUAGE_INFO, LANGUAGES } from '@/i18n/languages'
import { swapLang } from '@/lib/paths'

export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={t('language.toggle')}
        className={dropdownTriggerClass({ variant: 'ghost', isIconOnly: true }, 'size-11')}
      >
        <GlobeIcon />
      </Dropdown.Trigger>
      <Dropdown.Popover>
        <Dropdown.Menu
          selectionMode="single"
          selectedKeys={[i18n.language]}
          onSelectionChange={(keys) => {
            const next = [...keys][0]
            if (isLanguage(String(next)) && next !== i18n.language) {
              void navigate(
                { pathname: swapLang(location.pathname, String(next)), search: location.search },
                { replace: true },
              )
            }
          }}
        >
          {LANGUAGES.map((lang) => (
            <Dropdown.Item key={lang} id={lang} textValue={LANGUAGE_INFO[lang].name}>
              <Dropdown.ItemIndicator />
              {LANGUAGE_INFO[lang].name}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.3" />
      <path d="M1.7 8h12.6M8 1.7c1.9 1.9 2.8 4 2.8 6.3S9.9 12.4 8 14.3M8 1.7C6.1 3.6 5.2 5.7 5.2 8s.9 4.4 2.8 6.3" />
    </svg>
  )
}
