import { useTranslation } from 'react-i18next'

import { ScoreCard } from '@/components/route/scoreCard'
import { SurfaceBar } from '@/components/route/surfaceBar'
import { formatDistance, formatDuration, formatSigned } from '@/lib/format'
import { LANDING_EXAMPLES } from '@/pages/landingExamples'
import { ProfileCell } from './profileCell'

const SIERRA = LANDING_EXAMPLES[1]

export function HeroStage() {
  const { t } = useTranslation()
  const { result } = SIERRA
  const metrics = [
    { label: t('metric.distance'), value: formatDistance(result.distance_km) },
    { label: t('metric.gain'), value: formatSigned(result.gain_m) },
    { label: t('metric.duration'), value: formatDuration(result.duration_min) },
  ]

  return (
    <figure className="rounded-3xl bg-accent p-4 sm:p-8 lg:p-12">
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-2xl bg-surface p-6 text-foreground shadow-raised lg:col-span-7 lg:row-span-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-lg font-semibold tracking-tight">{SIERRA.place}</span>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
              {t(`bike.${SIERRA.bike}`)}
            </span>
          </div>
          <dl className="mt-6 grid grid-cols-3 gap-4">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <dt className="text-sm text-muted">{metric.label}</dt>
                <dd className="tnum mt-1 text-xl font-semibold tracking-tight">{metric.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6">
            <ProfileCell height={200} />
          </div>
        </div>
        <div className="rounded-2xl bg-surface p-6 text-foreground shadow-raised lg:col-span-5">
          <ScoreCard score={result.cycling_score} hideElevation />
        </div>
        <div className="rounded-2xl bg-surface p-6 text-foreground shadow-raised lg:col-span-5">
          <SurfaceBar score={result.score} distanceKm={result.distance_km} />
        </div>
      </div>
      <figcaption className="mt-6 text-center text-sm text-accent-foreground opacity-90">
        {t('landing.stageCaption')}
      </figcaption>
    </figure>
  )
}
