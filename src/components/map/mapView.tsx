import {
  Map as MapLibreMap,
  Marker,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapMouseEvent,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { cn } from '@/lib/cn'
import { useTheme } from '@/hooks/useTheme'
import { accent, categorical, ink, status } from '@/lib/chartPalette'
import { DEFAULT_CENTER, DEFAULT_ZOOM, styleFor, type MapStyleId } from '@/lib/mapStyles'
import { MapControls } from './mapControls'
import type { LngLat } from '@/lib/polyline'
import { boundsOf } from '@/lib/polyline'

const ROUTES_SOURCE = 'velio-routes'
const LAYER_CASING = 'velio-routes-casing'
const LAYER_LINE = 'velio-routes-line'
const LAYER_SELECTED_CASING = 'velio-routes-selected-casing'
const LAYER_SELECTED_LINE = 'velio-routes-selected-line'

export type RouteLayer = {
  id: string
  coordinates: LngLat[]
  /** Ranura fija de la paleta categórica: el color pertenece a la variante, no a su orden. */
  colorIndex: number
  selected: boolean
}

export type MapMarker = {
  id: string
  coordinate: LngLat
  kind: 'start' | 'end' | 'via'
  label?: string
}

export type MapViewProps = {
  /**
   * Punto al que llevar la vista. Se aplica cuando cambia `key`, no cuando
   * cambia el punto: así fijar el origen con un clic no mueve el mapa, pero
   * localizar al usuario sí lo encuadra.
   */
  focus?: { center: [number, number]; key: number }
  styleId: MapStyleId
  routes?: RouteLayer[]
  markers?: MapMarker[]
  /** Cambiar este valor vuelve a encuadrar. Un contador o el id del resultado. */
  fitKey?: string | number
  /**
   * Margen del encuadre, en píxeles. El panel de resultado flota sobre el
   * mapa, así que sin un margen inferior mayor la ruta se encuadra centrada y
   * queda escondida detrás de él.
   */
  fitPadding?: { top: number; right: number; bottom: number; left: number }
  onMapClick?: (coordinate: LngLat) => void
  isPicking?: boolean
  className?: string
  /** Muestra los controles superpuestos (estilo, zoom, encuadre, ubicación). */
  onStyleChange?: (id: MapStyleId) => void
  onLocate?: () => void
}

/** Los colores salen de la paleta, no a mano: el marcador de paso y el de
 *  final iban en el azul del tema anterior mientras el trazado ya era verde
 *  azulado, y el aro usaba un gris que no es la superficie de ningún tema. */
function markerElement(marker: MapMarker, dark: boolean): HTMLElement {
  const mode = dark ? 'dark' : 'light'
  const surface = ink(mode).surface
  const brand = accent(mode)
  const el = document.createElement('div')
  el.className = 'velio-marker'
  el.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'width:26px',
    'height:26px',
    'border-radius:999px',
    'font:600 11px/1 var(--font-sans, system-ui)',
    `border:2.5px solid ${surface}`,
    'box-shadow:0 1px 6px rgba(0,0,0,.35)',
    'cursor:default',
  ].join(';')

  if (marker.kind === 'start') {
    el.style.background = status(mode, 'good')
    el.style.color = surface
  } else if (marker.kind === 'end') {
    el.style.background = brand
    el.style.color = surface
  } else {
    el.style.background = surface
    el.style.color = brand
    el.style.borderColor = brand
  }

  el.textContent = marker.label ?? ''
  el.setAttribute('aria-hidden', 'true')
  return el
}

export function MapView({
  styleId,
  routes = [],
  focus,
  markers = [],
  fitKey,
  fitPadding,
  onMapClick,
  isPicking = false,
  className,
  onStyleChange,
  onLocate,
}: MapViewProps) {
  const container = useRef<HTMLDivElement | null>(null)
  const map = useRef<MapLibreMap | null>(null)
  const markerRefs = useRef<Marker[]>([])
  const clickHandler = useRef(onMapClick)
  clickHandler.current = onMapClick

  const { resolved } = useTheme()
  const dark = resolved === 'dark'

  const collection = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: routes
        .filter((route) => route.coordinates.length > 1)
        .map((route) => ({
          type: 'Feature' as const,
          properties: {
            id: route.id,
            colorIndex: route.colorIndex,
            selected: route.selected ? 1 : 0,
          },
          geometry: { type: 'LineString' as const, coordinates: route.coordinates },
        })),
    }),
    [routes],
  )

  // Expresión data-driven: el color sale de la ranura, no del orden de pintado.
  const colorExpression = useMemo(() => {
    const cases: unknown[] = ['match', ['get', 'colorIndex']]
    for (let slot = 0; slot < 5; slot += 1) cases.push(slot, categorical(resolved, slot))
    cases.push(categorical(resolved, 0))
    return cases
  }, [resolved])

  // Creación única. El estilo y las capas se sincronizan en efectos aparte.
  useEffect(() => {
    if (!container.current || map.current) return

    const instance = new MapLibreMap({
      container: container.current,
      style: styleFor(styleId, dark),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
      // El grafo del backend es España: no tiene sentido dejar navegar más lejos.
      maxBounds: [
        [-19.5, 26.5],
        [5.5, 44.5],
      ],
    })

    instance.on('click', (event: MapMouseEvent) => {
      clickHandler.current?.([event.lngLat.lng, event.lngLat.lat])
    })

    map.current = instance
    return () => {
      instance.remove()
      map.current = null
    }
    // Solo al montar: cambiar estilo o tema no debe recrear el mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sembrar fuente y capas.
  //
  // `styledata` (no `once`) es la señal fiable: se dispara cuando el primer
  // estilo termina de cargar y otra vez tras cada cambio de estilo, que borra
  // fuentes y capas. `ensure` es idempotente, así que puede correr de más.
  useEffect(() => {
    const instance = map.current
    if (!instance) return

    const ensure = () => {
      if (!instance.isStyleLoaded()) return

      if (!instance.getSource(ROUTES_SOURCE)) {
        instance.addSource(ROUTES_SOURCE, { type: 'geojson', data: collection })
      }

      const surface = ink(resolved).surface
      const common = { source: ROUTES_SOURCE, type: 'line' as const }
      const layout = { 'line-cap': 'round' as const, 'line-join': 'round' as const }

      // Las descartadas van debajo y más finas; la elegida encima y con realce.
      if (!instance.getLayer(LAYER_CASING)) {
        instance.addLayer({
          ...common,
          id: LAYER_CASING,
          filter: ['==', ['get', 'selected'], 0],
          layout,
          paint: { 'line-color': surface, 'line-width': 5, 'line-opacity': 0.6 },
        })
      }
      if (!instance.getLayer(LAYER_LINE)) {
        instance.addLayer({
          ...common,
          id: LAYER_LINE,
          filter: ['==', ['get', 'selected'], 0],
          layout,
          paint: {
            'line-color': colorExpression as never,
            'line-width': 2.5,
            'line-opacity': 0.75,
            'line-dasharray': [2, 1.5],
          },
        })
      }
      if (!instance.getLayer(LAYER_SELECTED_CASING)) {
        instance.addLayer({
          ...common,
          id: LAYER_SELECTED_CASING,
          filter: ['==', ['get', 'selected'], 1],
          layout,
          paint: { 'line-color': surface, 'line-width': 8, 'line-opacity': 0.85 },
        })
      }
      if (!instance.getLayer(LAYER_SELECTED_LINE)) {
        instance.addLayer({
          ...common,
          id: LAYER_SELECTED_LINE,
          filter: ['==', ['get', 'selected'], 1],
          layout,
          paint: { 'line-color': colorExpression as never, 'line-width': 4.5 },
        })
      }
    }

    ensure()
    instance.on('styledata', ensure)
    // Red de seguridad: durante un cambio de estilo, `styledata` puede llegar
    // con el estilo aún a medias y `ensure` se sale sin sembrar. `idle` se
    // emite cuando ya no queda nada por renderizar, así que ahí siempre entra.
    instance.on('idle', ensure)
    return () => {
      instance.off('styledata', ensure)
      instance.off('idle', ensure)
    }
  }, [resolved, colorExpression, collection])

  // El estilo solo se cambia cuando cambia de verdad: el constructor ya puso
  // el inicial, y volver a ponerlo es un no-op que además no emite styledata.
  const styleApplied = useRef<string | null>(null)
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const key = `${styleId}:${dark}`
    if (styleApplied.current === null) {
      styleApplied.current = key
      return
    }
    if (styleApplied.current === key) return
    styleApplied.current = key
    instance.setStyle(styleFor(styleId, dark))
  }, [styleId, dark])

  // Datos de ruta: actualizar la fuente, no recrear las capas.
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const source = instance.getSource(ROUTES_SOURCE)
    if (source && 'setData' in source) {
      ;(source as GeoJSONSource).setData(collection)
    }
  }, [collection])

  // Marcadores: son DOM, así que sobreviven al cambio de estilo.
  useEffect(() => {
    const instance = map.current
    if (!instance) return

    for (const marker of markerRefs.current) marker.remove()
    markerRefs.current = markers.map((marker) =>
      new Marker({ element: markerElement(marker, dark) })
        .setLngLat(marker.coordinate)
        .addTo(instance),
    )

    return () => {
      for (const marker of markerRefs.current) marker.remove()
      markerRefs.current = []
    }
  }, [markers, dark])

  // Encuadre: solo cuando cambia fitKey, para no pelear con el usuario.
  useEffect(() => {
    const instance = map.current
    if (!instance || fitKey === undefined) return

    const points = routes.flatMap((route) => route.coordinates)
    const bounds = boundsOf(points)
    if (!bounds) return

    instance.fitBounds(bounds as LngLatBoundsLike, {
      padding: paddingFor(instance),
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600,
      maxZoom: 15,
    })
    // routes cambia de identidad en cada render; fitKey es la señal deliberada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey])

  useEffect(() => {
    const instance = map.current
    if (!instance || !focus) return
    instance.easeTo({
      center: focus.center,
      zoom: Math.max(instance.getZoom(), 13),
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600,
    })
    // Solo cuando la página lo pide (key); ver el comentario del prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key])

  useEffect(() => {
    const canvas = map.current?.getCanvas()
    if (canvas) canvas.style.cursor = isPicking ? 'crosshair' : ''
  }, [isPicking])


  /** maplibre falla si el margen se come el viewport; se limita al 42 %. */
  const paddingFor = useCallback(
    (instance: MapLibreMap) => {
      const base = fitPadding ?? { top: 48, right: 48, bottom: 48, left: 48 }
      const { width, height } = instance.getCanvas().getBoundingClientRect()
      const cap = (value: number, axis: number) => Math.min(value, Math.max(24, axis * 0.42))
      return {
        top: cap(base.top, height),
        bottom: cap(base.bottom, height),
        left: cap(base.left, width),
        right: cap(base.right, width),
      }
    },
    [fitPadding],
  )

  const fitToRoutes = useCallback(() => {
    const instance = map.current
    if (!instance) return
    const bounds = boundsOf(routes.flatMap((route) => route.coordinates))
    if (!bounds) return
    instance.fitBounds(bounds as LngLatBoundsLike, {
      padding: paddingFor(instance),
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600,
      maxZoom: 15,
    })
  }, [routes, paddingFor])

  return (
    <div className={cn('relative', className)}>
      {/* Tamaño por dimensiones, no por posicionamiento: maplibre añade
          .maplibregl-map { position: relative } desde una hoja SIN capa, y en
          CSS lo no-capado gana a la capa `utilities` de Tailwind. Con
          `absolute inset-0`, ese `relative` ganaba, `inset-0` quedaba inerte y
          el contenedor colapsaba a 0 de alto: el mapa montaba en blanco. */}
      <div ref={container} className="size-full" data-testid="map" />
      {onStyleChange ? (
        <MapControls
          styleId={styleId}
          onStyleChange={onStyleChange}
          onZoomIn={() => map.current?.zoomIn()}
          onZoomOut={() => map.current?.zoomOut()}
          onFit={routes.length > 0 ? fitToRoutes : undefined}
          onLocate={onLocate}
        />
      ) : null}
    </div>
  )
}
