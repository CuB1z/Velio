import { Chip } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { formatDistance, formatPercent, formatRatio } from '@/lib/format'
import type { AnyRouteResult, ElevationPoint, LoopRequest, RouteRequest } from '@/types/api'
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
  /** Perfil de elevación del trazado elegido, si se pidió o se cargó aparte. */
  profile?: ElevationPoint[] | null
  targetKm?: number
  targetGainM?: number
  /** Mínimo impuesto por los puntos de paso, si los hay. */
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
  profile,
  targetKm,
  targetGainM,
  minimumKm,
  onError,
  className,
}: Props) {
  const { t } = useTranslation()
  const result = variants[selected]
  if (!result) return null

  const points = profile ?? result.profile ?? []
  const feasible = result.feasible

  // La API dice que no llegó, pero no cuál de los dos objetivos falló. Se
  // deduce comparando con las mismas tolerancias que se enviaron.
  const missedDistance =
    targetKm !== undefined && Math.abs(result.distance_km - targetKm) > targetKm * 0.05
  const missedGain =
    targetGainM !== undefined && Math.abs(result.gain_m - targetGainM) > targetGainM * 0.2

  // Un punto de paso que no cabe en la distancia pedida es la causa habitual,
  // y es la única que el usuario puede corregir.
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
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-wrap items-center gap-2">
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
        {result.overlap_ratio !== null && result.overlap_ratio > 0 ? (
          <Chip color="default" variant="soft" size="sm">
            <Chip.Label>
              {t('metric.overlap')} {formatRatio(result.overlap_ratio)}
            </Chip.Label>
          </Chip>
        ) : null}
        {result.score ? (
          <Chip color="default" variant="soft" size="sm">
            <Chip.Label>
              {t('metric.maxGrade')} {formatPercent(result.score.max_grade_pct)}
            </Chip.Label>
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

      <MetricTiles result={result} targetKm={targetKm} targetGainM={targetGainM} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ScoreCard score={result.cycling_score} hideElevation={targetGainM === undefined} />
        <SurfaceBar score={result.score} distanceKm={result.distance_km} />
      </div>

      {points.length > 1 ? (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-muted">
            {t('metric.elevationProfile')}
          </span>
          <ElevationProfile profile={points} distanceKm={result.distance_km} />
        </div>
      ) : null}

      <VariantList variants={variants} selected={selected} onSelect={onSelect} />
    </div>
  )
}
