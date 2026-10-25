import { Button, Switch, useOverlayState } from '@heroui/react'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { createRoute } from '@/api/routing'
import { ErrorState } from '@/components/common/ErrorState'
import { AskCountryButton, RequestCountryDialog } from '@/components/coverage/RequestCountryDialog'
import { PlannerLayout } from '@/components/layout/PlannerLayout'
import { LazyMap } from '@/components/map/LazyMap'
import type { MapMarker, RouteLayer } from '@/components/map/MapView'
import { BikePicker } from '@/components/planner/BikePicker'
import { SliderField } from '@/components/planner/SliderField'
import { WaypointEditor } from '@/components/planner/WaypointEditor'
import { InsetGroup, InsetRow } from '@/components/common/InsetGroup'
import { RouteResultPanel } from '@/components/route/RouteResultPanel'
import { useCoverage } from '@/hooks/useCoverage'
import { useInitialPosition } from '@/hooks/useInitialPosition'
import { useRetryAfter } from '@/hooks/useRetryAfter'
import { useProfileFocus } from '@/hooks/useProfileFocus'
import { formatRegions } from '@/lib/format'
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
  const { focusPoint, onProfileHover } = useProfileFocus()
  const [waypoints, setWaypoints] = useState<LatLon[]>(DEFAULT_WAYPOINTS)
  const [focus, setFocus] = useState<{ center: [number, number]; key: number }>()
  const [positionOutside, setPositionOutside] = useState(false)
  const [pickedOutside, setPickedOutside] = useState(false)
  const { covers, isos } = useCoverage()
  const askDialog = useOverlayState()
  // Browser position replaces the first point unless the user already edited the list.
  useInitialPosition(async (position) => {
    if (!(await covers(position))) {
      setPositionOutside(true)
      return
    }
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
  const retryIn = useRetryAfter(mutation.error)

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

  async function handleMapClick(coordinate: [number, number]) {
    if (pickTarget === null) return
    const point = { lat: coordinate[1], lon: coordinate[0] }
    if (!(await covers(point))) {
      setPickedOutside(true)
      return
    }
    setPickedOutside(false)
    setWaypoints((current) => current.map((item, index) => (index === pickTarget ? point : item)))
    setPickTarget(null)
  }

  const name = `${t('nav.routes')} · ${t(`bike.${bike}`)}`

  return (
    <>
      <PlannerLayout
        resultCollapsed={resultCollapsed}
        onResultCollapsedChange={setResultCollapsed}
        heading={
          <>
            <span className="eyebrow">{t('planner.routeEyebrow')}</span>
            <h1 className="text-2xl font-semibold tracking-tight">{t('planner.routeTitle')}</h1>
          </>
        }
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
              onPick={(target) => {
                setPickedOutside(false)
                setPickTarget(target)
              }}
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

            <div className="sticky bottom-0 z-10 mt-auto flex gap-2 bg-overlay py-4 lg:bg-background">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                className="min-h-12 text-base font-semibold"
                isDisabled={waypoints.length < 2 || mutation.isPending || retryIn > 0}
              >
                {mutation.isPending
                  ? t('planner.generating')
                  : retryIn > 0
                    ? t('common.retryIn', { seconds: retryIn })
                    : t('planner.generateRoute')}
              </Button>
              {mutation.isPending ? (
                <Button variant="ghost" className="min-h-11" onPress={() => abort.current?.abort()}>
                  {t('common.cancel')}
                </Button>
              ) : null}
            </div>

            {mutation.error ? <ErrorState error={mutation.error} /> : null}
            {positionOutside ? (
              <p className="text-sm text-muted" role="status">
                {t('map.position.outside', { regions: formatRegions(isos) })}
                <span className="mt-2 flex">
                  <AskCountryButton onPress={askDialog.open} />
                </span>
              </p>
            ) : null}
            {exportError ? (
              <p className="text-sm text-danger" role="alert">
                {exportError}
              </p>
            ) : null}
          </form>
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
          />
        }
        result={
          variants.length > 0 ? (
            <RouteResultPanel
              onProfileHover={onProfileHover}
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
      <RequestCountryDialog state={askDialog} />
    </>
  )
}
