import { Button, Switch } from '@heroui/react'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { createRoute } from '@/api/routing'
import { ErrorState } from '@/components/common/errorState'
import { PlannerLayout } from '@/components/layout/plannerLayout'
import { LazyMap } from '@/components/map/lazyMap'
import type { MapMarker, RouteLayer } from '@/components/map/mapView'
import { BikePicker } from '@/components/planner/bikePicker'
import { SliderField } from '@/components/planner/sliderField'
import { WaypointEditor } from '@/components/planner/waypointEditor'
import { InsetGroup, InsetRow } from '@/components/common/insetGroup'
import { RouteResultPanel } from '@/components/route/routeResultPanel'
import { useInitialPosition } from '@/hooks/useInitialPosition'
import { mapFitPadding, type MapStyleId } from '@/lib/mapStyles'
import { decodePolyline } from '@/lib/polyline'
import { allVariants } from '@/lib/routeMetrics'
import type {
  AnyRouteResult,
  BikeType,
  HillsPreference,
  LatLon,
  RouteRequest,
} from '@/types/api'

const DEFAULT_WAYPOINTS: LatLon[] = [
  { lat: 40.4168, lon: -3.7038 },
  { lat: 40.785, lon: -3.96 },
]

export function RoutePlannerPage() {
  const { t } = useTranslation()
  const [waypoints, setWaypoints] = useState<LatLon[]>(DEFAULT_WAYPOINTS)
  const [focus, setFocus] = useState<{ center: [number, number]; key: number }>()
  // Browser position replaces the first point unless the user already edited the list.
  useInitialPosition((position) => {
    setWaypoints((current) => (current === DEFAULT_WAYPOINTS ? [position, ...current.slice(1)] : current))
    setFocus({ center: [position.lon, position.lat], key: Date.now() })
  })
  const [bike, setBike] = useState<BikeType>('road')
  const [hills, setHills] = useState<HillsPreference>('rolling')
  const [alternatives, setAlternatives] = useState(2)
  const [includeProfile, setIncludeProfile] = useState(true)
  const [styleId, setStyleId] = useState<MapStyleId>('map')
  const [resultCollapsed, setResultCollapsed] = useState(false)
  const [pickTarget, setPickTarget] = useState<number | null>(null)
  const [selected, setSelected] = useState(0)
  const [fitKey, setFitKey] = useState(0)
  const [exportError, setExportError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  const request: RouteRequest = useMemo(
    () => ({
      waypoints,
      bike,
      hills,
      include_profile: includeProfile,
      alternatives: alternatives > 0 ? alternatives : undefined,
    }),
    [waypoints, bike, hills, includeProfile, alternatives],
  )

  const mutation = useMutation({
    mutationFn: () => {
      abort.current?.abort()
      abort.current = new AbortController()
      return createRoute(request, abort.current.signal)
    },
    onSuccess: () => {
      setSelected(0)
      setFitKey((current) => current + 1)
    },
  })

  const variants: AnyRouteResult[] = useMemo(
    () => (mutation.data ? allVariants(mutation.data as AnyRouteResult) : []),
    [mutation.data],
  )

  const routes: RouteLayer[] = useMemo(
    () =>
      variants.map((variant, index) => ({
        id: `route-${index}`,
        coordinates: decodePolyline(variant.polyline),
        colorIndex: index,
        selected: index === selected,
      })),
    [variants, selected],
  )

  const markers: MapMarker[] = useMemo(
    () =>
      waypoints.map((point, index) => ({
        id: `wp-${index}`,
        coordinate: [point.lon, point.lat] as [number, number],
        kind: index === 0 ? 'start' : index === waypoints.length - 1 ? 'end' : 'via',
        label: String.fromCharCode(65 + index),
      })),
    [waypoints],
  )

  function handleMapClick(coordinate: [number, number]) {
    if (pickTarget === null) return
    setWaypoints((current) =>
      current.map((item, index) =>
        index === pickTarget ? { lat: coordinate[1], lon: coordinate[0] } : item,
      ),
    )
    setPickTarget(null)
  }

  const name = `${t('nav.routes')} · ${t(`bike.${bike}`)}`

  return (
    <PlannerLayout
      resultCollapsed={resultCollapsed}
      onResultCollapsedChange={setResultCollapsed}
      form={
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            mutation.mutate()
          }}
        >
          <WaypointEditor
            value={waypoints}
            onChange={setWaypoints}
            pickTarget={pickTarget}
            onPick={setPickTarget}
          />

          <BikePicker bike={bike} hills={hills} onBikeChange={setBike} onHillsChange={setHills} />

          <InsetGroup>
            <InsetRow stacked>
              <SliderField
                label={t('planner.alternatives')}
                value={alternatives}
                onChange={setAlternatives}
                min={0}
                max={2}
                display={String(alternatives)}
              />
            </InsetRow>
            <InsetRow>
              <Switch
                isSelected={includeProfile}
                onChange={setIncludeProfile}
                className="flex min-h-11 w-full items-center"
              >
                <Switch.Content className="flex w-full items-center justify-between gap-3">
                  <span className="text-[15px]">{t('planner.includeProfile')}</span>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </InsetRow>
          </InsetGroup>

          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              fullWidth
              className="min-h-11 text-[15px] font-semibold"
              isDisabled={waypoints.length < 2 || mutation.isPending}
            >
              {mutation.isPending ? t('planner.generating') : t('planner.generateRoute')}
            </Button>
            {mutation.isPending ? (
              <Button variant="ghost" className="min-h-11" onPress={() => abort.current?.abort()}>
                {t('common.cancel')}
              </Button>
            ) : null}
          </div>

          {mutation.error ? <ErrorState error={mutation.error} /> : null}
          {exportError ? (
            <p className="text-sm text-danger" role="alert">
              {exportError}
            </p>
          ) : null}
          {pickTarget !== null ? (
            <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm">
              {t('map.pickOnMapHint')}
            </p>
          ) : null}
        </form>
      }
      map={
        <LazyMap
          className="h-full w-full"
          styleId={styleId}
          onStyleChange={setStyleId}
          routes={routes}
          markers={markers}
          fitKey={fitKey}
          focus={focus}
          // The result panel floats over the map; without this padding the route is fitted behind it.
          fitPadding={mapFitPadding(variants.length > 0, resultCollapsed)}
          onMapClick={handleMapClick}
          isPicking={pickTarget !== null}
        />
      }
      result={
        variants.length > 0 ? (
          <RouteResultPanel
            variants={variants}
            selected={selected}
            onSelect={setSelected}
            endpoint="routes"
            request={request}
            defaultName={name}
            onError={setExportError}
          />
        ) : undefined
      }
    />
  )
}
