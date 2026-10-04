import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAuth } from '@/auth/useAuth'
import { AppShot } from '@/components/landing/appShot'
import { Bento, BentoCell, BentoLabel } from '@/components/landing/bento'
import { BikeShowcase } from '@/components/landing/bikeShowcase'
import { CountUp } from '@/components/landing/countUp'
import { Faq } from '@/components/landing/faq'
import { HeroShowcase } from '@/components/landing/heroShowcase'
import { ProfileCell } from '@/components/landing/profileCell'
import { RepairSteps } from '@/components/landing/repairSteps'
import { Reveal } from '@/components/landing/reveal'
import { RouteMap } from '@/components/landing/routeMap'
import { VelioLogo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/themeToggle'
import { ScoreCard } from '@/components/route/scoreCard'
import { SurfaceBar } from '@/components/route/surfaceBar'
import { formatDistance, formatSigned } from '@/lib/format'
import { LANDING_EXAMPLES } from './landingExamples'
import { LANDING_WALL } from './landingWall'

/** El circuito que ilustra la puntuación: el urbano de Usera, el mejor de los tres. */
const SCORING_EXAMPLE = LANDING_EXAMPLES[0]
/** La sierra pone la silueta del cierre. */
const SIERRA = LANDING_EXAMPLES[1]
const CTA_EXAMPLE = LANDING_WALL.find((item) => item.key === 'mallorca-road') ?? LANDING_WALL[0]

const STATS = [
  { value: 30, decimals: 0, suffix: ' m', label: 'landing.statDem' },
  { value: 0.62, decimals: 2, suffix: ' m', label: 'landing.statError' },
  { value: 74, decimals: 0, suffix: ' km', label: 'landing.statValidated' },
  { value: 7.0, decimals: 1, suffix: '', label: 'landing.statScore' },
]

const DATA_SOURCES = [
  { label: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
  { label: 'Copernicus DEM GLO-30', href: 'https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM' },
  { label: 'PNOA · IGN', href: 'https://pnoa.ign.es/' },
]

const pill =
  'inline-flex min-h-12 items-center rounded-full px-7 text-base font-semibold transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2'
const footerLink = 'inline-flex min-h-10 items-center text-[15px] text-muted transition-colors duration-150 hover:text-foreground'

export function LandingPage() {
  const { t } = useTranslation()
  const { status } = useAuth()
  // Con sesión, la landing sigue siendo visitable (es la portada); lo que
  // cambia es la acción: en vez de entrar o registrarse, abrir la app.
  const authenticated = status === 'authenticated'

  const anchors = [
    { href: '#motor', label: t('landing.navFeatures') },
    { href: '#funciones', label: t('landing.navScoring') },
    { href: '#datos', label: t('landing.navData') },
  ]

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" aria-label="Velio" className="flex items-center">
            <VelioLogo height={24} decorative />
          </Link>

          <nav className="ms-4 hidden items-center gap-6 text-sm md:flex">
            {anchors.map((anchor) => (
              <a
                key={anchor.href}
                href={anchor.href}
                className="text-muted transition-colors duration-150 hover:text-foreground"
              >
                {anchor.label}
              </a>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-2">
            <ThemeToggle />
            {authenticated ? (
              <Link
                to="/loops"
                className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {t('landing.openApp')}
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden min-h-11 items-center px-3 text-sm font-medium text-foreground transition-colors duration-150 hover:text-accent sm:flex"
                >
                  {t('landing.signIn')}
                </Link>
                <Link
                  to="/register"
                  className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {t('landing.getStarted')}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <HeroShowcase authenticated={authenticated} />

        {/* ------------------------------------------------------------ bici */}
        <section id="bici" className="mt-24 bg-surface-secondary lg:mt-32">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
            <Reveal className="max-w-2xl">
              <p className="eyebrow">{t('landing.bikeEyebrow')}</p>
              <h2 className="display-lg mt-3 text-balance">{t('landing.bikeTitle')}</h2>
            </Reveal>
            <Reveal delay={100} className="mt-12">
              <BikeShowcase />
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------- funciones */}
        <section id="funciones">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
            <Reveal className="max-w-2xl">
              <p className="eyebrow">{t('landing.featuresEyebrow')}</p>
              <h2 className="display-lg mt-3 text-balance">{t('landing.modesTitle')}</h2>
            </Reveal>

            <Reveal delay={100} className="mt-14">
              <Bento>
                {/* La celda dominante: la app */}
                <BentoCell span={7} className="flex flex-col">
                  <div className="p-7 pb-5">
                    <BentoLabel title={t('landing.modeLoopTitle')} body={t('landing.modeLoopBody')} />
                  </div>
                  <div className="mt-auto overflow-hidden px-7">
                    <AppShot className="rounded-t-[12px]" />
                  </div>
                </BentoCell>

                {/* Puntuación: un gráfico, no un mapa */}
                <BentoCell span={5} className="flex flex-col gap-7 p-7">
                  <BentoLabel title={t('landing.scoringTitle')} body={t('landing.scoringBody')} />
                  <ScoreCard score={SCORING_EXAMPLE.result.cycling_score} hideElevation />
                </BentoCell>

                {/* Perfil de elevación */}
                <BentoCell span={5} className="flex flex-col gap-5 p-7">
                  <BentoLabel title={t('landing.cellProfileTitle')} body={t('landing.cellProfileBody')} />
                  <ProfileCell />
                </BentoCell>

                {/* Una cifra, grande */}
                <BentoCell span={3} tone="ink" className="flex flex-col justify-center gap-3 p-7">
                  <div className="text-[15px] text-ink-muted">{t('landing.cellErrorLabel')}</div>
                  <div className="text-5xl font-semibold tracking-tight">
                    <CountUp value={0.62} decimals={2} suffix=" m" />
                  </div>
                  <p className="text-[13px] leading-relaxed text-ink-muted text-pretty">
                    {t('landing.cellErrorBody')}
                  </p>
                </BentoCell>

                {/* Firme: la barra de datos */}
                <BentoCell span={4} className="flex flex-col gap-5 p-7">
                  <BentoLabel title={t('landing.cellSurfaceTitle')} />
                  <SurfaceBar
                    score={SCORING_EXAMPLE.result.score}
                    distanceKm={SCORING_EXAMPLE.result.distance_km}
                  />
                </BentoCell>

                {/* Exportar: texto puro */}
                <BentoCell span={4} tone="parchment" className="flex flex-col justify-between gap-6 p-7">
                  <BentoLabel title={t('landing.modeExportTitle')} body={t('landing.modeExportBody')} />
                  <div className="flex gap-2">
                    <span className="rounded-full bg-surface px-3 py-1 text-[13px] font-medium">GPX</span>
                    <span className="rounded-full bg-surface px-3 py-1 text-[13px] font-medium">GeoJSON</span>
                  </div>
                </BentoCell>

                <BentoCell span={8} className="grid gap-0 sm:grid-cols-2">
                  <div className="flex flex-col justify-center gap-2 p-7">
                    <BentoLabel title={t('landing.modeAnalyzeTitle')} body={t('landing.modeAnalyzeBody')} />
                  </div>
                  <div className="relative min-h-56">
                    <RouteMap shape={SCORING_EXAMPLE.shape} padding={24} className="absolute inset-0" />
                  </div>
                </BentoCell>
              </Bento>
            </Reveal>
          </div>
        </section>

        {/* --------------------------------------- historia: ida y vuelta */}
        <section id="motor" className="bg-surface-secondary">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
            <Reveal className="max-w-2xl">
              <p className="eyebrow">{t('landing.storyEyebrow')}</p>
              <h2 className="display-lg mt-3 text-balance">{t('landing.compareTitle')}</h2>
            </Reveal>
            <div className="mt-12 lg:mt-14">
              <RepairSteps />
            </div>
            <p className="mt-8 text-[13px] text-muted">{t('landing.compareCaption')}</p>
          </div>
        </section>

        {/* ----------------------------------------------------------- datos */}
        <section id="datos" className="bg-ink text-white">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
            <Reveal className="max-w-2xl">
              <p className="eyebrow text-ink-accent">{t('landing.dataEyebrow')}</p>
              <h2 className="display-lg mt-3 text-balance">{t('landing.dataTitle')}</h2>
            </Reveal>

            <Reveal delay={100}>
              <dl className="mt-14 grid gap-10 border-y border-white/10 py-10 sm:grid-cols-2 lg:grid-cols-4">
                {STATS.map((stat) => (
                  <div key={stat.label}>
                    <dd className="text-5xl font-semibold tracking-tight">
                      <CountUp value={stat.value} decimals={stat.decimals} suffix={stat.suffix} />
                    </dd>
                    <dt className="mt-2 text-[15px] text-ink-muted">{t(stat.label)}</dt>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal delay={160}>
              <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-16">
                <dl className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
                  {[
                    ['landing.dataOsm', 'landing.dataOsmBody'],
                    ['landing.dataDem', 'landing.dataDemBody'],
                    ['landing.dataAccuracy', 'landing.dataAccuracyBody'],
                    ['landing.dataExport', 'landing.dataExportBody'],
                  ].map(([term, body]) => (
                    <div key={term}>
                      <dt className="font-semibold text-ink-accent">{t(term)}</dt>
                      <dd className="mt-1.5 leading-relaxed text-ink-muted text-pretty">{t(body)}</dd>
                    </div>
                  ))}
                </dl>
                <figure>
                  <RouteMap
                    shape={SIERRA.shape}
                    tone="ink"
                    className="aspect-[4/3] rounded-2xl ring-1 ring-white/10"
                  />
                  <figcaption className="pt-3 text-[13px] text-ink-muted">
                    {t('landing.dataSketch', {
                      distance: formatDistance(SIERRA.result.distance_km),
                      gain: formatSigned(SIERRA.result.gain_m),
                    })}
                  </figcaption>
                </figure>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------- preguntas */}
        <section id="preguntas" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)] lg:gap-20">
            <Reveal>
              <p className="eyebrow">{t('landing.faqEyebrow')}</p>
              <h2 className="display-lg mt-3 text-balance">{t('landing.faqTitle')}</h2>
            </Reveal>
            <Reveal delay={100}>
              <Faq />
            </Reveal>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:pb-32">
          <Reveal>
            <div className="grid items-center gap-10 overflow-hidden rounded-[28px] bg-accent p-8 text-accent-foreground sm:p-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16 lg:p-16">
              <div>
                <h2 className="display-lg text-balance">{t('landing.ctaTitle')}</h2>
                <p className="lead mt-5 max-w-xl text-pretty opacity-90">{t('landing.ctaBody')}</p>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Link
                    to={authenticated ? '/loops' : '/register'}
                    className={`${pill} bg-accent-foreground text-accent focus-visible:outline-accent-foreground`}
                  >
                    {t(authenticated ? 'landing.openApp' : 'landing.heroCta')}
                  </Link>
                  {authenticated ? null : (
                    <Link
                      to="/login"
                      className={`${pill} px-5 font-medium ring-1 ring-current/30 focus-visible:outline-accent-foreground`}
                    >
                      {t('landing.signIn')}
                    </Link>
                  )}
                </div>
              </div>

              <div className="rotate-[1.5deg] overflow-hidden rounded-2xl bg-surface text-foreground shadow-raised">
                <RouteMap shape={CTA_EXAMPLE.shape} padding={28} className="aspect-[4/3]" />
                <dl className="grid grid-cols-3 gap-3 p-5">
                  <div>
                    <dt className="text-[13px] text-muted">{CTA_EXAMPLE.place}</dt>
                    <dd className="tnum mt-0.5 font-semibold">{formatDistance(CTA_EXAMPLE.result.distance_km)}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-muted">{t('metric.gain')}</dt>
                    <dd className="tnum mt-0.5 font-semibold">{formatSigned(CTA_EXAMPLE.result.gain_m)}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-muted">{t('metric.score')}</dt>
                    <dd className="tnum mt-0.5 font-semibold text-accent">
                      {CTA_EXAMPLE.result.cycling_score?.total.toFixed(1)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-separator bg-surface-secondary">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="flex flex-col items-start gap-4">
            <Link to="/" aria-label="Velio">
              <VelioLogo height={24} decorative />
            </Link>
            <p className="max-w-xs text-[15px] leading-relaxed text-muted">{t('landing.footerRights')}</p>
          </div>

          <FooterColumn title={t('landing.footerProduct')}>
            {[...anchors, { href: '#preguntas', label: t('landing.navFaq') }].map((anchor) => (
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
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 text-[13px] text-muted sm:px-6">
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
      <h2 className="mb-2 text-[13px] font-semibold tracking-normal text-foreground">{title}</h2>
      {children}
    </nav>
  )
}
