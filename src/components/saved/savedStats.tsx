import { useTranslation } from 'react-i18next'

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
      <dl className="grid grid-cols-2 gap-y-6 border-y border-border py-6 lg:grid-cols-4">
        <Stat label={t('saved.stats.routes')} value={String(total)} />
        <Stat label={t('saved.stats.distance')} value={formatDistance(distance)} />
        <Stat label={t('saved.stats.gain')} value={formatSigned(gain)} />
        <Stat
          label={t('saved.stats.score')}
          value={scores.length ? formatScore(scores.reduce((sum, score) => sum + score, 0) / scores.length) : '—'}
          suffix={scores.length ? '/10' : undefined}
          accent
        />
      </dl>
      {pageOnly ? <p className="eyebrow">{t('saved.stats.pageOnly')}</p> : null}
    </section>
  )
}

function Stat({
  label,
  value,
  suffix,
  accent = false,
}: {
  label: string
  value: string
  suffix?: string
  accent?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col-reverse gap-1.5 lg:border-s lg:border-border lg:ps-8 lg:first:border-s-0 lg:first:ps-0">
      <dt className="eyebrow text-pretty">{label}</dt>
      <dd className={cn('code text-3xl font-medium tracking-tight', accent && 'text-accent-text')}>
        {value}
        {suffix ? <span className="text-sm tracking-normal text-muted"> {suffix}</span> : null}
      </dd>
    </div>
  )
}
