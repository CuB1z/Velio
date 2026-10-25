import {
  Map as MapLibreMap,
  Marker,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapMouseEvent,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/cn'
import { useTheme } from '@/hooks/useTheme'
import { accent, categorical, ink } from '@/lib/chartPalette'
import {
  applyBaseStyle,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  FALLBACK_BOUNDS,
  RELIEF_SOURCE,
  reliefPaint,
  reliefSource,
  type MapBounds,
  type MapStyleId,
} from '@/lib/mapStyles'
import { MapControls } from './MapControls'
import { ARROW_LAYOUT, routeArrowImage } from './routeArrow'
import type { LngLat } from '@/lib/polyline'
import { boundsOf } from '@/lib/polyline'

const ROUTES_SOURCE = 'velio-routes'
const LAYER_CASING = 'velio-routes-casing'
const LAYER_LINE = 'velio-routes-line'
const LAYER_SELECTED_CASING = 'velio-routes-selected-casing'
const LAYER_SELECTED_LINE = 'velio-routes-selected-line'
const LAYER_SELECTED_ARROWS = 'velio-routes-selected-arrows'
const ATTRIBUTION_VISIBLE_MS = 5000
const COMPACT_MAP_MAX_WIDTH = 640

export type RouteLayer = {
  id: string
  coordinates: LngLat[]
  /** Fixed categorical palette slot: the color belongs to the variant, not its order. */
  colorIndex: number
  selected: boolean
}

export type MapMarker = {
  id: string
  coordinate: LngLat
  kind: 'start' | 'end' | 'via'
  label?: string
}

export type MapFocusPoint = { coordinate: LngLat; label?: string }

export type MapViewProps = {
  /**
   * Point to move the view to. Applied when `key` changes, not the point, so
   * setting the origin with a click does not move the map but locating the user does.
   */
  focus?: { center: [number, number]; key: number }
  styleId: MapStyleId
  maxBounds?: MapBounds
  routes?: RouteLayer[]
  markers?: MapMarker[]
  focusPoint?: MapFocusPoint | null
  /** Changing this value refits the view. A counter or the result id. */
  fitKey?: string | number
  /**
   * Fit padding in pixels. The result panel floats over the map, so the bottom
   * needs extra room or the route hides behind it.
   */
  fitPadding?: { top: number; right: number; bottom: number; left: number }
  onMapClick?: (coordinate: LngLat) => void
  isPicking?: boolean
  className?: string
  /** Shows the overlaid controls (style, zoom, fit, location). */
  onStyleChange?: (id: MapStyleId) => void
  onLocate?: () => void
}

/** Marker colors come from the palette, never hard-coded. */
function markerElement(marker: MapMarker, dark: boolean): HTMLElement {
  const mode = dark ? 'dark' : 'light'
  const surface = ink(mode).surface
  const brand = accent(mode)
  const routeColor = categorical(mode, 0)
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
    el.style.background = routeColor
    el.style.color = ink(mode).foreground
    el.style.borderColor = ink(mode).foreground
  } else if (marker.kind === 'end') {
    el.style.background = ink(mode).foreground
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

function focusElement(): { root: HTMLElement; label: HTMLElement } {
  const root = document.createElement('div')
  root.style.cssText = [
    'position:relative',
    'width:14px',
    'height:14px',
    'border-radius:999px',
    'background:var(--accent)',
    'border:3px solid var(--surface)',
    'box-shadow:0 1px 6px rgba(0,0,0,.4)',
    'pointer-events:none',
  ].join(';')
  const label = document.createElement('div')
  label.style.cssText = [
    'position:absolute',
    'left:20px',
    'top:50%',
    'transform:translateY(-50%)',
    'white-space:nowrap',
    'padding:3px 8px',
    'border-radius:999px',
    'background:var(--surface)',
    'color:var(--foreground)',
    'font:600 11px/1.4 var(--font-sans, system-ui)',
    'font-variant-numeric:tabular-nums',
    'box-shadow:0 1px 6px rgba(0,0,0,.25)',
  ].join(';')
  root.append(label)
  root.setAttribute('aria-hidden', 'true')
  return { root, label }
}

export function MapView({
  styleId,
  maxBounds = FALLBACK_BOUNDS,
  routes = [],
  focus,
  markers = [],
  focusPoint = null,
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
  const focusMarker = useRef<{ marker: Marker; label: HTMLElement } | null>(null)
  const clickHandler = useRef(onMapClick)
  clickHandler.current = onMapClick

  const { resolved } = useTheme()
  const dark = resolved === 'dark'
  const [relief, setRelief] = useState(false)

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

  // Data-driven expression: the color comes from the slot, not the paint order.
  const colorExpression = useMemo(() => {
    const cases: unknown[] = ['match', ['get', 'colorIndex']]
    for (let slot = 0; slot < 5; slot += 1) cases.push(slot, categorical(resolved, slot))
    cases.push(categorical(resolved, 0))
    return cases
  }, [resolved])

  // Created once. Style and layers sync in separate effects.
  useEffect(() => {
    if (!container.current || map.current) return

    const instance = new MapLibreMap({
      container: container.current,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
      maxBounds,
    })

    applyBaseStyle(instance, styleId, dark)

    instance.on('click', (event: MapMouseEvent) => {
      clickHandler.current?.([event.lngLat.lng, event.lngLat.lat])
    })

    const collapseAttribution = window.setTimeout(() => {
      if (instance.getContainer().offsetWidth > COMPACT_MAP_MAX_WIDTH) return
      instance.getContainer().querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show')
    }, ATTRIBUTION_VISIBLE_MS)

    map.current = instance
    return () => {
      window.clearTimeout(collapseAttribution)
      instance.remove()
      map.current = null
    }
    // Mount only: a style or theme change must not recreate the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Seed source and layers on `styledata`, not `once`: it also fires after every
  // style change, which wipes them. `ensure` is idempotent.
  useEffect(() => {
    const instance = map.current
    if (!instance) return

    const ensure = () => {
      if (!instance.style?._loaded) return

      if (!instance.getSource(ROUTES_SOURCE)) {
        instance.addSource(ROUTES_SOURCE, { type: 'geojson', data: collection })
      }

      const surface = ink(resolved).surface
      const common = { source: ROUTES_SOURCE, type: 'line' as const }
      const layout = { 'line-cap': 'round' as const, 'line-join': 'round' as const }

      // Discarded variants go underneath and thinner; the selected one on top, highlighted.
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

      const chosen = collection.features.find((feature) => feature.properties.selected === 1)
      const arrow = chosen
        ? routeArrowImage(instance, categorical(resolved, chosen.properties.colorIndex), surface)
        : null
      if (arrow && !instance.getLayer(LAYER_SELECTED_ARROWS)) {
        instance.addLayer({
          id: LAYER_SELECTED_ARROWS,
          type: 'symbol',
          source: ROUTES_SOURCE,
          filter: ['==', ['get', 'selected'], 1],
          layout: { ...ARROW_LAYOUT, 'icon-image': arrow },
        })
      } else if (arrow && instance.getLayoutProperty(LAYER_SELECTED_ARROWS, 'icon-image') !== arrow) {
        instance.setLayoutProperty(LAYER_SELECTED_ARROWS, 'icon-image', arrow)
      }

      const showRelief = relief && Boolean(instance.getLayer('building'))
      if (showRelief && !instance.getLayer(RELIEF_SOURCE)) {
        if (!instance.getSource(RELIEF_SOURCE)) instance.addSource(RELIEF_SOURCE, reliefSource)
        instance.addLayer(
          { id: RELIEF_SOURCE, type: 'hillshade', source: RELIEF_SOURCE, paint: reliefPaint(resolved === 'dark') },
          'building',
        )
      } else if (!showRelief && instance.getLayer(RELIEF_SOURCE)) {
        instance.removeLayer(RELIEF_SOURCE)
        instance.removeSource(RELIEF_SOURCE)
      }
    }

    ensure()
    instance.on('styledata', ensure)
    // Safety net: mid style change, `styledata` can fire with a half-loaded style and
    // `ensure` bails out. `idle` fires once nothing is left to render.
    instance.on('idle', ensure)
    return () => {
      instance.off('styledata', ensure)
      instance.off('idle', ensure)
    }
  }, [resolved, colorExpression, collection, relief])

  useEffect(() => {
    map.current?.setMaxBounds(maxBounds)
  }, [maxBounds])

  // Only set the style on a real change: the constructor already set the initial
  // one, and setting it again is a no-op that emits no styledata.
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
    applyBaseStyle(instance, styleId, dark)
  }, [styleId, dark])

  // Route data: update the source, do not recreate the layers.
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const source = instance.getSource(ROUTES_SOURCE)
    if (source && 'setData' in source) {
      ;(source as GeoJSONSource).setData(collection)
    }
  }, [collection])

  // Markers are DOM, so they survive style changes.
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

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    if (!focusPoint) {
      focusMarker.current?.marker.remove()
      return
    }
    if (!focusMarker.current) {
      const { root, label } = focusElement()
      focusMarker.current = { marker: new Marker({ element: root }), label }
    }
    const { marker, label } = focusMarker.current
    label.textContent = focusPoint.label ?? ''
    label.style.display = focusPoint.label ? '' : 'none'
    marker.setLngLat(focusPoint.coordinate).addTo(instance)
  }, [focusPoint])

  useEffect(
    () => () => {
      focusMarker.current?.marker.remove()
    },
    [],
  )

  // Fit only when fitKey changes, so it does not fight the user.
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
    // routes changes identity on every render; fitKey is the deliberate signal.
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
    // Only when the page asks for it (key); see the prop comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key])

  useEffect(() => {
    const canvas = map.current?.getCanvas()
    if (canvas) canvas.style.cursor = isPicking ? 'crosshair' : ''
  }, [isPicking])


  /** maplibre fails if the padding eats the viewport; clamp it to 42 %. */
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
      {/* Sized by dimensions, not `absolute inset-0`: maplibre's unlayered
          `.maplibregl-map { position: relative }` beats Tailwind's utilities layer. */}
      <div ref={container} className="size-full" data-testid="map" />
      {onStyleChange ? (
        <MapControls
          styleId={styleId}
          onStyleChange={onStyleChange}
          relief={relief}
          onReliefChange={setRelief}
          onZoomIn={() => map.current?.zoomIn()}
          onZoomOut={() => map.current?.zoomOut()}
          onFit={routes.length > 0 ? fitToRoutes : undefined}
          onLocate={onLocate}
        />
      ) : null}
    </div>
  )
}
