import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { ProfileCell } from '@/components/landing/profileCell'
import { Reveal } from '@/components/landing/reveal'
import { ScoreCard } from '@/components/route/scoreCard'
import { formatDistance, formatSigned } from '@/lib/format'
import { useLangPath } from '@/lib/paths'
import { LANDING_EXAMPLES } from '@/components/landing/landingExamples'
import { LanguageToggle } from './languageToggle'
import { VelioLogo } from './logo'
import { ThemeToggle } from './themeToggle'

type Props = {
  eyebrow: string
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

const SIERRA = LANDING_EXAMPLES[1]

export function AuthLayout({ eyebrow, title, subtitle, children, footer }: Props) {
  const { t } = useTranslation()
  const to = useLangPath()

  return (
    <div className="flex min-h-full bg-background text-foreground [--field-background:var(--surface)]">
      <div className="flex w-full flex-col px-4 py-5 sm:px-10 lg:w-1/2">
        <div className="flex items-center justify-between gap-4">
          <Link to={to('/')} aria-label="Velio" className="inline-flex min-h-11 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <VelioLogo height={26} />
          </Link>
          {footer ? <span className="hidden text-sm text-muted lg:inline">{footer}</span> : null}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-4">
          <div className="w-full max-w-[400px]">
            <span className="eyebrow">{eyebrow}</span>
            <h1 className="text-hero mt-3 text-4xl font-semibold leading-none tracking-[-0.03em] text-balance">
              {title}
            </h1>
            {subtitle ? <p className="mt-3 text-base text-muted text-pretty">{subtitle}</p> : null}
            <div className="mt-8">{children}</div>
            {footer ? (
              <p className="mt-8 border-t border-border pt-5 text-sm text-muted lg:hidden [&_a]:-my-3 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center">
                {footer}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      <div className="hidden p-4 ps-0 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-1/2">
        <div className="flex size-full flex-col overflow-hidden rounded-3xl bg-accent p-12 text-accent-foreground">
          <h2 className="max-w-[680px] text-4xl font-semibold tracking-tight text-balance">{t('auth.panelTitle')}</h2>
          <p className="mt-4 max-w-[520px] text-lg text-pretty opacity-90">{t('auth.panelBody')}</p>

          <div className="flex flex-1 flex-col justify-center py-10">
            <Reveal>
              <div className="w-[88%] -rotate-1 rounded-2xl bg-surface p-6 text-foreground shadow-raised">
                <div className="mb-3 flex items-baseline justify-between gap-4">
                  <span className="font-semibold">{SIERRA.place}</span>
                  <span className="tnum text-sm text-muted">
                    {formatDistance(SIERRA.result.distance_km)} · {formatSigned(SIERRA.result.gain_m)}
                  </span>
                </div>
                <ProfileCell height={190} />
              </div>
            </Reveal>
            <Reveal delay={150} className="-mt-12 ms-auto w-[64%]">
              <div className="rotate-2 rounded-2xl bg-surface p-6 text-foreground shadow-raised">
                <ScoreCard score={SIERRA.result.cycling_score} hideElevation />
              </div>
            </Reveal>
          </div>
          <p className="text-sm opacity-80">{t('auth.panelCaption')}</p>
        </div>
      </div>
    </div>
  )
}
