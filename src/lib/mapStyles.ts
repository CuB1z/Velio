import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'

export type MapStyleId = 'map' | 'satellite'

/**
 * Basemaps without API keys, so there are no credentials to manage.
 * - OpenFreeMap Positron / Dark: global vector tiles, desaturated so the route
 *   is the only colour.
 * - IGN PNOA orthophoto: Spain only, matching the backend's Valhalla graph.
 */
const BASE_LIGHT = 'https://tiles.openfreemap.org/styles/positron'
const BASE_DARK = 'https://tiles.openfreemap.org/styles/dark'

const BASE_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'

const PNOA_TILES =
  'https://www.ign.es/wmts/pnoa-ma?service=WMTS&request=GetTile&version=1.0.0' +
  '&layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible' +
  '&format=image/jpeg&TileMatrix={z}&TileCol={x}&TileRow={y}'

const PNOA_ATTRIBUTION =
  'PNOA cedido por © <a href="https://www.ign.es" target="_blank" rel="noreferrer">Instituto Geográfico Nacional de España</a>'

const satelliteStyle: StyleSpecification = {
  version: 8,
  glyphs: BASE_GLYPHS,
  sources: {
    pnoa: {
      type: 'raster',
      tiles: [PNOA_TILES],
      tileSize: 256,
      maxzoom: 19,
      attribution: PNOA_ATTRIBUTION,
    },
  },
  layers: [{ id: 'pnoa', type: 'raster', source: 'pnoa' }],
}

/** The "map" style follows the theme; satellite is the same in both. */
export function styleFor(id: MapStyleId, dark: boolean): string | StyleSpecification {
  if (id === 'satellite') return satelliteStyle
  return dark ? BASE_DARK : BASE_LIGHT
}

const SLATE_HUE = 210
const SLATE_SATURATION = 0.26
const COLOR = /^(#[0-9a-f]{3,8}$|rgba?\(|hsla?\()/i

export function tintToSlate(color: string): string {
  if (!COLOR.test(color)) return color
  let lightness: number
  let alpha = 1
  if (color.startsWith('#')) {
    const hex = color.length < 7 ? [...color.slice(1, 4)].map((c) => c + c).join('') : color.slice(1, 7)
    const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
    lightness = (Math.max(...rgb) + Math.min(...rgb)) / 510
  } else {
    const n = color.match(/[\d.]+/g)?.map(Number) ?? []
    lightness = color.startsWith('hsl') ? n[2] / 100 : (Math.max(n[0], n[1], n[2]) + Math.min(n[0], n[1], n[2])) / 510
    alpha = n[3] ?? 1
  }
  const l = 0.065 + 0.85 * lightness
  const s = SLATE_SATURATION * (1 - l)
  return `hsla(${SLATE_HUE}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%, ${alpha})`
}

function tintValue(value: unknown): unknown {
  if (typeof value === 'string') return tintToSlate(value)
  if (Array.isArray(value)) return value.map(tintValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, tintValue(inner)]))
  }
  return value
}

export function tintStyle(style: StyleSpecification): StyleSpecification {
  const layers = style.layers.map((layer) =>
    'paint' in layer && layer.paint ? { ...layer, paint: tintValue(layer.paint) } : layer,
  )
  return { ...style, layers: layers as StyleSpecification['layers'] }
}

export function applyBaseStyle(map: MapLibreMap, id: MapStyleId, dark: boolean): void {
  map.setStyle(styleFor(id, dark), {
    transformStyle: id === 'map' && dark ? (_previous, next) => tintStyle(next) : undefined,
  })
}

/** The route needs a dark halo over the orthophoto or dark base, white on the light base. */
export function overlayNeedsDarkHalo(id: MapStyleId, dark: boolean): boolean {
  return id === 'satellite' || dark
}

/** Default centre (Puerta del Sol) while the browser gives no position. */
export const MADRID_CENTER: { lat: number; lon: number } = { lat: 40.4168, lon: -3.7038 }
export const DEFAULT_CENTER: [number, number] = [MADRID_CENTER.lon, MADRID_CENTER.lat]
export const DEFAULT_ZOOM = 11

/** Fit padding that keeps the route clear of the result panel; shared with the panel's size. */
export function mapFitPadding(hasResult: boolean, collapsed = false) {
  return { top: 48, right: 48, bottom: hasResult && !collapsed ? 440 : 48, left: 48 }
}
