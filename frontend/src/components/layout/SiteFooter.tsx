import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { focus } from '@/components/common/interaction'
import { useLangPath } from '@/lib/paths'
import { SITE } from '@/lib/site'
import { LanguageToggle } from './LanguageToggle'
import { VelioLogo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

export function SiteFooter() {
  const { t } = useTranslation()
  const to = useLangPath()
  const links = [
    { href: to('/privacy'), label: t('legal.privacy') },
    { href: to('/terms'), label: t('legal.terms') },
    { href: SITE.repoUrl, label: 'GitHub' },
    { href: SITE.authorUrl, label: t('legal.author') },
  ]

  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex items-center justify-between gap-4">
          <Link
            to={to('/')}
            onClick={() => window.scrollTo({ top: 0 })}
            aria-label="Velio"
            className={`inline-flex min-h-11 items-center rounded-md ${focus}`}
          >
            <VelioLogo height={24} decorative />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
        <nav aria-label={t('legal.nav')} className="mt-6 flex flex-wrap items-center justify-center gap-x-3 text-sm text-muted">
          {links.map((link, index) => (
            <Fragment key={link.href}>
              {index > 0 ? <span aria-hidden="true">·</span> : null}
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex min-h-11 items-center rounded-md transition-colors duration-150 hover:text-foreground ${focus}`}
              >
                {link.label}
              </a>
            </Fragment>
          ))}
        </nav>
      </div>
    </footer>
  )
}
