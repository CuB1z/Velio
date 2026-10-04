import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SegmentedControl } from '@/components/common/segmentedControl'
import { SurfaceBar } from '@/components/route/surfaceBar'
import { formatDistance, formatSigned } from '@/lib/format'
import type { BikeType } from '@/types/api'
import { LANDING_WALL } from '@/pages/landingWall'
import { RouteMap } from './routeMap'

const BIKES: BikeType[] = ['road', 'city', 'gravel', 'mtb']

/** Un circuito real por bici, para que la diferencia se vea en el firme. */
const FOR_BIKE: Record<BikeType, string> = {
  road: 'girona-road',
  city: 'sevilla-city',
  gravel: 'sierra-gravel',
  mtb: 'granada-mtb',
}

/**
 * La idea central del producto, demostrada en vez de contada: eliges bici y
 * cambia el circuito y su reparto de firme. Cada opción muestra una ruta real
 * generada con esa bici, no una ilustración.
 */
export function BikeShowcase() {
  const { t } = useTranslation()
  const [bike, setBike] = useState<BikeType>('road')
  const example = LANDING_WALL.find((item) => item.key === FOR_BIKE[bike])
  if (!example) return null

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
      <div>
        <SegmentedControl
          label={t('bike.label')}
          options={BIKES.map((id) => ({ id, label: t(`bike.${id}`) }))}
          value={bike}
          onChange={setBike}
          className="max-w-md"
        />
        <p className="lead mt-6 max-w-md text-muted text-pretty">{t(`landing.bikePitch.${bike}`)}</p>

        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <dt className="text-[13px] text-muted">{t('landing.bikeExample')}</dt>
            <dd className="mt-0.5 text-lg font-semibold tracking-tight">{example.place}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted">{t('metric.distance')}</dt>
            <dd className="tnum mt-0.5 text-lg font-semibold">
              {formatDistance(example.result.distance_km)}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted">{t('metric.gain')}</dt>
            <dd className="tnum mt-0.5 text-lg font-semibold text-success">
              {formatSigned(example.result.gain_m)}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted">{t('metric.score')}</dt>
            <dd className="tnum mt-0.5 text-lg font-semibold text-accent">
              {example.result.cycling_score?.total.toFixed(1)}
            </dd>
          </div>
        </dl>
      </div>

      <div key={bike} className="fade-in flex flex-col gap-5">
        <RouteMap shape={example.shape} padding={30} className="aspect-[4/3] rounded-2xl shadow-card" />
        <SurfaceBar score={example.result.score} distanceKm={example.result.distance_km} />
      </div>
    </div>
  )
}
