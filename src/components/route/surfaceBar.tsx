import { useTranslation } from 'react-i18next'

import { useTheme } from '@/hooks/useTheme'
import { surfaceColor } from '@/lib/chartPalette'
import { cn } from '@/lib/cn'
import { formatDistance, formatRatio, formatScore } from '@/lib/format'
import { comfortLabelKey, surfaceSegments } from '@/lib/routeMetrics'
import type { SurfaceScore } from '@/types/api'

type Props = {
  score: SurfaceScore | null
  distanceKm: number
  className?: string
}

/**
 * Stacked surface bar. Every segment carries a direct label (required: the
 * palette's orange/green pair needs a secondary encoding), plus 2 px gaps.
 */
export function SurfaceBar({ score, distanceKm, className }: Props) {
  const { t } = useTranslation()
  const { resolved } = useTheme()
  const segments = surfaceSegments(score, distanceKm)

  if (!score || segments.length === 0) {
    return (
      <div className={cn('text-sm text-muted', className)}>{t('surface.__unknown')}</div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">{t('metric.surface')}</span>
        <span className="text-sm">
          <span className="code font-semibold">{formatScore(score.comfort, 0)}</span>
          <span className="text-muted"> / 100 · {t(comfortLabelKey(score.comfort))}</span>
        </span>
      </div>

      <div className="flex h-1 gap-[3px] overflow-hidden" role="presentation">
        {segments.map((segment) => (
          <div
            key={segment.key}
            style={{
              flexGrow: Math.max(segment.share, 0.02),
              background: surfaceColor(resolved, segment.key),
            }}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ background: surfaceColor(resolved, segment.key) }}
            />
            <span className="text-foreground">
              {t(`surface.${segment.key}`, { defaultValue: segment.key.replace(/_/g, ' ') })}
            </span>
            <span className="code text-muted">
              {formatDistance(segment.km)} · {formatRatio(segment.share, 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
