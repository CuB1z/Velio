import type { AnyRouteResult, ElevationPoint } from '@/types/api'
import { decodePolyline } from './polyline'

/**
 * Export of a saved route. The backend's ?format=gpx endpoints recompute from
 * the original request, which a saved route lacks, so the file is built here.
 */

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) =>
    char === '<' ? '&lt;' : char === '>' ? '&gt;' : char === '&' ? '&amp;' : char === "'" ? '&apos;' : '&quot;',
  )
}

export function toGpx(result: AnyRouteResult, name: string): Blob {
  const coordinates = decodePolyline(result.polyline)
  const profile = result.profile ?? null

  // The profile is resampled (~1 point per 10 m) and doesn't match the polyline
  // 1:1, so each point takes the elevation of the nearest profile index.
  const elevationAt = (index: number): number | null => {
    if (!profile || profile.length === 0) return null
    const ratio = coordinates.length > 1 ? index / (coordinates.length - 1) : 0
    const sample: ElevationPoint | undefined = profile[Math.round(ratio * (profile.length - 1))]
    return sample ? sample.elevation_m : null
  }

  const points = coordinates
    .map(([lon, lat], index) => {
      const elevation = elevationAt(index)
      const ele = elevation === null ? '' : `<ele>${elevation.toFixed(1)}</ele>`
      return `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">${ele}</trkpt>`
    })
    .join('\n')

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Velio" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`
  return new Blob([gpx], { type: 'application/gpx+xml' })
}

export function toGeoJson(result: AnyRouteResult, name: string): Blob {
  const collection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name,
          distance_km: result.distance_km,
          duration_min: result.duration_min,
          elevation_gain_m: result.gain_m,
          elevation_loss_m: result.loss_m,
          overlap_ratio: result.overlap_ratio,
          cycling_score: result.cycling_score?.total ?? null,
        },
        geometry: { type: 'LineString', coordinates: decodePolyline(result.polyline) },
      },
    ],
  }
  return new Blob([JSON.stringify(collection, null, 2)], { type: 'application/geo+json' })
}
