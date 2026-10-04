import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'

import { cn } from '@/lib/cn'
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

  return (
    <div className="flex h-full bg-background text-foreground">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground"
      >
        {t('nav.skipToContent')}
      </a>

      {/* Raíl lateral en escritorio: rótulo bajo el icono, como la barra
          inferior del móvil. Superficie y filete propios para que se lea como
          cromo y no como parte del contenido. */}
      <nav
        aria-label={t('app.name')}
        className="hidden w-[84px] shrink-0 flex-col items-center border-e border-border bg-surface py-4 md:flex"
      >
        <NavLink
          to="/loops"
          aria-label={t('app.name')}
          className="mb-5 flex size-10 items-center justify-center rounded-xl text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <VelioMark height={26} decorative />
        </NavLink>

        <ul className="flex flex-1 flex-col items-center gap-1.5">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex w-[68px] flex-col items-center gap-1 rounded-2xl px-1 py-2.5',
                    'text-[11px] font-medium leading-tight transition-colors duration-150',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    isActive
                      ? 'bg-accent-soft text-accent-soft-foreground'
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
        {/* Cabecera solo en móvil: en escritorio manda el raíl */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-3 md:hidden">
          <NavLink to="/" className="flex items-center" aria-label={t('app.name')}>
            <VelioLogo height={24} decorative />
          </NavLink>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main id="contenido" className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>

        {/* Barra inferior en móvil */}
        <nav
          aria-label={t('app.name')}
          className="flex shrink-0 items-stretch border-t border-border bg-surface md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-muted',
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

function LoopIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <ellipse cx="10" cy="10" rx="7" ry="7.5" />
      <circle cx="10" cy="17.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

function RouteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="4.5" cy="15.5" r="2.2" />
      <circle cx="15.5" cy="4.5" r="2.2" />
      <path d="M6.4 14C9 12.4 8.4 9 11 7.2" />
    </svg>
  )
}

function AnalyzeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 14.5 6.5 8l3 4 2-3.2 4 5.7" />
      <path d="M2.5 17h15" />
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 2.8h10v14.4l-5-3.6-5 3.6V2.8Z" />
    </svg>
  )
}
