import { Meter } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { formatScore } from '@/lib/format'
import { OVERLAP_PENALTY_MAX, scoreBars } from '@/lib/routeMetrics'
import type { CyclingScore } from '@/types/api'

type Props = {
  score: CyclingScore | null
  className?: string
  compact?: boolean
  /**
   * Without an elevation target the engine still returns that bar, scoring a 10
   * for something not requested. Hidden so a meaningless figure is not shown.
   */
  hideElevation?: boolean
}

/** 0–10 score with its breakdown. A magnitude: single hue, no categorical palette. */
export function ScoreCard({ score, className, compact, hideElevation }: Props) {
  const { t } = useTranslation()
  const bars = scoreBars(score).filter((bar) => !(hideElevation && bar.key === 'elevation'))

  // The engine does not always score: without edge data there is no safety or surface.
  if (!score) {
    return (
      <div className={cn('text-sm text-muted', className)}>{t('metric.noScore')}</div>
    )
  }

  return (
    <div className={cn('flex items-center gap-5', className)}>
      <div className="shrink-0">
        <div className="text-[13px] text-muted">
          {t('metric.score')}
        </div>
        <div className="tnum mt-0.5 flex items-baseline gap-1">
          <span className="text-3xl font-semibold leading-none text-accent">
            {formatScore(score.total)}
          </span>
          <span className="text-xs text-muted">/ 10</span>
        </div>
      </div>

      {compact ? null : (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {bars.map((bar) => {
            const max = bar.penalty ? OVERLAP_PENALTY_MAX : 10
            const label = t(`metric.scoreBreakdown.${bar.key === 'overlap_penalty' ? 'overlap' : bar.key}`)
            return (
              <Meter
                key={bar.key}
                value={bar.value}
                minValue={0}
                maxValue={max}
                aria-label={label}
                className="flex items-center gap-3"
              >
                <span className="w-20 shrink-0 text-xs text-muted">{label}</span>
                <Meter.Track className="h-1 flex-1 rounded-full bg-default">
                  <Meter.Fill
                    className={cn('h-1 rounded-full', bar.penalty ? 'bg-danger' : 'bg-accent')}
                  />
                </Meter.Track>
                <span className="tnum w-9 shrink-0 text-right text-xs text-muted">
                  {bar.penalty && bar.value > 0 ? '−' : ''}
                  {formatScore(bar.value)}
                </span>
              </Meter>
            )
          })}
        </div>
      )}
    </div>
  )
}
