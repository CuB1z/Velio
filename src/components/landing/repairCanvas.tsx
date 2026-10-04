import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { formatDistance, formatRatio } from '@/lib/format'
import { LANDING_REPAIR } from '@/pages/landingExamples'
import { RouteMap } from './routeMap'

/**
 * Tres estados del mismo circuito: tal y como salía, con la vía repetida
 * señalada, y ya reparado. Los dos mapas están montados a la vez y se cruzan
 * en opacidad — recrearlos en cada paso provocaría un parpadeo de teselas.
 */
export function RepairCanvas({ step }: { step: number }) {
  const { t } = useTranslation()
  const { before, after } = LANDING_REPAIR
  const repaired = step >= 2

  return (
    <figure className="w-full">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface shadow-card sm:aspect-[5/4]">
        <RouteMap
          shape={before.shape}
          highlight={step === 1 ? before.repeated : undefined}
          padding={26}
          className={cn(
            'absolute inset-0 transition-opacity duration-700 ease-enter',
            repaired ? 'opacity-0' : 'opacity-100',
          )}
        />
        <RouteMap
          shape={after.shape}
          padding={26}
          className={cn(
            'absolute inset-0 transition-opacity duration-700 ease-enter',
            repaired ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>

      <figcaption className="mt-5 flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <Figure
          label={t('landing.storyRepeated')}
          value={formatRatio(repaired ? after.overlap : before.overlap, 0)}
          tone={repaired ? 'good' : 'warn'}
        />
        <Figure
          label={t('metric.distance')}
          value={formatDistance(repaired ? after.distance_km : before.distance_km)}
        />
        {repaired ? <Figure label={t('metric.score')} value={after.score.toFixed(1)} tone="accent" /> : null}
      </figcaption>
    </figure>
  )
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'accent' }) {
  return (
    <div>
      <div className="text-[13px] text-muted">{label}</div>
      <div
        className={cn(
          'tnum mt-0.5 text-2xl font-semibold transition-colors duration-700',
          tone === 'warn' && 'text-[#b45309]',
          tone === 'good' && 'text-success',
          tone === 'accent' && 'text-accent',
        )}
      >
        {value}
      </div>
    </div>
  )
}
