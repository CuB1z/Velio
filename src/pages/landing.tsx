import { useOverlayState } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAuth } from '@/auth/useAuth'
import { SegmentedControl } from '@/components/common/segmentedControl'
import { RequestCountryDialog } from '@/components/coverage/requestCountryDialog'
import { Bento, BentoCell, BentoLabel } from '@/components/landing/bento'
import { CountUp } from '@/components/landing/countUp'
import { Faq } from '@/components/landing/faq'
import { Reveal } from '@/components/landing/reveal'
import { Ridge } from '@/components/landing/ridge'
import { Showcase } from '@/components/landing/showcase'
import { TaglineReveal } from '@/components/landing/taglineReveal'
import { VelioLogo } from '@/components/layout/logo'
import { LanguageToggle } from '@/components/layout/languageToggle'
import { ThemeToggle } from '@/components/layout/themeToggle'
import { useDocumentHead } from '@/hooks/useDocumentHead'
import { DEFAULT_LANGUAGE, LANGUAGES } from '@/i18n/languages'
import { SurfaceBar } from '@/components/route/surfaceBar'
import { formatDistance, formatRatio } from '@/lib/format'
import { useLangPath, withLang } from '@/lib/paths'
import { LANDING_EXAMPLES, LANDING_REPAIR } from './landingExamples'

const SIERRA = LANDING_EXAMPLES[1]
const ALGETE = LANDING_EXAMPLES[2]

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
]

const BIKES = ['road', 'city', 'gravel', 'mtb'] as const
const STEPS = [1, 2, 3] as const
const DEVICES = ['Garmin Edge', 'Wahoo Elemnt', 'Komoot']

const fluid = 'transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]'
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const pill = `inline-flex min-h-12 items-center justify-center rounded-full px-7 text-base font-semibold ${fluid} ${focus}`
const primaryPill = `${pill} bg-accent text-accent-foreground hover:opacity-90`
const sectionTitle = 'text-4xl font-semibold leading-none tracking-[-0.03em] text-balance sm:text-5xl'

export function LandingPage() {
  const { t, i18n } = useTranslation()
  const { status } = useAuth()
  const to = useLangPath()
  const askDialog = useOverlayState()
  const [bike, setBike] = useState<(typeof BIKES)[number]>('road')
  const origin = window.location.origin
  const scrollToTop = () => window.scrollTo({ top: 0 })
  useDocumentHead({
    description: t('landing.metaDescription'),
    canonical: origin + withLang('/', i18n.language),
    alternates: {
      ...Object.fromEntries(LANGUAGES.map((lang) => [lang, origin + withLang('/', lang)])),
      'x-default': origin + withLang('/', DEFAULT_LANGUAGE),
    },
  })
  const authenticated = status === 'authenticated'
  const primary = { to: authenticated ? '/loops' : '/register', label: t(authenticated ? 'landing.openApp' : 'landing.heroCta') }

  const ids = {
    product: t('landing.anchorProduct'),
    features: t('landing.anchorFeatures'),
    how: t('landing.anchorHow'),
    data: t('landing.anchorData'),
    faq: t('landing.anchorFaq'),
  }
  const anchors = [
    { href: `#${ids.features}`, label: t('landing.navFeatures') },
    { href: `#${ids.how}`, label: t('landing.navHow') },
    { href: `#${ids.data}`, label: t('landing.navData') },
    { href: `#${ids.faq}`, label: t('landing.navFaq') },
  ]

  return (
    <div className="min-h-full overflow-x-clip bg-background text-foreground [&_.code]:font-sans! [&_.eyebrow]:font-sans [&_.eyebrow]:font-medium">
      <header className="sticky top-0 z-30 px-4 pt-4 sm:pt-6">
        <div className="mx-auto flex items-center gap-2 rounded-full bg-surface-secondary/75 p-2 ps-5 ring-1 ring-border backdrop-blur-xl md:w-max">
          <Link to={to('/')} onClick={scrollToTop} aria-label="Velio" className={`flex min-h-11 items-center rounded-md ${focus}`}>
            <VelioLogo height={20} decorative />
          </Link>

          <nav className="ms-6 hidden items-center md:flex">
            {anchors.map((anchor) => (
              <a
                key={anchor.href}
                href={anchor.href}
                className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground"
              >
                {anchor.label}
              </a>
            ))}
          </nav>

          <div className="ms-auto flex items-center md:ms-6">
            <Link
              to={to(primary.to)}
              className={`inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-90 ${fluid} ${focus}`}
            >
              {authenticated ? t('landing.openApp') : t('landing.getStarted')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="px-4 pt-14 sm:px-6 sm:pt-20">
          <div className="mx-auto flex max-w-[860px] flex-col items-center gap-6 text-center">
            <span className="eyebrow">{t('landing.heroEyebrow')}</span>
            <h1 className="text-hero text-4xl font-semibold leading-[1] tracking-[-0.03em] text-balance sm:text-5xl sm:whitespace-pre-line lg:text-6xl">
              {t('landing.heroTitle')}
            </h1>
            <p className="max-w-[560px] text-lg text-muted text-pretty">{t('landing.heroBody')}</p>
            <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
              <Link to={to(primary.to)} className={primaryPill}>
                {primary.label}
              </Link>
              <a href={`#${ids.product}`} className={`inline-flex min-h-11 items-center gap-2 text-base font-medium ${focus} rounded-md`}>
                {t('landing.heroSecondary')}
                <ArrowIcon />
              </a>
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-[1400px] sm:mt-16">
            <Ridge example={SIERRA} />
          </div>
        </section>

        <section className="px-4 py-24 sm:px-6 lg:py-40">
          <TaglineReveal
            text={t('landing.tagline')}
            className="mx-auto max-w-[1040px] text-4xl font-medium leading-[1.04] tracking-[-0.03em] sm:text-6xl"
          />
        </section>

        <section id={ids.product} className="px-4 pb-24 sm:px-6 lg:pb-40">
          <div className="mx-auto max-w-6xl">
            <Reveal className="flex max-w-[720px] flex-col gap-4">
              <span className="eyebrow">{t('landing.showcaseEyebrow')}</span>
              <h2 className={sectionTitle}>{t('landing.benefitsBody')}</h2>
            </Reveal>
            <Reveal className="mt-12">
              <Showcase example={SIERRA} />
            </Reveal>
          </div>
        </section>

        <section id={ids.features} className="px-4 pb-24 sm:px-6 lg:pb-40">
          <div className="mx-auto max-w-6xl">
            <Reveal className="flex max-w-[720px] flex-col gap-4">
              <span className="eyebrow">{t('landing.benefitsTitle')}</span>
              <h2 className={sectionTitle}>{t('landing.benefitsHeadline')}</h2>
            </Reveal>

            <Reveal className="mt-12">
              <Bento>
                <BentoCell span={8} glow>
                  <div className="relative flex flex-col gap-6">
                    <SegmentedControl
                      label={t('bike.label')}
                      options={BIKES.map((id) => ({ id, label: t(`bike.${id}`) }))}
                      value={bike}
                      onChange={setBike}
                      className="max-w-[560px] [&>button]:px-2 [&>button]:text-xs sm:[&>button]:px-3 sm:[&>button]:text-sm"
                    />
                    <ul className="grid gap-x-6 gap-y-3 text-sm text-muted sm:grid-cols-2">
                      {BIKES.map((id) => (
                        <li
                          key={id}
                          className={`transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${id === bike ? 'opacity-100' : 'opacity-40'}`}
                        >
                          <span className="font-medium text-foreground">{t(`bike.${id}`)}.</span>{' '}
                          {t(`bike.${id}Hint`)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <BentoLabel eyebrow={t('bike.label')} title={t('landing.bikesTitle')} body={t('landing.bikesBody')} />
                </BentoCell>

                <BentoCell span={4}>
                  <p className="code flex items-center gap-4 pt-6 text-5xl font-medium tracking-[-0.04em]">
                    <span className="text-muted line-through">{formatRatio(LANDING_REPAIR.before.overlap, 0)}</span>
                    <ArrowIcon className="text-muted" />
                    <span className="text-accent-text">{formatRatio(LANDING_REPAIR.after.overlap, 0)}</span>
                  </p>
                  <div className="flex flex-col gap-3">
                    <BentoLabel eyebrow={t('landing.repairEyebrow')} title={t('landing.repairTitle')} body={t('landing.repairBody')} />
                    <p className="text-sm text-muted text-pretty">
                      {t('landing.repairFigure', { distance: formatDistance(LANDING_REPAIR.before.distance_km) })}
                    </p>
                  </div>
                </BentoCell>

                <BentoCell span={4}>
                  <div className="flex flex-col gap-3 pt-6">
                    <p className="code text-6xl font-medium tracking-[-0.04em]">
                      <CountUp value={0.62} decimals={2} suffix=" m" />
                    </p>
                    <span className="eyebrow">{t('landing.accuracyUnit')}</span>
                  </div>
                  <BentoLabel eyebrow={t('landing.accuracyEyebrow')} title={t('landing.accuracyTitle')} body={t('landing.accuracyBody')} />
                </BentoCell>

                <BentoCell span={4}>
                  <SurfaceBar score={ALGETE.result.score} distanceKm={ALGETE.result.distance_km} className="pt-2" />
                  <BentoLabel eyebrow={t('metric.surface')} title={t('landing.surfaceTitle')} body={t('landing.surfaceBody')} />
                </BentoCell>

                <BentoCell span={4}>
                  <div className="flex flex-col gap-4 pt-2">
                    <div className="flex flex-wrap gap-2">
                      {['GPX', 'GeoJSON'].map((format) => (
                        <span key={format} className="rounded-full bg-accent-soft px-4 py-2 text-sm font-semibold text-accent-soft-foreground">
                          {format}
                        </span>
                      ))}
                    </div>
                    <ul className="code flex flex-col gap-1.5 text-xs text-muted">
                      {DEVICES.map((device) => (
                        <li key={device} className="flex justify-between gap-4">
                          <span className="text-foreground">{device}</span>
                          <span>{t('landing.compatible')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <BentoLabel eyebrow={t('landing.exportEyebrow')} title={t('landing.exportTitle')} body={t('landing.exportBody')} />
                </BentoCell>
              </Bento>
            </Reveal>
          </div>
        </section>

        <section id={ids.how} className="px-4 pb-24 sm:px-6 lg:pb-40">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-[720px]">
              <h2 className={sectionTitle}>{t('landing.stepsTitle')}</h2>
            </Reveal>
            <ol className="mt-12 grid gap-10 border-t border-border pt-10 lg:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step}>
                  <Reveal delay={index * 100} className="flex h-full flex-col gap-4">
                    <span className="eyebrow text-accent-text">0{step}</span>
                    <h3 className="text-2xl font-semibold tracking-tight text-balance">{t(`landing.step${step}Title`)}</h3>
                    <p className="text-muted text-pretty">{t(`landing.step${step}Body`)}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id={ids.data} className="px-4 pb-24 sm:px-6 lg:pb-40">
          <div className="mx-auto max-w-6xl">
            <Reveal className="flex max-w-[720px] flex-col gap-4">
              <span className="eyebrow">{t('landing.dataTitle')}</span>
              <h2 className={sectionTitle}>{t('landing.dataBody')}</h2>
            </Reveal>

            <Reveal>
              <dl className="mt-12 grid gap-10 border-y border-border py-10 sm:grid-cols-2 lg:grid-cols-4">
                {STATS.map((stat) => (
                  <div key={stat.label} className="flex flex-col-reverse gap-3">
                    <dt className="eyebrow">{t(stat.label)}</dt>
                    <dd className="code text-5xl font-medium leading-none tracking-[-0.04em] sm:text-6xl">
                      <CountUp value={stat.value} decimals={stat.decimals} suffix={stat.suffix} />
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal>
              <ul className="mt-12 grid gap-10 sm:grid-cols-2">
                {DATA_SOURCES.map((source) => (
                  <li key={source.key} className="flex flex-col gap-2">
                    <a
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                      className="-my-2 inline-flex min-h-11 items-center gap-1.5 self-start text-lg font-semibold tracking-tight underline-offset-4 hover:underline"
                    >
                      {source.label}
                      <ArrowIcon external className="size-4 text-muted" />
                      <span className="sr-only">{t('common.opensInNewTab')}</span>
                    </a>
                    <p className="text-muted text-pretty">{t(`landing.data${source.key}Body`)}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        <section id={ids.faq} className="px-4 pb-24 sm:px-6 lg:pb-40">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,0.5fr)_minmax(0,1fr)] lg:gap-16">
            <Reveal className="flex flex-col gap-4">
              <span className="eyebrow">{t('landing.navFaq')}</span>
              <h2 className={sectionTitle}>{t('landing.faqTitle')}</h2>
            </Reveal>
            <Reveal delay={100}>
              <Faq onAskCountry={askDialog.open} />
            </Reveal>
          </div>
        </section>

        <section className="relative overflow-hidden px-4 pb-24 sm:px-6 lg:pb-40">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[200px] left-1/2 h-[600px] w-[1200px] -translate-x-1/2"
            style={{
              background:
                'radial-gradient(50% 50% at 50% 100%, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 70%)',
            }}
          />
          <Reveal className="relative mx-auto flex max-w-[800px] flex-col items-center gap-6 text-center">
            <span className="eyebrow">{t('landing.ctaEyebrow')}</span>
            <h2 className="text-5xl font-semibold leading-[0.98] tracking-[-0.035em] text-balance sm:text-7xl">
              {t('landing.ctaTitle')}
            </h2>
            <p className="max-w-[560px] text-lg text-muted text-pretty">{t('landing.ctaBody')}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to={to(primary.to)} className={primaryPill}>
                {primary.label}
              </Link>
              <button type="button" onClick={askDialog.open} className={`${pill} bg-surface-secondary text-foreground hover:bg-surface-hover`}>
                {t('coverage.ask')}
              </button>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <Link to={to('/')} onClick={scrollToTop} aria-label="Velio" className={`inline-flex min-h-11 items-center rounded-md ${focus}`}>
              <VelioLogo height={24} decorative />
            </Link>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </footer>
      <RequestCountryDialog state={askDialog} />
    </div>
  )
}

function ArrowIcon({ className, external }: { className?: string; external?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={external ? 'M7 17 17 7M8 7h9v9' : 'M5 12h14m-6-6 6 6-6 6'} />
    </svg>
  )
}
