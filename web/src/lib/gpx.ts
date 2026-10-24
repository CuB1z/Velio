import polyline from '@mapbox/polyline'

/** Multi-hour tracks carry tens of thousands of points; the API doesn't need them. */
const MAX_POINTS = 2000

export type GpxTrack = {
  /** polyline6, as /routes/analyze expects. */
  encoded: string
  pointCount: number
  name?: string
}

/** Extracts the track from a GPX with the browser's DOMParser (only trkpt lat/lon). */
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

/** Uniform sampling that keeps the first and last points. */
function downsample(points: [number, number][]): [number, number][] {
  if (points.length <= MAX_POINTS) return points
  const step = (points.length - 1) / (MAX_POINTS - 1)
  const out: [number, number][] = []
  for (let i = 0; i < MAX_POINTS; i += 1) out.push(points[Math.round(i * step)])
  return out
}
