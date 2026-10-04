import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Link } from 'react-router-dom'

import { VelioLogo } from './logo'
import { ThemeToggle } from './themeToggle'

type Props = { children: ReactNode; footer?: ReactNode }

export function AuthLayout({ children, footer }: Props) {
  const { t } = useTranslation()

  return (
    <div className="flex h-full bg-background text-foreground">
      <div className="flex w-full flex-col p-6 sm:p-10 lg:w-[560px] lg:shrink-0">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Velio" className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <VelioLogo height={26} />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        {footer ? <div className="text-sm text-muted">{footer}</div> : null}
      </div>

      {/* Panel decorativo: curvas de nivel, sin teselas ni peticiones de red. */}
      <div className="relative hidden flex-1 overflow-hidden bg-accent lg:block" aria-hidden="true">
        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 600 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <g stroke="var(--accent-foreground)" strokeOpacity="0.22" strokeWidth="1.5">
            <path d="M-40 300C60 220 180 200 280 250s180 60 280 10" />
            <path d="M-40 350C60 270 180 250 280 300s180 60 280 10" />
            <path d="M-40 400C60 320 180 300 280 350s180 60 280 10" />
            <path d="M-40 460C70 380 200 360 300 415s190 55 300 5" />
            <path d="M-40 530C70 450 200 430 300 485s190 55 300 5" />
            <path d="M-40 610C80 530 210 510 310 565s180 50 290 0" />
            <path d="M-40 700C80 620 210 600 310 655s180 50 290 0" />
          </g>
          <g stroke="var(--accent-foreground)" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round">
            <path d="M110 760C150 660 230 690 300 590s150-120 210-90" />
          </g>
          <circle cx="110" cy="760" r="9" fill="var(--accent-foreground)" fillOpacity="0.9" />
        </svg>

        <div className="absolute inset-x-12 bottom-12 text-accent-foreground">
          <p className="max-w-md text-2xl font-semibold leading-snug tracking-tight text-pretty">
            {t('auth.heroClaim')}
          </p>
          {/* Las cifras van en la traducción: llevan unidad y separador
              decimal, que cambian con el idioma. */}
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            {(['Area', 'Dem', 'Speed'] as const).map((stat) => (
              <div key={stat}>
                <dt className="tnum text-xl font-semibold">{t(`auth.heroStat${stat}Value`)}</dt>
                <dd className="mt-0.5 text-xs opacity-80">{t(`auth.heroStat${stat}`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
