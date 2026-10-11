import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { AnalyzeIcon, BookmarkIcon, RouteIcon } from '@/components/common/icons'
import { cn } from '@/lib/cn'
import { formatDistance, formatScore, formatSigned } from '@/lib/format'
import { readSavedResult } from '@/lib/savedRoute'
import type { SavedRoute } from '@/types/api'

type Props = { routes: SavedRoute[]; total: number; pageOnly: boolean }

export function SavedStats({ routes, total, pageOnly }: Props) {
  const { t } = useTranslation()
  const results = routes.map(readSavedResult).filter((result) => result !== null)
  const scores = results.flatMap((result) => (result.cycling_score ? [result.cycling_score.total] : []))
  const distance = results.reduce((sum, result) => sum + result.distance_km, 0)
  const gain = results.reduce((sum, result) => sum + result.gain_m, 0)

  return (
    <section aria-label={t('saved.stats.label')} className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border shadow-card ring-1 ring-border lg:grid-cols-4">
        <Stat icon={<BookmarkIcon size={18} />} label={t('saved.stats.routes')} value={String(total)} />
        <Stat icon={<RouteIcon size={18} />} label={t('saved.stats.distance')} value={formatDistance(distance)} />
        <Stat icon={<AnalyzeIcon size={18} />} label={t('saved.stats.gain')} value={formatSigned(gain)} />
        <Stat
          icon={<StarIcon />}
          label={t('saved.stats.score')}
          value={scores.length ? formatScore(scores.reduce((sum, score) => sum + score, 0) / scores.length) : '—'}
          suffix={scores.length ? '/10' : undefined}
          accent
        />
      </dl>
      {pageOnly ? <p className="px-1 text-xs text-muted">{t('saved.stats.pageOnly')}</p> : null}
    </section>
  )
}

function Stat({
  icon,
  label,
  value,
  suffix,
  accent = false,
}: {
  icon: ReactNode
  label: string
  value: string
  suffix?: string
  accent?: boolean
}) {
  return (
    <div className="flex items-center gap-4 bg-surface p-4 sm:p-5">
      <span className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent sm:flex">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col-reverse">
        <dt className="text-sm leading-snug text-muted text-pretty">{label}</dt>
        <dd className={cn('tnum text-2xl font-semibold tracking-tight', accent && 'text-accent')}>
          {value}
          {suffix ? <span className="text-base font-medium text-muted">{suffix}</span> : null}
        </dd>
      </div>
    </div>
  )
}

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="m10 2.8 2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7L10 2.8Z" />
    </svg>
  )
}
