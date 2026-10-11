import { Button, Dropdown, Modal, Spinner, useOverlayState } from '@heroui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import * as savedRoutesApi from '@/api/savedRoutes'
import { useApiErrorMessage } from '@/components/common/apiErrorMessage'
import { ErrorState } from '@/components/common/errorState'
import { TextInput } from '@/components/common/field'
import { endpointMarkers } from '@/components/map/endpointMarkers'
import { LazyMap } from '@/components/map/lazyMap'
import type { MapMarker, RouteLayer } from '@/components/map/mapView'
import { ElevationProfile } from '@/components/route/elevationProfile'
import { MetricTiles } from '@/components/route/metricTiles'
import { ScoreCard } from '@/components/route/scoreCard'
import { SurfaceBar } from '@/components/route/surfaceBar'
import { dropdownTriggerClass } from '@/components/common/dropdownTrigger'
import { useProfileFocus } from '@/hooks/useProfileFocus'
import { downloadBlob, slugify } from '@/lib/download'
import { toGeoJson, toGpx } from '@/lib/exportLocal'
import { formatDate, formatPercent, formatRelative } from '@/lib/format'
import type { MapStyleId } from '@/lib/mapStyles'
import { decodePolyline } from '@/lib/polyline'
import { readSavedResult } from '@/lib/savedRoute'

export function SavedRouteDetailPage() {
  const { t } = useTranslation()
  const { focusPoint, onProfileHover } = useProfileFocus()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const describe = useApiErrorMessage()

  const [styleId, setStyleId] = useState<MapStyleId>('map')
  const [name, setName] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const renameDialog = useOverlayState()
  const deleteDialog = useOverlayState()

  const query = useQuery({
    queryKey: ['savedRoute', id],
    queryFn: () => savedRoutesApi.get(id),
    enabled: id.length > 0,
  })

  const rename = useMutation({
    mutationFn: (next: string) => savedRoutesApi.rename(id, next),
    onSuccess: async () => {
      renameDialog.close()
      await client.invalidateQueries({ queryKey: ['savedRoute', id] })
      await client.invalidateQueries({ queryKey: ['savedRoutes'] })
    },
    onError: (error) => setActionError(describe(error)),
  })

  const remove = useMutation({
    mutationFn: () => savedRoutesApi.remove(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['savedRoutes'] })
      void navigate('/saved')
    },
    onError: (error) => setActionError(describe(error)),
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
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          isIconOnly
          className="size-11"
          aria-label={t('common.back')}
          onPress={() => void navigate('/saved')}
        >
          <BackIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold">{route.name}</h1>
            <Button
              variant="ghost"
              isIconOnly
              className="size-11 shrink-0"
              aria-label={t('common.rename')}
              onPress={() => {
                setName(route.name)
                renameDialog.open()
              }}
            >
              <PencilIcon />
            </Button>
          </div>
          <p className="text-xs text-muted">
            {t('saved.savedOn', { date: formatDate(route.created_at) })}
            {route.updated_at !== route.created_at
              ? ` · ${t('saved.editedOn', { date: formatRelative(route.updated_at) })}`
              : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" className="min-h-11" onPress={() => void navigate('/loops')}>
            {t('saved.recompute')}
          </Button>
          {result ? (
            <Dropdown>
              <Dropdown.Trigger
                className={dropdownTriggerClass({ variant: 'primary' }, 'min-h-11')}
              >
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
          <Button variant="danger-soft" className="min-h-11" onPress={deleteDialog.open}>
            {t('common.delete')}
          </Button>
        </div>
      </header>

      {!result ? (
        <div className="mx-auto max-w-2xl p-8 text-center">
          <p className="text-sm text-muted">{t('saved.unreadable')}</p>
          <Link to="/saved" className="mt-4 inline-block text-sm font-semibold">
            {t('common.back')}
          </Link>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="h-[45vh] shrink-0 lg:h-auto lg:flex-1">
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

          <aside className="flex shrink-0 flex-col gap-6 overflow-y-auto border-border p-5 lg:w-[420px] lg:border-s">
            {actionError ? (
              <p className="text-sm text-danger" role="alert">
                {actionError}
              </p>
            ) : null}

            <MetricTiles result={result} />
            <ScoreCard score={result.cycling_score} />
            <SurfaceBar score={result.score} distanceKm={result.distance_km} />

            {result.score ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 text-sm">
                <div>
                  <dt className="text-xs text-muted">{t('metric.maxGrade')}</dt>
                  <dd className="tnum mt-0.5 font-semibold">
                    {formatPercent(result.score.max_grade_pct)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{t('metric.climbLoad')}</dt>
                  <dd className="tnum mt-0.5 font-semibold">
                    {Math.round(result.score.climb_load_m)} m
                  </dd>
                </div>
              </dl>
            ) : null}

            {result.profile && result.profile.length > 1 ? (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] text-muted">
                  {t('metric.elevationProfile')}
                </span>
                <ElevationProfile profile={result.profile} distanceKm={result.distance_km} onHover={onProfileHover} />
              </div>
            ) : null}
          </aside>
        </div>
      )}

      <Modal state={renameDialog}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{t('saved.renameTitle')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <TextInput
                  label={t('result.saveDialogName')}
                  value={name}
                  onChange={setName}
                  autoFocus
                  isRequired
                />
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button variant="ghost" className="min-h-11" onPress={renameDialog.close}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  className="min-h-11"
                  isDisabled={!name.trim() || rename.isPending}
                  onPress={() => rename.mutate(name.trim())}
                >
                  {t('common.save')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal state={deleteDialog}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{t('saved.deleteConfirmTitle')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">{t('saved.deleteConfirmBody')}</p>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button variant="ghost" className="min-h-11" onPress={deleteDialog.close}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="danger"
                  className="min-h-11"
                  isDisabled={remove.isPending}
                  onPress={() => remove.mutate()}
                >
                  {t('common.delete')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
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

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.2 2.6 13.4 4.8 5.6 12.6 2.6 13.4l.8-3 7.8-7.8Z" />
    </svg>
  )
}
