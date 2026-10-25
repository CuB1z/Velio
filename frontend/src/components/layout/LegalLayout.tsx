import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useDocumentHead } from '@/hooks/useDocumentHead'
import { DEFAULT_LANGUAGE, isLanguage, LANGUAGE_INFO, LANGUAGES, type Language } from '@/i18n/languages'
import { formatDate } from '@/lib/format'
import { useLangPath, withLang } from '@/lib/paths'
import { SITE } from '@/lib/site'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

export type LegalDocument = {
  path: string
  updated: string
  content: Record<Language, { title: string; description: string; body: ReactNode }>
}

const prose = [
  'mt-10 border-t border-border pt-2 text-base leading-7 text-pretty',
  '[&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-balance',
  '[&_p]:mt-4 [&_ul]:mt-4 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-3 [&_ul]:ps-5 [&_li]:ps-1',
  '[&_a]:font-medium [&_a]:underline [&_a]:decoration-muted [&_a]:underline-offset-4 [&_a:hover]:decoration-foreground',
].join(' ')

export function LegalLayout({ doc }: { doc: LegalDocument }) {
  const { t, i18n } = useTranslation()
  const language = isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE
  const { title, description, body } = doc.content[language]
  const origin = window.location.origin
  const url = (lang: Language) => origin + withLang(doc.path, lang)

  useDocumentHead({
    title: `${title} · Velio`,
    description,
    canonical: url(language),
    alternates: { ...Object.fromEntries(LANGUAGES.map((lang) => [lang, url(lang)])), 'x-default': url(DEFAULT_LANGUAGE) },
    social: {
      title: `${title} · Velio`,
      description,
      url: url(language),
      image: `${origin}/og-${language}.png`,
      imageAlt: t('landing.ogImageAlt'),
      locale: LANGUAGE_INFO[language].locale.replace('-', '_'),
    },
  })

  return (
    <div className="min-h-full overflow-x-clip bg-background text-foreground">
      <SiteHeader />
      <main className="px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:pb-32">
        <article className="mx-auto max-w-[720px]">
          <span className="eyebrow">{t('legal.eyebrow')}</span>
          <h1 className="text-hero mt-4 text-4xl font-semibold leading-none tracking-[-0.03em] text-balance sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-sm text-muted">{t('legal.updated', { date: formatDate(doc.updated) })}</p>
          <div className={prose}>{body}</div>
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}

export function Mail() {
  return <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
}

export function DocLink({ to, children }: { to: string; children: ReactNode }) {
  const localize = useLangPath()
  return (
    <Link to={localize(to)} onClick={() => window.scrollTo({ top: 0 })}>
      {children}
    </Link>
  )
}

export function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}
