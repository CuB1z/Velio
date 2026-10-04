import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { AppShot } from './appShot'

/**
 * Titular, una cifra concreta y la interfaz real debajo. Antes el visual era
 * un mapa a todo lo ancho; un mapa es la *salida* del producto, no el
 * producto, y la página entera acabó siendo mapas.
 */
export function HeroShowcase({ authenticated }: { authenticated: boolean }) {
  const { t } = useTranslation()

  return (
    <section className="pt-10 sm:pt-16 lg:pt-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h1 className="display-xl text-balance">{t('landing.heroTitle')}</h1>
        <p className="lead mx-auto mt-6 max-w-2xl text-muted text-pretty">{t('landing.heroBody')}</p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={authenticated ? '/loops' : '/register'}
            className="inline-flex min-h-12 items-center rounded-full bg-accent px-7 text-base font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t(authenticated ? 'landing.openApp' : 'landing.heroCta')}
          </Link>
          <a
            href="#funciones"
            className="inline-flex min-h-12 items-center rounded-full px-5 text-base font-medium text-accent transition-colors duration-150 hover:bg-accent-soft"
          >
            {t('landing.heroSecondary')} →
          </a>
        </div>
        <p className="mt-6 text-sm text-muted">{t('landing.heroNote')}</p>
      </div>

      {/* La interfaz real, recortada por arriba para que invite a bajar */}
      <div className="mx-auto mt-14 max-w-[1200px] px-4 sm:mt-20 sm:px-6">
        <div className="overflow-hidden rounded-2xl bg-surface shadow-raised">
          <AppShot priority />
        </div>
        <p className="mt-3 text-center text-[12px] text-muted">{t('landing.heroShot')}</p>
      </div>
    </section>
  )
}
