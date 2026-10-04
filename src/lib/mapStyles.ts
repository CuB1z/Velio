import type { StyleSpecification } from 'maplibre-gl'

export type MapStyleId = 'map' | 'satellite'

/**
 * Bases sin API key, a propósito: el proyecto no necesita credenciales que
 * gestionar ni rotar.
 *
 * - OpenFreeMap Positron / Dark: vectoriales, mundiales, gratuitas. Gris
 *   desaturado a propósito, para que el trazado sea lo único con color, pero
 *   con la red secundaria y las cartelas de vía que un planificador necesita
 *   poder leer al zoom de planificación.
 * - PNOA del IGN: ortofoto de máxima actualidad. Solo cubre España, que es
 *   exactamente el alcance del grafo de Valhalla del backend.
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

/** El estilo "mapa" sigue al tema; el satélite es el mismo en claro y oscuro. */
export function styleFor(id: MapStyleId, dark: boolean): string | StyleSpecification {
  if (id === 'satellite') return satelliteStyle
  return dark ? BASE_DARK : BASE_LIGHT
}

/** Encima de la ortofoto el trazado necesita filete oscuro; sobre la base clara, blanco. */
export function overlayNeedsDarkHalo(id: MapStyleId, dark: boolean): boolean {
  return id === 'satellite' || dark
}

/**
 * Centro por defecto: la Puerta del Sol. Es donde cae el mapa cuando el
 * navegador no da posición (permiso denegado, sin GPS, o aún esperando);
 * con posición, la página encuadra la del usuario.
 */
export const MADRID_CENTER: { lat: number; lon: number } = { lat: 40.4168, lon: -3.7038 }
export const DEFAULT_CENTER: [number, number] = [MADRID_CENTER.lon, MADRID_CENTER.lat]
export const DEFAULT_ZOOM = 11

/**
 * Hueco que el panel de resultado tapa sobre el mapa, para que al encajar la
 * ruta no quede debajo. Vive aquí porque es la misma medida que usa el panel:
 * las tres páginas lo repetían a mano y al plegarlo se quedaba desfasado.
 */
export function mapFitPadding(hasResult: boolean, collapsed = false) {
  return { top: 48, right: 48, bottom: hasResult && !collapsed ? 440 : 48, left: 48 }
}
