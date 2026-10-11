import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAuth } from '@/auth/useAuth'
import { Bento, BentoCell, BentoLabel } from '@/components/landing/bento'
import { CountUp } from '@/components/landing/countUp'
import { Faq } from '@/components/landing/faq'
import { HeroStage } from '@/components/landing/heroStage'
import { Reveal } from '@/components/landing/reveal'
import { TaglineReveal } from '@/components/landing/taglineReveal'
import { VelioLogo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/themeToggle'
import { formatDistance, formatRatio } from '@/lib/format'
import { LANDING_REPAIR } from './landingExamples'

const STATS = [
  { value: 30, decimals: 0, suffix: ' m', label: 'landing.statDem' },
  { value: 0.62, decimals: 2, suffix: ' m', label: 'landing.statError' },
  { value: 74, decimals: 0, suffix: ' km', label: 'landing.statValidated' },
  { value: 7.0, decimals: 1, suffix: '', label: 'landing.statScore' },
]

const DATA_SOURCES = [
  { key: 'Osm', label: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
  {
    key: 'Dem',
    label: 'Copernicus DEM GLO-30',
    href: 'https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM',
  },
  { key: 'Pnoa', label: 'PNOA · IGN', href: 'https://pnoa.ign.es/' },
]

const BIKES = ['road', 'city', 'gravel', 'mtb'] as const
const STEPS = [1, 2, 3] as const

const fluid = 'transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]'
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2'
const pill = `inline-flex min-h-12 items-center justify-center rounded-full px-6 text-base font-semibold ${fluid} ${focus}`
const sectionTitle = 'text-4xl font-semibold tracking-tight text-balance sm:text-5xl'
const footerLink = 'inline-flex min-h-10 items-center text-sm text-muted transition-colors duration-150 hover:text-foreground'

export function LandingPage() {
  const { t } = useTranslation()
  const { status } = useAuth()
  const authenticated = status === 'authenticated'
  const primary = { to: authenticated ? '/loops' : '/register', label: t(authenticated ? 'landing.openApp' : 'landing.heroCta') }

  const anchors = [
    { href: '#como-funciona', label: t('landing.navHow') },
    { href: '#funciones', label: t('landing.navFeatures') },
    { href: '#datos', label: t('landing.navData') },
    { href: '#preguntas', label: t('landing.navFaq') },
  ]

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="sticky top-0 z-30 px-4 pt-4 sm:pt-6">
        <div className="mx-auto flex items-center gap-2 rounded-full bg-surface/80 p-2 ps-5 shadow-card ring-1 ring-border backdrop-blur-xl md:w-max">
          <Link to="/" aria-label="Velio" className={`flex items-center rounded-md ${focus} focus-visible:outline-accent`}>
            <VelioLogo height={22} decorative />
          </Link>

          <nav className="ms-6 hidden items-center md:flex">
            {anchors.map((anchor) => (
              <a
                key={anchor.href}
                href={anchor.href}
                className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium text-muted transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground"
              >
                {anchor.label}
              </a>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-1 md:ms-6">
            <ThemeToggle />
            {authenticated ? null : (
              <Link
                to="/login"
                className="hidden min-h-10 items-center rounded-full px-3 text-sm font-semibold transition-colors duration-150 hover:bg-surface-secondary sm:inline-flex"
              >
                {t('landing.signIn')}
              </Link>
            )}
            <Link
              to={primary.to}
              className={`inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-90 ${fluid} ${focus} focus-visible:outline-accent`}
            >
              {authenticated ? t('landing.openApp') : t('landing.getStarted')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="px-4 pt-20 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-[680px] text-center">
            <h1 className="text-hero text-4xl font-semibold tracking-tight whitespace-pre-line text-balance sm:text-5xl">
              {t('landing.heroTitle')}
            </h1>
            <p className="mt-6 text-lg text-muted text-pretty sm:text-xl">{t('landing.heroBody')}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to={primary.to} className={`${pill} bg-accent text-accent-foreground hover:opacity-90 focus-visible:outline-accent`}>
                {primary.label}
              </Link>
              <a href="#como-funciona" className={`${pill} text-accent hover:bg-accent-soft focus-visible:outline-accent`}>
                {t('landing.heroSecondary')}
              </a>
            </div>
            <p className="mt-6 text-sm text-muted">{t('landing.heroNote')}</p>
          </div>

          <Reveal className="mx-auto mt-16 max-w-6xl sm:mt-20">
            <HeroStage />
          </Reveal>
        </section>

        <section className="px-4 py-24 sm:px-6 lg:py-32">
          <TaglineReveal
            text={t('landing.tagline')}
            className="mx-auto max-w-[680px] text-4xl font-semibold tracking-tight sm:text-5xl"
          />
        </section>

        <section id="funciones" className="bg-surface-secondary px-4 py-24 sm:px-6 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-[680px]">
              <h2 className={sectionTitle}>{t('landing.benefitsTitle')}</h2>
              <p className="mt-4 text-lg text-muted text-pretty">{t('landing.benefitsBody')}</p>
            </Reveal>

            <Reveal className="mt-12">
              <Bento>
                <BentoCell span={7} className="flex flex-col gap-6 p-8">
                  <BentoLabel title={t('landing.bikesTitle')} body={t('landing.bikesBody')} />
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {BIKES.map((bike) => (
                      <li key={bike} className="rounded-xl bg-surface-secondary p-4">
                        <p className="font-semibold">{t(`bike.${bike}`)}</p>
                        <p className="mt-1 text-sm text-muted text-pretty">{t(`bike.${bike}Hint`)}</p>
                      </li>
                    ))}
                  </ul>
                </BentoCell>

                <BentoCell span={5} tone="ink" className="flex flex-col justify-between gap-8 p-8">
                  <BentoLabel title={t('landing.repairTitle')} body={t('landing.repairBody')} tone="ink" />
                  <div>
                    <p className="tnum flex items-baseline gap-3 text-5xl font-semibold tracking-tight">
                      <span className="text-ink-muted line-through decoration-2">
                        {formatRatio(LANDING_REPAIR.before.overlap, 0)}
                      </span>
                      <span aria-hidden="true" className="text-3xl text-ink-muted">
                        →
                      </span>
                      <span className="text-ink-accent">{formatRatio(LANDING_REPAIR.after.overlap, 0)}</span>
                    </p>
                    <p className="mt-3 text-sm text-ink-muted text-pretty">
                      {t('landing.repairFigure', { distance: formatDistance(LANDING_REPAIR.before.distance_km) })}
                    </p>
                  </div>
                </BentoCell>

                <BentoCell span={5} tone="accent" className="flex flex-col justify-between gap-8 p-8">
                  <h3 className="text-lg font-semibold tracking-tight">{t('landing.accuracyTitle')}</h3>
                  <div>
                    <p className="text-5xl font-semibold tracking-tight">
                      <CountUp value={0.62} decimals={2} suffix=" m" />
                    </p>
                    <p className="mt-3 text-pretty opacity-90">{t('landing.accuracyBody')}</p>
                  </div>
                </BentoCell>

                <BentoCell span={7} className="flex flex-col justify-between gap-8 p-8">
                  <BentoLabel title={t('landing.exportTitle')} body={t('landing.exportBody')} />
                  <div className="flex flex-wrap gap-2">
                    {['GPX', 'GeoJSON'].map((format) => (
                      <span key={format} className="rounded-full bg-accent-soft px-4 py-2 text-sm font-semibold text-accent">
                        {format}
                      </span>
                    ))}
                  </div>
                </BentoCell>
              </Bento>
            </Reveal>
          </div>
        </section>

        <section id="como-funciona" className="px-4 py-24 sm:px-6 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-[680px]">
              <h2 className={sectionTitle}>{t('landing.stepsTitle')}</h2>
            </Reveal>
            <ol className="mt-12 grid gap-4 lg:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step}>
                  <Reveal delay={index * 100} className="h-full">
                    <div className="flex h-full flex-col gap-4 rounded-2xl bg-surface p-8 shadow-card">
                      <span className="flex size-10 items-center justify-center rounded-full bg-accent text-base font-semibold text-accent-foreground">
                        {step}
                      </span>
                      <h3 className="text-xl font-semibold tracking-tight text-balance">{t(`landing.step${step}Title`)}</h3>
                      <p className="text-muted text-pretty">{t(`landing.step${step}Body`)}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="datos" className="bg-ink px-4 py-24 text-white sm:px-6 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-[680px]">
              <h2 className={sectionTitle}>{t('landing.dataTitle')}</h2>
              <p className="mt-4 text-lg text-ink-muted text-pretty">{t('landing.dataBody')}</p>
            </Reveal>

            <Reveal>
              <dl className="mt-12 grid gap-8 border-y border-white/10 py-10 sm:grid-cols-2 lg:grid-cols-4">
                {STATS.map((stat) => (
                  <div key={stat.label} className="flex flex-col-reverse gap-2">
                    <dt className="text-sm text-ink-muted">{t(stat.label)}</dt>
                    <dd className="text-5xl font-semibold tracking-tight">
                      <CountUp value={stat.value} decimals={stat.decimals} suffix={stat.suffix} />
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal>
              <ul className="mt-12 grid gap-8 sm:grid-cols-3">
                {DATA_SOURCES.map((source) => (
                  <li key={source.key}>
                    <a
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-ink-accent underline-offset-4 hover:underline"
                    >
                      {source.label}
                    </a>
                    <p className="mt-2 text-ink-muted text-pretty">{t(`landing.data${source.key}Body`)}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        <section id="preguntas" className="px-4 py-24 sm:px-6 lg:py-32">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)] lg:gap-16">
            <Reveal>
              <h2 className={sectionTitle}>{t('landing.faqTitle')}</h2>
            </Reveal>
            <Reveal delay={100}>
              <Faq />
            </Reveal>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6 lg:pb-32">
          <Reveal className="mx-auto max-w-6xl">
            <div className="rounded-3xl bg-accent px-6 py-16 text-center text-accent-foreground sm:px-12 lg:py-24">
              <h2 className={`mx-auto max-w-[680px] ${sectionTitle}`}>{t('landing.ctaTitle')}</h2>
              <p className="mx-auto mt-4 max-w-[560px] text-lg text-pretty opacity-90">{t('landing.ctaBody')}</p>
              <div className="mt-8 flex justify-center">
                <Link
                  to={primary.to}
                  className={`${pill} bg-accent-foreground text-accent hover:opacity-90 focus-visible:outline-accent-foreground`}
                >
                  {primary.label}
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-separator bg-surface-secondary">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="flex flex-col items-start gap-4">
            <Link to="/" aria-label="Velio">
              <VelioLogo height={24} decorative />
            </Link>
            <p className="max-w-xs text-sm text-muted">{t('landing.footerRights')}</p>
          </div>

          <FooterColumn title={t('landing.footerProduct')}>
            {anchors.map((anchor) => (
              <a key={anchor.href} href={anchor.href} className={footerLink}>
                {anchor.label}
              </a>
            ))}
          </FooterColumn>

          <FooterColumn title={t('landing.footerApp')}>
            {(
              [
                ['/loops', 'nav.loops'],
                ['/routes', 'nav.routes'],
                ['/analyze', 'nav.analyze'],
                ['/saved', 'nav.saved'],
              ] as const
            ).map(([to, label]) => (
              <Link key={to} to={to} className={footerLink}>
                {t(label)}
              </Link>
            ))}
          </FooterColumn>

          <FooterColumn title={t('landing.footerData')}>
            {DATA_SOURCES.map((source) => (
              <a key={source.href} href={source.href} target="_blank" rel="noreferrer" className={footerLink}>
                {source.label}
              </a>
            ))}
          </FooterColumn>
        </div>

        <div className="border-t border-separator">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 text-sm text-muted sm:px-6">
            <span>© {new Date().getFullYear()} Velio</span>
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </div>
  )
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title} className="flex flex-col items-start">
      <h2 className="mb-2 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </nav>
  )
}
