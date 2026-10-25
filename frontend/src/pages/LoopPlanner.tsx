import { useOverlayState } from '@heroui/react'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { streamLoop } from '@/api/routing'
import { ErrorState } from '@/components/common/ErrorState'
import { AskCountryButton, RequestCountryDialog } from '@/components/coverage/RequestCountryDialog'
import { PlannerLayout } from '@/components/layout/PlannerLayout'
import { LazyMap } from '@/components/map/LazyMap'
import type { MapMarker, RouteLayer } from '@/components/map/MapView'
import { LoopForm } from '@/components/planner/LoopForm'
import { LoopProgress } from '@/components/planner/LoopProgress'
import {
  DEFAULT_LOOP_FORM,
  toLoopRequest,
  type LoopFormValue,
} from '@/components/planner/loopFormValue'
import { RouteResultPanel } from '@/components/route/RouteResultPanel'
import { formatDistance, formatRegions } from '@/lib/format'
import { minimumLoopKm } from '@/lib/geo'
import { useCoverage } from '@/hooks/useCoverage'
import { positionFailure, useInitialPosition, type PositionFailure } from '@/hooks/useInitialPosition'
import { useRetryAfter } from '@/hooks/useRetryAfter'
import { useProfileFocus } from '@/hooks/useProfileFocus'
import { MADRID_CENTER, mapFitPadding, type MapStyleId } from '@/lib/mapStyles'
import { decodePolyline } from '@/lib/polyline'
import { allVariants } from '@/lib/routeMetrics'
import type { AnyRouteResult, LatLon, LoopProgress as Progress, LoopResult } from '@/types/api'

export function LoopPlannerPage() {
  const { t } = useTranslation()
  const { focusPoint, onProfileHover } = useProfileFocus()
  const [form, setForm] = useState<LoopFormValue>(DEFAULT_LOOP_FORM)
  const [styleId, setStyleId] = useState<MapStyleId>('map')
  const [resultCollapsed, setResultCollapsed] = useState(false)
  const [pickTarget, setPickTarget] = useState<'origin' | number | null>(null)
  const [selected, setSelected] = useState(0)
  const [exportError, setExportError] = useState<string | null>(null)
  // Why the user's position is missing, if it is.
  const [positionNotice, setPositionNotice] = useState<PositionFailure | 'outside' | null>(null)
  const [pickedOutside, setPickedOutside] = useState(false)
  const { covers, isos } = useCoverage()
  const askDialog = useOverlayState()
  // Bumped to refit the map, only when a new result arrives.
  const [fitKey, setFitKey] = useState(0)
  // Centres the map on a point (the user's position).
  const [focus, setFocus] = useState<{ center: [number, number]; key: number }>()
  const abort = useRef<AbortController | null>(null)
  const [found, setFound] = useState<LoopResult[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)

  const mutation = useMutation({
    mutationFn: async (value: LoopFormValue) => {
      const request = toLoopRequest(value)
      if (!request) throw new Error('origin not set')
      abort.current?.abort()
      abort.current = new AbortController()
      let announced = 0
      const result = await streamLoop(request, {
        signal: abort.current.signal,
        onProgress: setProgress,
        onLoop: (loop) => {
          announced += 1
          setFound((current) => [...current, loop])
          if (announced === 1) setFitKey((current) => current + 1)
        },
      })
      setFitKey((current) => current + 1)
      return result
    },
    onMutate: () => {
      setFound([])
      setProgress(null)
      setSelected(0)
    },
    onSuccess: () => setSelected(0),
    onSettled: () => setProgress(null),
  })

  const variants: AnyRouteResult[] = useMemo(
    () => (mutation.data ? allVariants(mutation.data as AnyRouteResult) : (found as AnyRouteResult[])),
    [mutation.data, found],
  )
  const cancelled = mutation.error instanceof DOMException && mutation.error.name === 'AbortError'
  const retryIn = useRetryAfter(mutation.error)
  const requestedLoops = mutation.variables ? mutation.variables.alternatives + 1 : 1

  const routes: RouteLayer[] = useMemo(
    () =>
      variants.map((variant, index) => ({
        id: `loop-${index}`,
        coordinates: decodePolyline(variant.polyline),
        colorIndex: index,
        selected: index === selected,
      })),
    [variants, selected],
  )

  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = []
    if (form.origin) {
      list.push({
        id: 'origin',
        coordinate: [form.origin.lon, form.origin.lat],
        kind: 'start',
      })
    }
    form.via.forEach((point, index) => {
      list.push({
        id: `via-${index}`,
        coordinate: [point.lon, point.lat],
        kind: 'via',
        label: String(index + 1),
      })
    })
    return list
  }, [form.origin, form.via])

  async function handleMapClick(coordinate: [number, number]) {
    if (pickTarget === null) return
    const point = { lat: coordinate[1], lon: coordinate[0] }
    if (!(await covers(point))) {
      setPickedOutside(true)
      return
    }
    setPickedOutside(false)
    if (pickTarget === 'origin') {
      setForm((current) => ({ ...current, origin: point }))
    } else {
      setForm((current) => ({
        ...current,
        via: current.via.map((item, index) => (index === pickTarget ? point : item)),
      }))
    }
    setPickTarget(null)
  }

  function placeOrigin(position: LatLon) {
    setForm((current) => ({ ...current, origin: position }))
    setFocus({ center: [position.lon, position.lat], key: Date.now() })
  }

  // On load, use the browser position unless the user already changed the origin.
  useInitialPosition(
    async (position) => {
      if (!(await covers(position))) {
        setPositionNotice('outside')
        return
      }
      setPositionNotice(null)
      setForm((current) => {
        const untouched =
          current.origin?.lat === MADRID_CENTER.lat && current.origin?.lon === MADRID_CENTER.lon
        return untouched ? { ...current, origin: position } : current
      })
      setFocus({ center: [position.lon, position.lat], key: Date.now() })
    },
    setPositionNotice,
  )

  function locate() {
    if (!navigator.geolocation) {
      setPositionNotice('unsupported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const point = { lat: position.coords.latitude, lon: position.coords.longitude }
        if (!(await covers(point))) {
          setPositionNotice('outside')
          return
        }
        setPositionNotice(null)
        placeOrigin(point)
      },
      (error) => {
        console.warn('[velio] geolocation failed', error.code, error.message)
        setPositionNotice(positionFailure(error))
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  const request = toLoopRequest(form)
  const defaultName = `${formatDistance(form.distanceKm)} · ${t(`bike.${form.bike}`)}`

  return (
    <>
      <PlannerLayout
        resultCollapsed={resultCollapsed}
        onResultCollapsedChange={setResultCollapsed}
        heading={
          <>
            <span className="eyebrow">{t('planner.loopEyebrow')}</span>
            <h1 className="text-2xl font-semibold tracking-tight">{t('planner.loopTitle')}</h1>
          </>
        }
        form={
          <div className="flex flex-col gap-4">
            <LoopForm
              value={form}
              onChange={setForm}
              onSubmit={() => mutation.mutate(form)}
              onCancel={() => abort.current?.abort()}
              isBusy={mutation.isPending}
              retryIn={retryIn}
              pickTarget={pickTarget}
              onPick={(target) => {
                setPickedOutside(false)
                setPickTarget(target)
              }}
              onLocate={locate}
            />
            {mutation.error && !cancelled ? <ErrorState error={mutation.error} /> : null}
            {exportError ? (
              <p className="text-sm text-danger" role="alert">
                {exportError}
              </p>
            ) : null}
            {positionNotice ? (
              <p className="text-sm text-muted" role="status">
                {t(`map.position.${positionNotice}`, { regions: formatRegions(isos) })}
                {positionNotice === 'outside' ? (
                  <span className="mt-2 flex">
                    <AskCountryButton onPress={askDialog.open} />
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        }
        mapNotice={
          pickTarget === null
            ? null
            : pickedOutside
              ? (
                  <>
                    {t('map.position.pickedOutside', { regions: formatRegions(isos) })}
                    <span className="mt-2 flex justify-center">
                      <AskCountryButton onPress={askDialog.open} className="pointer-events-auto" />
                    </span>
                  </>
                )
              : t('map.pickOnMapHint')
        }
        map={
          <LazyMap
            className="h-full w-full"
            styleId={styleId}
            onStyleChange={setStyleId}
            routes={routes}
            markers={markers}
            focusPoint={focusPoint}
            fitKey={fitKey}
            focus={focus}
            // The result panel floats over the map; without this padding the route is fitted behind it.
            fitPadding={mapFitPadding(variants.length > 0, resultCollapsed)}
            onMapClick={handleMapClick}
            isPicking={pickTarget !== null}
            onLocate={locate}
          />
        }
        result={
          variants.length > 0 || mutation.isPending ? (
            <div className="flex flex-col gap-4">
              {mutation.isPending ? (
                <LoopProgress progress={progress} found={found.length} requested={requestedLoops} />
              ) : null}
              {variants.length > 0 && request ? (
                <RouteResultPanel
                  onProfileHover={onProfileHover}
                  variants={variants}
                  selected={selected}
                  onSelect={setSelected}
                  endpoint="loops"
                  request={request}
                  defaultName={defaultName}
                  requested={mutation.data ? requestedLoops : undefined}
                  targetKm={form.distanceKm}
                  // No gain target unless requested: an unasked-for "+900 m" reads as a failure.
                  targetGainM={form.gainEnabled ? form.gainM : undefined}
                  minimumKm={minimumLoopKm(form.origin, form.via)}
                  onError={setExportError}
                />
              ) : null}
            </div>
          ) : undefined
        }
      />
      <RequestCountryDialog state={askDialog} />
    </>
  )
}
