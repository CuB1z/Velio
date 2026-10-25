import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAuth } from '@/auth/useAuth'
import { fluid, focus } from '@/components/common/interaction'
import { useLangPath } from '@/lib/paths'
import { VelioLogo } from './Logo'

const ANCHORS = [
  { id: 'landing.anchorFeatures', label: 'landing.navFeatures' },
  { id: 'landing.anchorHow', label: 'landing.navHow' },
  { id: 'landing.anchorData', label: 'landing.navData' },
  { id: 'landing.anchorFaq', label: 'landing.navFaq' },
] as const

export function SiteHeader() {
  const { t } = useTranslation()
  const { status } = useAuth()
  const to = useLangPath()
  const authenticated = status === 'authenticated'

  return (
    <header className="sticky top-0 z-30 px-4 pt-4 sm:pt-6">
      <div className="mx-auto flex items-center gap-2 rounded-full bg-surface-secondary/75 p-2 ps-5 ring-1 ring-border backdrop-blur-xl md:w-max">
        <Link to={to('/')} onClick={() => window.scrollTo({ top: 0 })} aria-label="Velio" className={`flex min-h-11 items-center rounded-md ${focus}`}>
          <VelioLogo height={20} decorative />
        </Link>

        <nav className="ms-6 hidden items-center md:flex">
          {ANCHORS.map((anchor) => (
            <Link
              key={anchor.id}
              to={{ pathname: to('/'), hash: t(anchor.id) }}
              className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground"
            >
              {t(anchor.label)}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center md:ms-6">
          <Link
            to={to(authenticated ? '/loops' : '/register')}
            className={`inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-90 ${fluid} ${focus}`}
          >
            {authenticated ? t('landing.openApp') : t('landing.getStarted')}
          </Link>
        </div>
      </div>
    </header>
  )
}
