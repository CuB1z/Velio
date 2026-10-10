import { useEffect, useRef, useState } from 'react'

import { ARROW_LAYOUT, routeArrowImage } from '@/components/map/routeArrow'
import { useTheme } from '@/hooks/useTheme'
import { status } from '@/lib/chartPalette'
import { cn } from '@/lib/cn'
import { applyBaseStyle } from '@/lib/mapStyles'
import { boundsOf, type LngLat } from '@/lib/polyline'

type Props = {
  shape: [number, number][]
  highlight?: [number, number][][]
  tone?: 'surface' | 'ink'
  padding?: number
  className?: string
}

const ROUTE = 'landing-route'
const HIGHLIGHT = 'landing-highlight'
const START = 'landing-start'
const ARROWS = 'landing-arrows'
const DRAW_MS = 2200
const TRANSPARENT = 'rgba(0,0,0,0)'

const toLngLat = (shape: [number, number][]): LngLat[] => shape.map(([lat, lon]) => [lon, lat])

export function RouteMap({ shape, highlight, tone = 'surface', padding = 36, className }: Props) {
  const wrapper = useRef<HTMLDivElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const { resolved } = useTheme()
  const dark = tone === 'ink' || resolved === 'dark'

  useEffect(() => {
    const element = wrapper.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setNear(true)
        observer.disconnect()
      },
      { rootMargin: '200px 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = container.current
    if (!near || !element || !('WebGLRenderingContext' in window)) return

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
      const instance = new MapLibreMap({
        container: element,
        interactive: false,
        attributionControl: { compact: true },
        bounds: boundsOf(line) ?? undefined,
        fitBoundsOptions: { padding },
      })
      map = instance
      applyBaseStyle(instance, 'map', dark)

      const css = getComputedStyle(document.documentElement)
      const accent = css.getPropertyValue(tone === 'ink' ? '--ink-accent' : '--accent').trim() || '#0e7c86'
      const halo = dark ? '#121a21' : '#ffffff'
      const mode = dark ? 'dark' : 'light'
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
      const layout = { 'line-cap': 'round', 'line-join': 'round' } as const

      instance.once('load', () => {
        if (cancelled) return
        element.querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show')
        instance.addSource(ROUTE, {
          type: 'geojson',
          lineMetrics: true,
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } },
        })
        instance.addLayer({
          id: `${ROUTE}-glow`,
          type: 'line',
          source: ROUTE,
          layout,
          paint: { 'line-color': accent, 'line-width': 14, 'line-blur': 10, 'line-opacity': dark ? 0.55 : 0.35 },
        })
        instance.addLayer({
          id: `${ROUTE}-casing`,
          type: 'line',
          source: ROUTE,
          layout,
          paint: { 'line-color': halo, 'line-width': 7.5 },
        })
        instance.addLayer({
          id: `${ROUTE}-line`,
          type: 'line',
          source: ROUTE,
          layout,
          paint: { 'line-color': accent, 'line-width': 3.5 },
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
            layout,
            paint: { 'line-color': status(mode, 'warning'), 'line-width': 5, 'line-dasharray': [1.4, 1.2] },
          })
        }
        const arrow = routeArrowImage(instance, accent, halo)
        if (arrow) {
          instance.addLayer({
            id: ARROWS,
            type: 'symbol',
            source: ROUTE,
            layout: { ...ARROW_LAYOUT, 'icon-image': arrow },
            paint: { 'icon-opacity': reduced ? 1 : 0, 'icon-opacity-transition': { duration: 400 } },
          })
        }
        instance.addSource(START, {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: line[0] } },
        })
        instance.addLayer({
          id: `${START}-halo`,
          type: 'circle',
          source: START,
          paint: { 'circle-radius': 13, 'circle-color': status(mode, 'good'), 'circle-opacity': 0.25 },
        })
        instance.addLayer({
          id: `${START}-dot`,
          type: 'circle',
          source: START,
          paint: {
            'circle-radius': 6.5,
            'circle-color': status(mode, 'good'),
            'circle-stroke-color': halo,
            'circle-stroke-width': 3,
          },
        })

        if (reduced) return
        const layers: [string, string][] = [
          [`${ROUTE}-glow`, accent],
          [`${ROUTE}-casing`, halo],
          [`${ROUTE}-line`, accent],
        ]
        const paintProgress = (progress: number) => {
          for (const [id, color] of layers) {
            instance.setPaintProperty(id, 'line-gradient', [
              'step',
              ['line-progress'],
              color,
              Math.min(0.9999, progress),
              TRANSPARENT,
            ])
          }
        }
        paintProgress(0.0001)
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DRAW_MS)
          paintProgress(1 - Math.pow(1 - t, 3))
          if (t < 1) frame = requestAnimationFrame(tick)
          else if (instance.getLayer(ARROWS)) instance.setPaintProperty(ARROWS, 'icon-opacity', 1)
        }
        frame = requestAnimationFrame(tick)
      })
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      map?.remove()
      map = null
    }
  }, [near, shape, highlight, tone, padding, dark])

  return (
    <div ref={wrapper} className={cn('relative overflow-hidden', dark ? 'bg-ink' : 'bg-surface-secondary', className)}>
      <div ref={container} className="size-full" aria-hidden="true" />
    </div>
  )
}
