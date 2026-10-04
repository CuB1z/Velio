import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { formatDistance, formatDuration, formatScore, formatSigned } from '@/lib/format'
import type { AnyRouteResult } from '@/types/api'

type Tile = { label: string; value: string; hint?: string; tone?: 'good' | 'critical' }

function Tile({ label, value, hint, tone }: Tile) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-muted">{label}</div>
      <div
        className={cn(
          'tnum mt-1 truncate text-xl font-semibold',
          tone === 'good' && 'text-success',
          tone === 'critical' && 'text-danger',
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 truncate text-[11px] text-muted">{hint}</div> : null}
    </div>
  )
}

type Props = {
  result: AnyRouteResult
  /** Objetivos pedidos, para contrastar lo obtenido con lo buscado. */
  targetKm?: number
  targetGainM?: number
  className?: string
}

/**
 * Fila de cifras principales. No es un gráfico: son números destacados, así que
 * el texto lleva tokens de texto y ningún color de serie.
 */
export function MetricTiles({ result, targetKm, targetGainM, className }: Props) {
  const { t } = useTranslation()

  return (
    <div className={cn('grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4', className)}>
      <Tile
        label={t('metric.distance')}
        value={formatDistance(result.distance_km)}
        hint={targetKm ? `${t('metric.target')} ${formatDistance(targetKm)}` : undefined}
      />
      <Tile
        label={t('metric.gain')}
        value={formatSigned(result.gain_m)}
        // Sin objetivo, la densidad de subida es lo que hace visible la
        // diferencia entre pedir «llano» y «montañoso»: 8 m/km es un paseo,
        // 25 m/km un puerto tras otro.
        hint={
          targetGainM
            ? `${t('metric.target')} ${formatSigned(targetGainM)}`
            : result.distance_km > 0
              ? t('metric.perKm', { value: formatScore(result.gain_m / result.distance_km, 1) })
              : undefined
        }
        tone="good"
      />
      <Tile label={t('metric.loss')} value={formatSigned(-Math.abs(result.loss_m))} tone="critical" />
      <Tile label={t('metric.duration')} value={formatDuration(result.duration_min)} />
    </div>
  )
}
