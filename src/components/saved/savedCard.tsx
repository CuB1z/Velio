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
import { useLangPath } from '@/lib/paths'

const lift = 'transition-[translate,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'

type Props = {
  route: SavedRoute
  isSelected: boolean
  selecting: boolean
  onToggle: () => void
}

export function SavedCard({ route, isSelected, selecting, onToggle }: Props) {
  const { t } = useTranslation()
  const to = useLangPath()
  const { resolved } = useTheme()
  const result = readSavedResult(route)
  const kind = savedRouteKind(route)
  const segments = result ? surfaceSegments(result.score, result.distance_km) : []
  const score = result?.cycling_score?.total

  return (
    <li
      className={cn(
        'group relative flex flex-col gap-5 rounded-3xl bg-surface p-5 ring-1',
        'hover:-translate-y-0.5 active:translate-y-0',
        'has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-accent',
        lift,
        isSelected ? 'ring-2 ring-accent' : 'ring-border hover:ring-foreground/20',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow inline-flex items-center gap-1.5">
          {kind === 'loop' ? <LoopIcon size={12} /> : <RouteIcon size={12} />}
          {kind === 'loop' ? t('saved.kindLoop') : t('saved.kindRoute')}
        </span>
        {score !== undefined ? (
          <span className="code text-sm font-semibold text-accent">
            {formatScore(score)}
            <span className="font-normal text-muted"> /10</span>
          </span>
        ) : null}
      </div>

      <div className="relative aspect-[2/1]">
        {result ? (
          <RouteThumbnail polyline={result.polyline} kind={kind} />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">
            {t('saved.unreadable')}
          </div>
        )}
      </div>

      {selecting ? (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute left-4 top-4 z-20 flex size-7 items-center justify-center rounded-full ring-2 transition-colors duration-150',
            isSelected ? 'bg-accent text-accent-foreground ring-accent' : 'bg-surface ring-border',
          )}
        >
          {isSelected ? <CheckIcon /> : null}
        </span>
      ) : null}

      <div className="flex flex-1 flex-col gap-4">
        <div className="min-w-0">
          {selecting ? (
            <label className="block cursor-pointer truncate text-lg font-semibold tracking-tight after:absolute after:inset-0 after:z-10 after:content-['']">
              <input type="checkbox" checked={isSelected} onChange={onToggle} className="sr-only" aria-label={route.name} />
              {route.name}
            </label>
          ) : (
            <Link
              to={to(`/saved/${route.id}`)}
              className="block truncate text-lg font-semibold tracking-tight transition-colors duration-150 group-hover:text-accent focus-visible:outline-none after:absolute after:inset-0 after:content-['']"
            >
              {route.name}
            </Link>
          )}
          <p className="eyebrow mt-1">{formatRelative(route.created_at)}</p>
        </div>

        {result ? (
          <dl className="grid grid-cols-3 gap-2 border-t border-border pt-4">
            <Metric label={t('metric.distance')} value={formatDistance(result.distance_km)} />
            <Metric label={t('metric.gain')} value={formatSigned(result.gain_m)} />
            {result.duration_min > 0 ? (
              <Metric label={t('metric.duration')} value={formatDuration(result.duration_min)} />
            ) : null}
          </dl>
        ) : null}

        {result?.score && segments.length > 0 ? (
          <div className="mt-auto flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">{t('metric.surface')}</span>
              <span className="code text-xs text-muted">
                <span className="font-semibold text-foreground">{formatScore(result.score.comfort, 0)}</span> / 100
              </span>
            </div>
            <div
              className="flex h-[3px] gap-[3px] overflow-hidden"
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
      <dt className="eyebrow truncate">{label}</dt>
      <dd className="code mt-1 truncate text-base font-medium">{value}</dd>
    </div>
  )
}

export function SavedCardSkeleton() {
  const block = 'animate-pulse rounded bg-surface-secondary'
  return (
    <li aria-hidden="true" className="flex flex-col gap-5 rounded-3xl bg-surface p-5 ring-1 ring-border">
      <div className={cn(block, 'h-3 w-1/3')} />
      <div className="aspect-[2/1] animate-pulse rounded-xl bg-surface-secondary" />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className={cn(block, 'h-5 w-2/3')} />
          <div className={cn(block, 'h-3 w-1/4')} />
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-border pt-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <div className={cn(block, 'h-3 w-3/4')} />
              <div className={cn(block, 'h-4 w-full')} />
            </div>
          ))}
        </div>
        <div className={cn(block, 'h-[3px] w-full')} />
      </div>
    </li>
  )
}
