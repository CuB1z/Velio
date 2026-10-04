import { Chip } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { formatDistance, formatPercent, formatRatio } from '@/lib/format'
import type { AnyRouteResult, LoopRequest, RouteRequest } from '@/types/api'
import { ElevationProfile } from './elevationProfile'
import { ExportMenu } from './exportMenu'
import { MetricTiles } from './metricTiles'
import { SaveRouteDialog } from './saveRouteDialog'
import { ScoreCard } from './scoreCard'
import { SurfaceBar } from './surfaceBar'
import { VariantList } from './variantList'

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
  className?: string
}

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
  className,
}: Props) {
  const { t } = useTranslation()
  const result = variants[selected]
  if (!result) return null

  const points = result.profile ?? []
  const feasible = result.feasible

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

  return (
    <div className={cn('@container flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <VariantList variants={variants} selected={selected} onSelect={onSelect} />
        {requested !== undefined && variants.length < requested ? (
          <span className="text-[13px] text-muted">
            {t('result.fewerVariants', { count: variants.length, requested })}
          </span>
        ) : null}
        {feasible === true ? (
          <Chip color="success" variant="soft" size="sm">
            <Chip.Label>{t('result.feasible')}</Chip.Label>
          </Chip>
        ) : null}
        {feasible === false ? (
          <Chip color="warning" variant="soft" size="sm">
            <Chip.Label>{t('result.notFeasible')}</Chip.Label>
          </Chip>
        ) : null}

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
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
          {t(whyKey, { minimum: minimumKm ? formatDistance(minimumKm) : '' })}
        </p>
      ) : null}

      <MetricTiles
        result={result}
        targetKm={targetKm}
        targetGainM={targetGainM}
        lossHint={result.score ? `${t('metric.maxGrade')} ${formatPercent(result.score.max_grade_pct)}` : undefined}
        durationHint={
          result.overlap_ratio ? `${t('metric.overlap')} ${formatRatio(result.overlap_ratio)}` : undefined
        }
      />

      <div className="grid gap-x-8 gap-y-4 @xl:grid-cols-2 @5xl:grid-cols-3">
        <ScoreCard score={result.cycling_score} hideElevation={targetGainM === undefined} />
        <SurfaceBar score={result.score} distanceKm={result.distance_km} />
        {points.length > 1 ? (
          <div className="flex flex-col gap-1.5 @xl:col-span-2 @5xl:col-span-1">
            <span className="text-[13px] text-muted">{t('metric.elevationProfile')}</span>
            <ElevationProfile profile={points} distanceKm={result.distance_km} height={96} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
