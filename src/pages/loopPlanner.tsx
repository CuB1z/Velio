import { useMutation } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { createLoop } from '@/api/routing'
import { ErrorState } from '@/components/common/errorState'
import { PlannerLayout } from '@/components/layout/plannerLayout'
import { LazyMap } from '@/components/map/lazyMap'
import type { MapMarker, RouteLayer } from '@/components/map/mapView'
import { LoopForm } from '@/components/planner/loopForm'
import {
  DEFAULT_LOOP_FORM,
  toLoopRequest,
  type LoopFormValue,
} from '@/components/planner/loopFormValue'
import { RouteResultPanel } from '@/components/route/routeResultPanel'
import { formatDistance } from '@/lib/format'
import { minimumLoopKm } from '@/lib/geo'
import { positionFailure, useInitialPosition, type PositionFailure } from '@/hooks/useInitialPosition'
import { MADRID_CENTER, mapFitPadding, type MapStyleId } from '@/lib/mapStyles'
import { decodePolyline } from '@/lib/polyline'
import { allVariants } from '@/lib/routeMetrics'
import type { AnyRouteResult, LatLon, LoopResult } from '@/types/api'

export function LoopPlannerPage() {
  const { t } = useTranslation()
  const [form, setForm] = useState<LoopFormValue>(DEFAULT_LOOP_FORM)
  const [styleId, setStyleId] = useState<MapStyleId>('map')
  const [resultCollapsed, setResultCollapsed] = useState(false)
  const [pickTarget, setPickTarget] = useState<'origin' | number | null>(null)
  const [selected, setSelected] = useState(0)
  const [exportError, setExportError] = useState<string | null>(null)
  // Por qué no tenemos la posición del usuario, si no la tenemos.
  const [positionNotice, setPositionNotice] = useState<PositionFailure | null>(null)
  // Señal explícita de reencuadre: solo al llegar un resultado nuevo.
  const [fitKey, setFitKey] = useState(0)
  // Encuadre explícito del mapa sobre un punto (la posición del usuario).
  const [focus, setFocus] = useState<{ center: [number, number]; key: number }>()
  const abort = useRef<AbortController | null>(null)

  const mutation = useMutation({
    mutationFn: (value: LoopFormValue) => {
      const request = toLoopRequest(value)
      if (!request) throw new Error('origen sin definir')
      abort.current?.abort()
      abort.current = new AbortController()
      return createLoop(request, abort.current.signal)
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

  function handleMapClick(coordinate: [number, number]) {
    if (pickTarget === null) return
    const point = { lat: coordinate[1], lon: coordinate[0] }
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

  // Al cargar: la posición del navegador si la da, y solo si el usuario no ha
  // escrito ya otro origen mientras llegaba. Si no, se queda Madrid centro.
  useInitialPosition(
    (position) => {
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
      (position) => {
        setPositionNotice(null)
        placeOrigin({ lat: position.coords.latitude, lon: position.coords.longitude })
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
    <PlannerLayout
      resultCollapsed={resultCollapsed}
      onResultCollapsedChange={setResultCollapsed}
      form={
        <div className="flex flex-col gap-4">
          <LoopForm
            value={form}
            onChange={setForm}
            onSubmit={() => mutation.mutate(form)}
            onCancel={() => abort.current?.abort()}
            isBusy={mutation.isPending}
            pickTarget={pickTarget}
            onPick={setPickTarget}
            onLocate={locate}
          />
          {mutation.error ? <ErrorState error={mutation.error} /> : null}
          {exportError ? (
            <p className="text-sm text-danger" role="alert">
              {exportError}
            </p>
          ) : null}
          {positionNotice ? (
            <p className="text-sm text-muted" role="status">
              {t(`map.position.${positionNotice}`)}
            </p>
          ) : null}
          {pickTarget !== null ? (
            <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm">
              {t('map.pickOnMapHint')}
            </p>
          ) : null}
        </div>
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
          // El panel de resultado flota sobre el mapa: sin este hueco la
          // ruta se encuadra centrada y queda detrás de él.
          fitPadding={mapFitPadding(variants.length > 0, resultCollapsed)}
          onMapClick={handleMapClick}
          isPicking={pickTarget !== null}
          onLocate={locate}
        />
      }
      result={
        variants.length > 0 && request ? (
          <RouteResultPanel
            variants={variants}
            selected={selected}
            onSelect={setSelected}
            endpoint="loops"
            request={request}
            defaultName={defaultName}
            profile={(mutation.data as LoopResult | undefined)?.profile}
            targetKm={form.distanceKm}
            // Sin objetivo de desnivel no se muestra ninguno: enseñar "+900 m"
            // cuando no se ha pedido hace que el resultado parezca un fallo.
            targetGainM={form.gainEnabled ? form.gainM : undefined}
            minimumKm={minimumLoopKm(form.origin, form.via)}
            onError={setExportError}
          />
        ) : undefined
      }
    />
  )
}
