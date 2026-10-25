import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { formatDistance, formatDuration, formatScore, formatSigned } from '@/lib/format'
import type { AnyRouteResult } from '@/types/api'

type Tile = { label: string; value: string; hint?: string; tone?: 'good' | 'critical' }

function Tile({ label, value, hint, tone }: Tile) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="eyebrow">{label}</div>
      <div
        className={cn(
          'tnum truncate text-2xl font-medium tracking-tight',
          tone === 'good' && 'text-success',
          tone === 'critical' && 'text-danger',
        )}
      >
        {value}
      </div>
      {hint ? <div className="tnum truncate text-xs text-muted">{hint}</div> : null}
    </div>
  )
}

type Props = {
  result: AnyRouteResult
  /** Requested targets, to compare what was obtained with what was asked for. */
  targetKm?: number
  targetGainM?: number
  lossHint?: string
  durationHint?: string
  className?: string
}

/** Headline figures. Not a chart, so text tokens and no series colors. */
export function MetricTiles({ result, targetKm, targetGainM, lossHint, durationHint, className }: Props) {
  const { t } = useTranslation()

  return (
    <div className={cn('grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4', className)}>
      <Tile
        label={t('metric.distance')}
        value={formatDistance(result.distance_km)}
        hint={targetKm ? `${t('metric.target')} ${formatDistance(targetKm)}` : undefined}
      />
      <Tile
        label={t('metric.gain')}
        value={formatSigned(result.gain_m)}
        // Without a target, climb density is what shows the difference between asking
        // for "flat" and "hilly": 8 m/km is a stroll, 25 m/km one climb after another.
        hint={
          targetGainM
            ? `${t('metric.target')} ${formatSigned(targetGainM)}`
            : result.distance_km > 0
              ? t('metric.perKm', { value: formatScore(result.gain_m / result.distance_km, 1) })
              : undefined
        }
        tone="good"
      />
      <Tile
        label={t('metric.loss')}
        value={formatSigned(-Math.abs(result.loss_m))}
        hint={lossHint}
        tone="critical"
      />
      <Tile label={t('metric.duration')} value={formatDuration(result.duration_min)} hint={durationHint} />
    </div>
  )
}
