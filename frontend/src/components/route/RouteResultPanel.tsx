import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChevronIcon } from '@/components/common/Icons'
import { cn } from '@/lib/cn'
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatPercent,
  formatRatio,
  formatScore,
  formatSigned,
} from '@/lib/format'
import { comfortLabelKey, surfaceSegments } from '@/lib/routeMetrics'
import { useTheme } from '@/hooks/useTheme'
import { surfaceColor } from '@/lib/chartPalette'
import type { AnyRouteResult, ElevationPoint, LoopRequest, RouteRequest } from '@/types/api'
import { ElevationProfile } from './ElevationProfile'
import { ExportMenu } from './ExportMenu'
import { MetricTiles } from './MetricTiles'
import { SaveRouteDialog } from './SaveRouteDialog'
import { ScoreCard } from './ScoreCard'
import { SurfaceBar } from './SurfaceBar'
import { VariantList } from './VariantList'

type Props = {
  variants: AnyRouteResult[]
  selected: number
  onSelect: (index: number) => void
  endpoint: 'loops' | 'routes'
  request: LoopRequest | RouteRequest
  defaultName: string
  requested?: number
  targetKm?: number
  targetGainM?: number
  /** Minimum imposed by the waypoints, if any. */
  minimumKm?: number
  onError?: (message: string) => void
  onProfileHover?: (point: ElevationPoint | null) => void
  className?: string
}

/** Headline figures first; targets, breakdowns and the surface legend behind "detail". */
export function RouteResultPanel({
  variants,
  selected,
  onSelect,
  endpoint,
  request,
  defaultName,
  requested,
  targetKm,
  targetGainM,
  minimumKm,
  onError,
  onProfileHover,
  className,
}: Props) {
  const { t } = useTranslation()
  const { resolved } = useTheme()
  const [detail, setDetail] = useState(false)
  const result = variants[selected]
  if (!result) return null

  const points = result.profile ?? []
  const feasible = result.feasible
  const segments = surfaceSegments(result.score, result.distance_km)
  const elevations = points.map((point) => point.elevation_m)

  // The API says the target was missed but not which one; infer it with the
  // same tolerances that were sent.
  const missedDistance =
    targetKm !== undefined && Math.abs(result.distance_km - targetKm) > targetKm * 0.05
  const missedGain =
    targetGainM !== undefined && Math.abs(result.gain_m - targetGainM) > targetGainM * 0.2

  // A waypoint that does not fit the requested distance is the usual cause,
  // and the only one the user can fix.
  const viaTooFar = minimumKm !== undefined && targetKm !== undefined && minimumKm > targetKm

  const whyKey = viaTooFar
    ? 'result.notFeasibleVia'
    : missedDistance && missedGain
      ? 'result.notFeasibleBoth'
      : missedGain
        ? 'result.notFeasibleAscent'
        : missedDistance
          ? 'result.notFeasibleDistance'
          : 'result.notFeasibleHint'

  const figures = [
    { label: t('metric.distance'), value: formatDistance(result.distance_km) },
    { label: t('metric.gain'), value: formatSigned(result.gain_m) },
    { label: t('metric.duration'), value: formatDuration(result.duration_min) },
  ]

  return (
    <div className={cn('@container flex flex-col gap-5', className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <VariantList variants={variants} selected={selected} onSelect={onSelect} />
        {requested !== undefined && variants.length < requested ? (
          <span className="eyebrow">{t('result.fewerVariants', { count: variants.length, requested })}</span>
        ) : null}
        {feasible === true ? <span className="eyebrow text-accent-text">● {t('result.feasible')}</span> : null}
        {feasible === false ? <span className="eyebrow text-warning">● {t('result.notFeasible')}</span> : null}

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <SaveRouteDialog
            payload={result as unknown as Record<string, unknown>}
            defaultName={defaultName}
            onSaved={() => undefined}
          />
          <ExportMenu endpoint={endpoint} request={request} name={defaultName} onError={onError} />
        </div>
      </div>

      {feasible === false ? (
        <p className="text-sm text-muted">{t(whyKey, { minimum: minimumKm ? formatDistance(minimumKm) : '' })}</p>
      ) : null}

      <dl className="grid grid-cols-2 gap-y-5 @xl:grid-cols-5">
        {figures.map((figure) => (
          <div key={figure.label} className="flex flex-col gap-1 @xl:border-s @xl:border-border @xl:ps-5 @xl:first:border-s-0 @xl:first:ps-0">
            <dt className="eyebrow">{figure.label}</dt>
            <dd className="tnum text-3xl font-medium tracking-tight">{figure.value}</dd>
          </div>
        ))}
        <div className="flex flex-col gap-1 @xl:border-s @xl:border-border @xl:ps-5">
          <dt className="eyebrow">{t('metric.score')}</dt>
          <dd className="tnum text-3xl font-medium tracking-tight text-accent-text">
            {result.cycling_score ? (
              <>
                {formatScore(result.cycling_score.total)}
                <span className="text-sm tracking-normal text-muted"> / 10</span>
              </>
            ) : (
              <span className="text-sm tracking-normal text-muted">{t('metric.noScore')}</span>
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1 @xl:border-s @xl:border-border @xl:ps-5">
          <dt className="eyebrow">{t('metric.surface')}</dt>
          <dd className="flex flex-col gap-2">
            <span className="tnum text-3xl font-medium tracking-tight">
              {result.score ? (
                <>
                  {formatScore(result.score.comfort, 0)}
                  <span className="text-sm tracking-normal text-muted"> / 100</span>
                </>
              ) : (
                <span className="text-sm tracking-normal text-muted">{t('surface.__unknown')}</span>
              )}
            </span>
            {segments.length > 0 ? (
              <span className="flex h-[3px] gap-[3px] overflow-hidden" role="presentation">
                {segments.map((segment) => (
                  <span
                    key={segment.key}
                    style={{ flexGrow: Math.max(segment.share, 0.02), background: surfaceColor(resolved, segment.key) }}
                  />
                ))}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        {points.length > 1 ? (
          <ElevationProfile profile={points} distanceKm={result.distance_km} height={80} onHover={onProfileHover} />
        ) : null}
        <div className="flex items-center justify-between gap-4">
          <span className="eyebrow">
            {points.length > 1
              ? `${formatElevation(Math.min(...elevations))} · ${formatElevation(Math.max(...elevations))}`
              : result.score
                ? `${t(comfortLabelKey(result.score.comfort))}`
                : ''}
          </span>
          <button
            type="button"
            onClick={() => setDetail((open) => !open)}
            aria-expanded={detail}
            className="-my-3 flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t(detail ? 'result.detailHide' : 'result.detail')}
            <ChevronIcon className={cn('transition-transform', detail && 'rotate-180')} />
          </button>
        </div>
      </div>

      {detail ? (
        <div className="grid gap-x-8 gap-y-6 border-t border-border pt-5 @xl:grid-cols-2 @5xl:grid-cols-3">
          <MetricTiles
            result={result}
            targetKm={targetKm}
            targetGainM={targetGainM}
            lossHint={result.score ? `${t('metric.maxGrade')} ${formatPercent(result.score.max_grade_pct)}` : undefined}
            durationHint={
              result.overlap_ratio ? `${t('metric.overlap')} ${formatRatio(result.overlap_ratio)}` : undefined
            }
            className="@xl:col-span-2 @5xl:col-span-3"
          />
          <ScoreCard score={result.cycling_score} hideElevation={targetGainM === undefined} />
          <SurfaceBar score={result.score} distanceKm={result.distance_km} />
        </div>
      ) : null}
    </div>
  )
}
