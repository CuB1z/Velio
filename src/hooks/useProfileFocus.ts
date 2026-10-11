import { useCallback, useState } from 'react'

import type { MapFocusPoint } from '@/components/map/mapView'
import { formatDistance, formatElevation, formatPercent } from '@/lib/format'
import type { ElevationPoint } from '@/types/api'

export function profilePointLabel(point: ElevationPoint): string {
  const parts = [formatDistance(point.distance_m / 1000), formatElevation(point.elevation_m)]
  if (point.grade_pct !== null) parts.push(formatPercent(point.grade_pct))
  return parts.join(' · ')
}

export function useProfileFocus(): {
  focusPoint: MapFocusPoint | null
  onProfileHover: (point: ElevationPoint | null) => void
} {
  const [focusPoint, setFocusPoint] = useState<MapFocusPoint | null>(null)
  const onProfileHover = useCallback((point: ElevationPoint | null) => {
    setFocusPoint(point ? { coordinate: [point.lon, point.lat], label: profilePointLabel(point) } : null)
  }, [])
  return { focusPoint, onProfileHover }
}
