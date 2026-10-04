import { ElevationProfile } from '@/components/route/elevationProfile'
import { LANDING_EXAMPLES } from '@/pages/landingExamples'

const SIERRA = LANDING_EXAMPLES[1]

/** El perfil real de la sierra: un gráfico, no un mapa. */
export function ProfileCell({ height = 150 }: { height?: number }) {
  return (
    <ElevationProfile
      profile={SIERRA.profile}
      distanceKm={SIERRA.result.distance_km}
      height={height}
    />
  )
}
