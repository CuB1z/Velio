import { Spinner } from '@heroui/react'
import { Suspense, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'

import { AnalyzeIcon, BookmarkIcon, LoopIcon, RouteIcon } from '@/components/common/icons'
import { cn } from '@/lib/cn'
import { useLangPath } from '@/lib/paths'
import { VelioLogo, VelioMark } from './logo'
import { ThemeToggle } from './themeToggle'
import { UserMenu } from './userMenu'

type NavItem = { to: string; labelKey: string; icon: ReactNode }

const NAV: NavItem[] = [
  { to: '/loops', labelKey: 'nav.loops', icon: <LoopIcon /> },
  { to: '/routes', labelKey: 'nav.routes', icon: <RouteIcon /> },
  { to: '/analyze', labelKey: 'nav.analyze', icon: <AnalyzeIcon /> },
  { to: '/saved', labelKey: 'nav.saved', icon: <BookmarkIcon /> },
]

export function AppShell() {
  const { t } = useTranslation()
  const to = useLangPath()

  return (
    <div className="flex h-full bg-background text-foreground">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground"
      >
        {t('nav.skipToContent')}
      </a>

      {/* Desktop side rail: label under the icon, like the mobile bottom bar.
          Own surface and border so it reads as chrome, not content. */}
      <nav
        aria-label={t('app.name')}
        className="hidden w-[72px] shrink-0 flex-col items-center border-e border-border bg-background py-4 md:flex"
      >
        <NavLink
          to={to('/loops')}
          aria-label={t('app.name')}
          className="mb-4 flex size-10 items-center justify-center rounded-xl text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <VelioMark height={22} decorative />
        </NavLink>

        <ul className="flex flex-1 flex-col items-center gap-1">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={to(item.to)}
                className={({ isActive }) =>
                  cn(
                    'flex w-14 flex-col items-center gap-1 rounded-xl px-1 py-2',
                    'text-[11px] font-medium leading-tight transition-colors duration-150',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    isActive
                      ? 'bg-surface-hover text-foreground'
                      : 'text-muted hover:bg-surface-hover hover:text-foreground',
                  )
                }
              >
                {item.icon}
                <span className="text-center">{t(item.labelKey)}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="flex flex-col items-center gap-1 pt-3">
          <ThemeToggle />
          <UserMenu />
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-only header: on desktop the rail takes over */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-3 md:hidden">
          <NavLink to={to('/')} className="flex items-center" aria-label={t('app.name')}>
            <VelioLogo height={24} decorative />
          </NavLink>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main id="contenido" className="panel-scroll min-h-0 flex-1 overflow-auto">
          <Suspense
            fallback={
              <div className="flex h-full min-h-[60vh] items-center justify-center">
                <Spinner aria-label={t('common.loading')} />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>

        {/* Mobile bottom bar */}
        <nav
          aria-label={t('app.name')}
          className="flex shrink-0 items-stretch border-t border-border bg-background md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={to(item.to)}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors',
                  isActive ? 'text-foreground' : 'text-muted',
                )
              }
            >
              {item.icon}
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
