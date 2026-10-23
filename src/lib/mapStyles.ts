import type {
  HillshadeLayerSpecification,
  Map as MapLibreMap,
  RasterDEMSourceSpecification,
  StyleSpecification,
} from 'maplibre-gl'

export type MapStyleId = 'map' | 'satellite'

/**
 * Basemaps without API keys, so there are no credentials to manage.
 * - OpenFreeMap Positron / Dark: global vector tiles, desaturated so the route
 *   is the only colour.
 * - Esri World Imagery: one global imagery layer, so the satellite view has no
 *   seams at borders.
 */
const BASE_LIGHT = 'https://tiles.openfreemap.org/styles/positron'
const BASE_DARK = 'https://tiles.openfreemap.org/styles/dark'

const BASE_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'

const IMAGERY_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

const IMAGERY_ATTRIBUTION =
  'Powered by <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a> | Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'

const satelliteStyle: StyleSpecification = {
  version: 8,
  glyphs: BASE_GLYPHS,
  sources: {
    imagery: {
      type: 'raster',
      tiles: [IMAGERY_TILES],
      tileSize: 256,
      maxzoom: 19,
      attribution: IMAGERY_ATTRIBUTION,
    },
  },
  layers: [{ id: 'imagery', type: 'raster', source: 'imagery' }],
}

export const RELIEF_SOURCE = 'velio-relief'

export const reliefSource: RasterDEMSourceSpecification = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 11,
  attribution:
    '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noreferrer">EU-DEM</a>, produced using Copernicus data and information funded by the European Union',
}

export function reliefPaint(dark: boolean): HillshadeLayerSpecification['paint'] {
  return dark
    ? {
        'hillshade-shadow-color': '#000000',
        'hillshade-highlight-color': '#3a3a3a',
        'hillshade-accent-color': '#000000',
        'hillshade-exaggeration': 0.6,
      }
    : {
        'hillshade-shadow-color': '#4b5563',
        'hillshade-highlight-color': '#ffffff',
        'hillshade-accent-color': '#4b5563',
        'hillshade-exaggeration': 0.4,
      }
}

/** The "map" style follows the theme; satellite is the same in both. */
export function styleFor(id: MapStyleId, dark: boolean): string | StyleSpecification {
  if (id === 'satellite') return satelliteStyle
  return dark ? BASE_DARK : BASE_LIGHT
}

const COLOR = /^(#[0-9a-f]{3,8}$|rgba?\(|hsla?\()/i

/** Dark basemap colours become neutral charcoal so the black UI and the map read as one. */
export function tintToCharcoal(color: string): string {
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
  const l = 0.04 + 0.82 * lightness
  return `hsla(0, 0%, ${(l * 100).toFixed(1)}%, ${alpha})`
}

function tintValue(value: unknown): unknown {
  if (typeof value === 'string') return tintToCharcoal(value)
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
  return { top: 48, right: 48, bottom: hasResult && !collapsed ? 320 : 48, left: 72 }
}
