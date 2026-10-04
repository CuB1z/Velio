import polyline from '@mapbox/polyline'

/** Un track de varias horas trae decenas de miles de puntos; la API no los necesita. */
const MAX_POINTS = 2000

export type GpxTrack = {
  /** polyline6, lo que espera /routes/analyze. */
  encoded: string
  pointCount: number
  name?: string
}

/**
 * Extrae la traza de un GPX. Se usa DOMParser en vez de una librería: el
 * navegador ya trae un parser de XML y solo necesitamos lat/lon de los trkpt.
 */
export function parseGpx(xml: string): GpxTrack | null {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return null

  const nodes = doc.querySelectorAll('trkpt, rtept')
  if (nodes.length < 2) return null

  const points: [number, number][] = []
  for (const node of nodes) {
    const lat = Number.parseFloat(node.getAttribute('lat') ?? '')
    const lon = Number.parseFloat(node.getAttribute('lon') ?? '')
    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push([lat, lon])
  }
  if (points.length < 2) return null

  const sampled = downsample(points)
  return {
    encoded: polyline.encode(sampled, 6),
    pointCount: points.length,
    name: doc.querySelector('trk > name, metadata > name')?.textContent ?? undefined,
  }
}

/** Muestreo uniforme conservando el primer y el último punto. */
function downsample(points: [number, number][]): [number, number][] {
  if (points.length <= MAX_POINTS) return points
  const step = (points.length - 1) / (MAX_POINTS - 1)
  const out: [number, number][] = []
  for (let i = 0; i < MAX_POINTS; i += 1) out.push(points[Math.round(i * step)])
  return out
}
