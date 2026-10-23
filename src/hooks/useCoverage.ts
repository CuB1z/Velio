import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { getCoverage } from '@/api/coverage'
import { multiPolygonContains } from '@/lib/geo'
import { mapBoundsOf } from '@/lib/mapStyles'
import type { Coverage, LatLon } from '@/types/api'

const COVERAGE_QUERY = { queryKey: ['coverage'], queryFn: getCoverage, staleTime: Infinity }

export function coverageContains(coverage: Coverage | undefined, point: LatLon): boolean {
  return !coverage?.geometry || multiPolygonContains(coverage.geometry.coordinates, point)
}

/**
 * The covered regions and the map bounds they imply. `covers` waits for the
 * coverage and says yes when it is unavailable: the backend still rejects an
 * uncovered point with OUT_OF_COVERAGE.
 */
export function useCoverage() {
  const query = useQuery(COVERAGE_QUERY)
  const client = useQueryClient()
  const bounds = useMemo(() => mapBoundsOf(query.data), [query.data])
  const covers = useCallback(
    async (point: LatLon) => {
      try {
        return coverageContains(await client.ensureQueryData(COVERAGE_QUERY), point)
      } catch {
        return true
      }
    },
    [client],
  )
  return { coverage: query.data, bounds, covers }
}
