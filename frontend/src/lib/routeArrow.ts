import type { Map as MapLibreMap, SymbolLayerSpecification } from 'maplibre-gl'

const SIZE = 40

function chevron(color: string, halo: string): ImageData | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const [stroke, width] of [
    [halo, 10],
    [color, 5],
  ] as const) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(14, 9)
    ctx.lineTo(26, 20)
    ctx.lineTo(14, 31)
    ctx.stroke()
  }
  return ctx.getImageData(0, 0, SIZE, SIZE)
}

/** Registers a chevron in `color` with a `halo` edge and returns its image id. */
export function routeArrowImage(map: MapLibreMap, color: string, halo: string): string | null {
  const id = `velio-arrow-${color}-${halo}`
  if (map.hasImage(id)) return id
  const image = chevron(color, halo)
  if (!image) return null
  map.addImage(id, image, { pixelRatio: 2 })
  return id
}

export const ARROW_LAYOUT: SymbolLayerSpecification['layout'] = {
  'symbol-placement': 'line',
  'symbol-spacing': 110,
  'icon-rotation-alignment': 'map',
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
  'icon-offset': [0, 3],
}
