import { ElevationProfile } from '@/components/route/elevationProfile'
import { LANDING_EXAMPLES } from './landingExamples'

const SIERRA = LANDING_EXAMPLES[1]

/** The real profile of the sierra: a chart, not a map. */
export function ProfileCell({ height = 150 }: { height?: number }) {
  return (
    <ElevationProfile
      profile={SIERRA.profile}
      distanceKm={SIERRA.result.distance_km}
      height={height}
    />
  )
}
