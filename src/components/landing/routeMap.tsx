import { useEffect, useRef } from 'react'

import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/cn'
import { overlayNeedsDarkHalo, styleFor, type MapStyleId } from '@/lib/mapStyles'
import type { LngLat } from '@/lib/polyline'
import { boundsOf } from '@/lib/polyline'

type Props = {
  /** Trazado real, [lat, lon]. */
  shape: [number, number][]
  style?: MapStyleId
  /** Tramos a resaltar (por ejemplo, la vía repetida), [lat, lon][][] */
  highlight?: [number, number][][]
  /** Dibuja el trazado de principio a fin al aparecer. */
  animate?: boolean
  /** Margen del encuadre; por lados para dejar la ruta donde no hay paneles. */
  padding?: number | { top: number; right: number; bottom: number; left: number }
  className?: string
  /**
   * Velo para poder poner texto encima. Medido: el parche más claro de la
   * ortofoto es casi blanco (222,222,220) y daba 1,35:1 contra texto blanco.
   * Un velo plano suave no basta — hace falta un suelo garantizado donde va
   * el texto, degradándose hacia donde no lo hay para no aplastar la foto.
   */
  dim?: boolean
}

const ROUTE = 'landing-route'
const HIGHLIGHT = 'landing-highlight'
const START = 'landing-start'
// Mismo token que --duration-draw en globals.css.
const DRAW_MS = 2200
const TRANSPARENT = 'rgba(0,0,0,0)'

const toLngLat = (shape: [number, number][]): LngLat[] => shape.map(([lat, lon]) => [lon, lat])

/**
 * Mapa real, quieto, para ilustrar: tiles de Carto o la ortofoto del IGN con
 * un trazado encima. MapLibre se carga solo cuando el mapa entra en la
 * página (pesa cerca de un megabyte) y no se monta donde no hay WebGL (jsdom,
 * navegadores viejos): entonces queda la superficie del contenedor.
 */
export function RouteMap({
  shape,
  style = 'map',
  highlight,
  animate = false,
  padding = 28,
  className,
  dim = false,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const { resolved } = useTheme()
  const dark = resolved === 'dark'

  useEffect(() => {
    const element = container.current
    if (!element || typeof window === 'undefined' || !('WebGLRenderingContext' in window)) return

    let cancelled = false
    let frame = 0
    let map: import('maplibre-gl').Map | null = null

    void (async () => {
      const [{ Map: MapLibreMap }] = await Promise.all([
        import('maplibre-gl'),
        import('maplibre-gl/dist/maplibre-gl.css'),
      ])
      if (cancelled) return

      const line = toLngLat(shape)
      const bounds = boundsOf(line)
      const instance = new MapLibreMap({
        container: element,
        style: styleFor(style, dark),
        interactive: false,
        attributionControl: { compact: true },
        // El grafo del backend es España: no tiene sentido dejar navegar más lejos.
        maxBounds: [
          [-19.5, 26.5],
          [5.5, 44.5],
        ],
        // Sin animación de entrada: encaja directamente el trazado.
        bounds: bounds ?? undefined,
        fitBoundsOptions: { padding },
      })
      map = instance

      const halo = overlayNeedsDarkHalo(style, dark) ? '#121a21' : '#ffffff'
      const accent =
        getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#0e7c86'
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

      instance.on('load', () => {
        if (cancelled) return
        instance.addSource(ROUTE, {
          type: 'geojson',
          lineMetrics: true,
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } },
        })
        instance.addLayer({
          id: `${ROUTE}-casing`,
          type: 'line',
          source: ROUTE,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': halo, 'line-width': 7, 'line-opacity': 0.9 },
        })
        instance.addLayer({
          id: `${ROUTE}-line`,
          type: 'line',
          source: ROUTE,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { // Sigue al acento: si la marca cambia de color, la ruta cambia con ella.
          'line-color': accent, 'line-width': 3.5 },
        })
        if (highlight?.length) {
          instance.addSource(HIGHLIGHT, {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: highlight.map((segment) => ({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: toLngLat(segment) },
              })),
            },
          })
          instance.addLayer({
            id: `${HIGHLIGHT}-line`,
            type: 'line',
            source: HIGHLIGHT,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#b45309', 'line-width': 5, 'line-dasharray': [1.2, 1.2] },
          })
        }
        instance.addSource(START, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: line[0] } },
        })
        instance.addLayer({
          id: `${START}-dot`,
          type: 'circle',
          source: START,
          paint: {
            'circle-radius': 6,
            'circle-color': '#1f8a4c',
            'circle-stroke-color': halo,
            'circle-stroke-width': 2.5,
          },
        })

        // Dibujado: el degradado a lo largo de la línea avanza de 0 a 1.
        if (animate && !reduced) {
          const paintProgress = (progress: number) => {
            instance.setPaintProperty(`${ROUTE}-line`, 'line-gradient', [
              'step',
              ['line-progress'],
              accent,
              Math.min(0.9999, progress),
              TRANSPARENT,
            ])
            instance.setPaintProperty(`${ROUTE}-casing`, 'line-gradient', [
              'step',
              ['line-progress'],
              halo,
              Math.min(0.9999, progress),
              TRANSPARENT,
            ])
          }
          paintProgress(0.0001)
          const start = performance.now()
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / DRAW_MS)
            const eased = 1 - Math.pow(1 - t, 3)
            paintProgress(eased)
            if (t < 1) frame = requestAnimationFrame(tick)
          }
          frame = requestAnimationFrame(tick)
        }
      })
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      map?.remove()
      map = null
    }
  }, [shape, style, highlight, animate, padding, dark])

  return (
    <div className={cn('relative overflow-hidden bg-surface-secondary', className)}>
      <div ref={container} className="absolute inset-0 size-full" aria-hidden="true" />
      {dim ? (
        <>
          {/* Suelo uniforme: garantiza contraste aunque la foto tenga nieve o tejados. */}
          <div className="pointer-events-none absolute inset-0 bg-ink/55" aria-hidden="true" />
          {/* Y refuerzo donde vive el texto: abajo en móvil, a la izquierda en ancho. */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#111112]/92 via-[#111112]/55 to-transparent lg:bg-gradient-to-r lg:from-[#111112]/92 lg:via-[#111112]/55 lg:to-transparent"
            aria-hidden="true"
          />
        </>
      ) : null}
    </div>
  )
}
