import { useTranslation } from 'react-i18next'

import { RouteThumbnail } from '@/components/route/routeThumbnail'
import { ScoreCard } from '@/components/route/scoreCard'
import { SurfaceBar } from '@/components/route/surfaceBar'
import { formatDistance, formatDuration, formatSigned } from '@/lib/format'
import type { LngLat } from '@/lib/polyline'
import type { LandingExample } from './landingExamples'

/** The engine's own output for one loop, shown once and large. */
export function Showcase({ example }: { example: LandingExample }) {
  const { t } = useTranslation()
  const { result } = example
  const coordinates: LngLat[] = example.shape.map(([lat, lon]) => [lon, lat])
  const metrics = [
    { label: t('metric.distance'), value: formatDistance(result.distance_km) },
    { label: t('metric.gain'), value: formatSigned(result.gain_m) },
    { label: t('metric.loss'), value: formatSigned(-result.loss_m) },
    { label: t('metric.duration'), value: formatDuration(result.duration_min) },
  ]

  return (
    <figure className="relative overflow-hidden rounded-3xl bg-surface p-6 ring-1 ring-border sm:p-10 lg:p-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[10%] -top-[40%] h-[120%] w-[70%]"
        style={{
          background:
            'radial-gradient(50% 50% at 50% 50%, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 70%)',
        }}
      />
      <div className="relative grid gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center lg:gap-16">
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between gap-4">
            <span className="text-lg font-semibold tracking-tight">{example.place}</span>
            <span className="eyebrow">{t(`bike.${example.bike}`)}</span>
          </div>
          <RouteThumbnail coordinates={coordinates} width={320} height={200} className="h-auto" />
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="flex flex-col gap-1">
                <dt className="eyebrow">{metric.label}</dt>
                <dd className="tnum text-3xl font-medium tracking-tight">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-col gap-8">
          <ScoreCard score={result.cycling_score} hideElevation large />
          <SurfaceBar score={result.score} distanceKm={result.distance_km} className="border-t border-border pt-6" />
        </div>
      </div>
      <figcaption className="eyebrow relative mt-8 text-center">{t('landing.stageCaption')}</figcaption>
    </figure>
  )
}
