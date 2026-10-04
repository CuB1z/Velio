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
import { RepairCanvas } from '@/components/landing/repairCanvas'
import { Reveal } from '@/components/landing/reveal'
import { ScrollStory } from '@/components/landing/scrollStory'
import { VelioLogo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/themeToggle'
import { ScoreCard } from '@/components/route/scoreCard'
import { SurfaceBar } from '@/components/route/surfaceBar'
import { RouteMap } from '@/components/landing/routeMap'
import { LANDING_EXAMPLES } from './landingExamples'

/** El circuito que ilustra la puntuación: el urbano de Usera, el mejor de los tres. */
const SCORING_EXAMPLE = LANDING_EXAMPLES[0]
/** La sierra pone la silueta de los cortes y la ortofoto del cierre. */
const SIERRA = LANDING_EXAMPLES[1]

const STATS = [
  { value: 30, decimals: 0, suffix: ' m', label: 'landing.statDem' },
  { value: 0.62, decimals: 2, suffix: ' m', label: 'landing.statError' },
  { value: 74, decimals: 0, suffix: ' km', label: 'landing.statValidated' },
  { value: 7.0, decimals: 1, suffix: '', label: 'landing.statScore' },
]

export function LandingPage() {
  const { t } = useTranslation()
  const { status } = useAuth()
  // Con sesión, la landing sigue siendo visitable (es la portada); lo que
  // cambia es la acción: en vez de entrar o registrarse, abrir la app.
  const authenticated = status === 'authenticated'

  const storySteps = ['storyStep1', 'storyStep2', 'storyStep3'].map((key) => ({
    id: key,
    title: t(`landing.${key}Title`),
    body: t(`landing.${key}Body`),
  }))

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" aria-label="Velio" className="flex items-center">
            <VelioLogo height={24} decorative />
          </Link>

          <nav className="ms-4 hidden items-center gap-6 text-sm md:flex">
            <a href="#funciones" className="text-muted transition-colors duration-150 hover:text-foreground">
              {t('landing.navFeatures')}
            </a>
            <a href="#puntuacion" className="text-muted transition-colors duration-150 hover:text-foreground">
              {t('landing.navScoring')}
            </a>
            <a href="#datos" className="text-muted transition-colors duration-150 hover:text-foreground">
              {t('landing.navData')}
            </a>
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

        {/* ------------------------------------------------------------ cifras */}
        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 lg:pt-28">
          <Reveal>
            <dl className="grid gap-8 border-y border-separator py-10 sm:grid-cols-2 lg:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <dd className="text-4xl font-semibold tracking-tight">
                    <CountUp value={stat.value} decimals={stat.decimals} suffix={stat.suffix} />
                  </dd>
                  <dt className="mt-1.5 text-[15px] text-muted">{t(stat.label)}</dt>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>

        {/* ------------------------------------------------------------ bici */}
        <section id="bici" className="bg-surface-secondary">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-36">
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
        <section id="funciones" className="bg-surface-secondary">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-36">
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
                <BentoCell span={4} tone="parchment" className="flex flex-col justify-between gap-6 bg-background p-7">
                  <BentoLabel title={t('landing.modeExportTitle')} body={t('landing.modeExportBody')} />
                  <div className="flex gap-2">
                    <span className="rounded-full bg-surface-secondary px-3 py-1 text-[13px] font-medium">GPX</span>
                    <span className="rounded-full bg-surface-secondary px-3 py-1 text-[13px] font-medium">GeoJSON</span>
                  </div>
                </BentoCell>

                {/* Y aquí sí, UN mapa: el único de la sección */}
                <BentoCell span={8} className="grid gap-0 sm:grid-cols-2">
                  <div className="flex flex-col justify-center gap-2 p-7">
                    <BentoLabel title={t('landing.modeAnalyzeTitle')} body={t('landing.modeAnalyzeBody')} />
                  </div>
                  <RouteMap shape={SCORING_EXAMPLE.shape} padding={18} className="min-h-56" />
                </BentoCell>
              </Bento>
            </Reveal>
          </div>
        </section>

        {/* --------------------------------------- historia: ida y vuelta */}
        <section id="solape" className="bg-surface-secondary">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-36">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">{t('landing.storyEyebrow')}</p>
            <h2 className="display-lg mt-3 text-balance">{t('landing.compareTitle')}</h2>
          </Reveal>
          <div className="mt-10 lg:mt-16">
            <ScrollStory steps={storySteps}>{(active) => <RepairCanvas step={active} />}</ScrollStory>
          </div>
            <p className="mt-10 text-[13px] text-muted">{t('landing.compareCaption')}</p>
          </div>
        </section>

        {/* ------------------------------------------------------- preguntas */}
        <section id="preguntas" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-36">
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

        {/* ----------------------------------------------------------- datos */}
        <section id="datos" className="bg-ink text-white">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-36">
            <Reveal className="max-w-2xl">
              <p className="eyebrow text-ink-accent">{t('landing.dataEyebrow')}</p>
              <h2 className="display-lg mt-3 text-balance">{t('landing.dataTitle')}</h2>
            </Reveal>

            <Reveal delay={100}>
              <dl className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
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
              <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-16">
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
                <figure className="overflow-hidden rounded-[18px]">
                  <RouteMap shape={SIERRA.shape} style="satellite" padding={30} className="aspect-[4/3]" />
                  <figcaption className="pt-3 text-[12px] text-ink-muted">
                    {t('landing.dataSatellite')}
                  </figcaption>
                </figure>
              </div>
            </Reveal>
          </div>
        </section>

      </main>

      <footer className="bg-surface-secondary">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-12 text-sm text-muted sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-3">
            <VelioLogo height={20} decorative />
            <span>{t('landing.footerRights')}</span>
          </div>
          <p className="text-xs sm:ms-auto sm:text-right">
            © OpenStreetMap · Copernicus DEM GLO-30 · PNOA, IGN
          </p>
        </div>
      </footer>
    </div>
  )
}
