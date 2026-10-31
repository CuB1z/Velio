import { Button, Dropdown, Spinner, useOverlayState } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import * as savedRoutesApi from '@/api/savedRoutes'
import { ErrorState } from '@/components/common/ErrorState'
import { LazyMap } from '@/components/map/LazyMap'
import type { MapMarker, RouteLayer } from '@/components/map/MapView'
import { ElevationProfile } from '@/components/route/ElevationProfile'
import { MetricTiles } from '@/components/route/MetricTiles'
import { ScoreCard } from '@/components/route/ScoreCard'
import { SurfaceBar } from '@/components/route/SurfaceBar'
import { SavedRouteMenu, type SavedRouteAction } from '@/components/saved/SavedRouteMenu'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useProfileFocus } from '@/hooks/useProfileFocus'
import { downloadBlob, slugify } from '@/lib/download'
import { dropdownTriggerClass } from '@/lib/dropdownTrigger'
import { endpointMarkers } from '@/lib/endpointMarkers'
import { toGeoJson, toGpx } from '@/lib/exportLocal'
import { formatDate, formatPercent, formatRelative } from '@/lib/format'
import type { MapStyleId } from '@/lib/mapStyles'
import { useLangPath } from '@/lib/paths'
import { decodePolyline } from '@/lib/polyline'
import { readSavedResult } from '@/lib/savedRoute'

const PHONE_ACTIONS: SavedRouteAction[] = ['rename', 'recompute', 'gpx', 'geojson', 'delete']
const DESKTOP_ACTIONS: SavedRouteAction[] = ['rename', 'recompute', 'delete']

export function SavedRouteDetailPage() {
  const { t } = useTranslation()
  const { focusPoint, onProfileHover } = useProfileFocus()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const to = useLangPath()
  const phone = useMediaQuery('(width < 48rem)')
  const menu = useOverlayState()

  const [styleId, setStyleId] = useState<MapStyleId>('map')

  const query = useQuery({
    queryKey: ['savedRoute', id],
    queryFn: () => savedRoutesApi.get(id),
    enabled: id.length > 0,
  })

  const result = useMemo(() => (query.data ? readSavedResult(query.data) : null), [query.data])

  const routes: RouteLayer[] = useMemo(
    () =>
      result
        ? [{ id: 'saved', coordinates: decodePolyline(result.polyline), colorIndex: 0, selected: true }]
        : [],
    [result],
  )

  const markers: MapMarker[] = useMemo(
    () => (result ? endpointMarkers(decodePolyline(result.polyline)) : []),
    [result],
  )

  if (query.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner aria-label={t('common.loading')} />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    )
  }

  const route = query.data

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-2 px-2 py-2 sm:px-4 sm:py-3 lg:px-6">
        <Button
          variant="ghost"
          isIconOnly
          className="size-11 shrink-0"
          aria-label={t('common.back')}
          onPress={() => void navigate(to('/saved'))}
        >
          <BackIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{route.name}</h1>
          <p className="eyebrow truncate">
            {t('saved.savedOn', { date: formatDate(route.created_at) })}
            {route.updated_at !== route.created_at
              ? ` · ${t('saved.editedOn', { date: formatRelative(route.updated_at) })}`
              : ''}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {result && !phone ? (
            <Dropdown>
              <Dropdown.Trigger className={dropdownTriggerClass({ variant: 'primary' }, 'min-h-11')}>
                {t('result.export')}
              </Dropdown.Trigger>
              <Dropdown.Popover>
                <Dropdown.Menu
                  onAction={(key) => {
                    const filename = slugify(route.name)
                    if (key === 'gpx') downloadBlob(toGpx(result, route.name), `${filename}.gpx`)
                    if (key === 'geojson') {
                      downloadBlob(toGeoJson(result, route.name), `${filename}.geojson`)
                    }
                  }}
                >
                  <Dropdown.Item id="gpx">{t('result.exportGpx')}</Dropdown.Item>
                  <Dropdown.Item id="geojson">{t('result.exportGeojson')}</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          ) : null}
          <SavedRouteMenu
            route={route}
            actions={phone ? PHONE_ACTIONS : DESKTOP_ACTIONS}
            state={menu}
            onRecompute={() => void navigate(to('/loops'))}
            onDeleted={() => void navigate(to('/saved'))}
          />
        </div>
      </header>

      {!result ? (
        <div className="mx-auto max-w-2xl p-8 text-center">
          <p className="text-sm text-muted">{t('saved.unreadable')}</p>
          <Link to={to('/saved')} className="mt-4 inline-block text-sm font-semibold">
            {t('common.back')}
          </Link>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="h-[calc(45svh+1.5rem)] shrink-0 max-lg:[&_.maplibregl-ctrl-bottom-left]:mb-6 max-lg:[&_.maplibregl-ctrl-bottom-right]:mb-6 lg:h-auto lg:flex-1 lg:overflow-hidden lg:rounded-e-3xl lg:ring-1 lg:ring-border">
            <LazyMap
              className="h-full w-full"
              styleId={styleId}
              onStyleChange={setStyleId}
              routes={routes}
              markers={markers}
              focusPoint={focusPoint}
              fitKey={route.id}
            />
          </div>

          <aside className="relative z-10 -mt-6 flex shrink-0 flex-col rounded-t-3xl bg-background ring-1 ring-border lg:mt-0 lg:h-full lg:w-[420px] lg:overflow-hidden lg:rounded-none lg:ring-0">
            <div className="panel-scroll flex flex-col gap-6 p-5 lg:min-h-0 lg:overflow-y-auto lg:px-7 lg:pb-6 lg:pt-2">
              <MetricTiles result={result} className="sm:grid-cols-2" />
              <ScoreCard score={result.cycling_score} className="border-t border-border pt-6" />
              <SurfaceBar score={result.score} distanceKm={result.distance_km} className="border-t border-border pt-6" />

              {result.score ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-6">
                  <div className="flex flex-col gap-1">
                    <dt className="eyebrow">{t('metric.maxGrade')}</dt>
                    <dd className="tnum text-2xl font-medium tracking-tight">
                      {formatPercent(result.score.max_grade_pct)}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="eyebrow">{t('metric.climbLoad')}</dt>
                    <dd className="tnum text-2xl font-medium tracking-tight">
                      {Math.round(result.score.climb_load_m)} m
                    </dd>
                  </div>
                </dl>
              ) : null}

              {result.profile && result.profile.length > 1 ? (
                <div className="flex flex-col gap-3 border-t border-border pt-6">
                  <span className="eyebrow">{t('metric.elevationProfile')}</span>
                  <ElevationProfile profile={result.profile} distanceKm={result.distance_km} onHover={onProfileHover} />
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 3.5 5.5 8l4 4.5" />
    </svg>
  )
}
