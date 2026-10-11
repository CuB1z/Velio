import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { LoopIcon, RouteIcon } from '@/components/common/icons'
import { RouteThumbnail } from '@/components/route/routeThumbnail'
import { useTheme } from '@/hooks/useTheme'
import { surfaceColor } from '@/lib/chartPalette'
import { cn } from '@/lib/cn'
import { formatDistance, formatDuration, formatRatio, formatRelative, formatScore, formatSigned } from '@/lib/format'
import { surfaceLabelKey, surfaceSegments } from '@/lib/routeMetrics'
import { readSavedResult, savedRouteKind } from '@/lib/savedRoute'
import type { SavedRoute } from '@/types/api'

const lift = 'transition-[translate,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
const chip = 'pointer-events-none absolute rounded-full bg-surface/90 shadow-card backdrop-blur'

type Props = {
  route: SavedRoute
  isSelected: boolean
  selecting: boolean
  onToggle: () => void
}

export function SavedCard({ route, isSelected, selecting, onToggle }: Props) {
  const { t } = useTranslation()
  const { resolved } = useTheme()
  const result = readSavedResult(route)
  const kind = savedRouteKind(route)
  const segments = result ? surfaceSegments(result.score, result.distance_km) : []
  const score = result?.cycling_score?.total

  return (
    <li
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl bg-surface shadow-card ring-1',
        'hover:-translate-y-0.5 hover:shadow-raised active:translate-y-0',
        'has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-accent',
        lift,
        isSelected ? 'ring-2 ring-accent' : 'ring-border',
      )}
    >
      <div className="relative aspect-[2/1] bg-surface-secondary">
        {result ? (
          <RouteThumbnail polyline={result.polyline} kind={kind} />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">
            {t('saved.unreadable')}
          </div>
        )}

        {selecting ? (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute left-3 top-3 z-20 flex size-7 items-center justify-center rounded-full ring-2 transition-colors duration-150',
              isSelected ? 'bg-accent text-accent-foreground ring-accent' : 'bg-surface/90 ring-border backdrop-blur',
            )}
          >
            {isSelected ? <CheckIcon /> : null}
          </span>
        ) : null}

        {score !== undefined ? (
          <span className={cn(chip, 'right-3 top-3 px-2.5 py-1')}>
            <span className="tnum text-sm font-semibold text-accent">{formatScore(score)}</span>
            <span className="text-xs text-muted"> /10</span>
          </span>
        ) : null}

        <span className={cn(chip, 'bottom-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium')}>
          {kind === 'loop' ? <LoopIcon size={14} /> : <RouteIcon size={14} />}
          {kind === 'loop' ? t('saved.kindLoop') : t('saved.kindRoute')}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="min-w-0">
          {selecting ? (
            <label className="block cursor-pointer truncate font-semibold tracking-tight after:absolute after:inset-0 after:z-10 after:content-['']">
              <input type="checkbox" checked={isSelected} onChange={onToggle} className="sr-only" aria-label={route.name} />
              {route.name}
            </label>
          ) : (
            <Link
              to={`/saved/${route.id}`}
              className="block truncate font-semibold tracking-tight transition-colors duration-150 group-hover:text-accent focus-visible:outline-none after:absolute after:inset-0 after:content-['']"
            >
              {route.name}
            </Link>
          )}
          <p className="mt-0.5 text-xs text-muted">{formatRelative(route.created_at)}</p>
        </div>

        {result ? (
          <dl className="grid grid-cols-3 gap-2">
            <Metric label={t('metric.distance')} value={formatDistance(result.distance_km)} />
            <Metric label={t('metric.gain')} value={formatSigned(result.gain_m)} />
            {result.duration_min > 0 ? (
              <Metric label={t('metric.duration')} value={formatDuration(result.duration_min)} />
            ) : null}
          </dl>
        ) : null}

        {result?.score && segments.length > 0 ? (
          <div className="mt-auto flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted">{t('metric.surface')}</span>
              <span className="tnum font-medium">{formatScore(result.score.comfort, 0)}/100</span>
            </div>
            <div
              className="flex h-1.5 gap-0.5 overflow-hidden rounded-full"
              role="img"
              aria-label={segments
                .map((segment) => `${t(surfaceLabelKey(segment.key))} ${formatRatio(segment.share, 0)}`)
                .join(', ')}
            >
              {segments.map((segment) => (
                <span
                  key={segment.key}
                  style={{ flexGrow: Math.max(segment.share, 0.02), background: surfaceColor(resolved, segment.key) }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </li>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.4 6.4 11.3 12.5 5" />
    </svg>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted">{label}</dt>
      <dd className="tnum mt-0.5 truncate text-sm font-semibold">{value}</dd>
    </div>
  )
}

export function SavedCardSkeleton() {
  const block = 'animate-pulse rounded bg-surface-secondary'
  return (
    <li aria-hidden="true" className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
      <div className="aspect-[2/1] animate-pulse bg-surface-secondary" />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1.5">
          <div className={cn(block, 'h-4 w-2/3')} />
          <div className={cn(block, 'h-3 w-1/4')} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <div className={cn(block, 'h-3 w-3/4')} />
              <div className={cn(block, 'h-4 w-full')} />
            </div>
          ))}
        </div>
        <div className={cn(block, 'h-1.5 w-full rounded-full')} />
      </div>
    </li>
  )
}
