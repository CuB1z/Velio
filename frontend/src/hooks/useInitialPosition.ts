import { useEffect } from 'react'

import type { LatLon } from '@/types/api'

/** Enough for a rough position; no need to wait for a precise GPS fix. */
const TIMEOUT_MS = 8000

export type PositionFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported'

/** Maps GeolocationPositionError codes to a readable cause. */
export function positionFailure(error: { code: number }): PositionFailure {
  if (error.code === 1) return 'denied'
  if (error.code === 3) return 'timeout'
  return 'unavailable'
}

/**
 * Requests the browser position once on mount and passes it on if it arrives.
 * Otherwise the page keeps its default and `onFailure` receives the cause.
 */
export function useInitialPosition(
  onPosition: (position: LatLon) => void,
  onFailure?: (cause: PositionFailure) => void,
): void {
  useEffect(() => {
    const geolocation = typeof navigator !== 'undefined' ? navigator.geolocation : undefined
    if (!geolocation) {
      onFailure?.('unsupported')
      return
    }
    let cancelled = false
    geolocation.getCurrentPosition(
      (result) => {
        if (cancelled) return
        onPosition({ lat: result.coords.latitude, lon: result.coords.longitude })
      },
      (error) => {
        if (cancelled) return
        // Logged so failures can be diagnosed from the browser console.
        console.warn('[velio] geolocation failed', error.code, error.message)
        onFailure?.(positionFailure(error))
      },
      { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: 60_000 },
    )
    return () => {
      cancelled = true
    }
    // Mount only: requesting on every render would loop the permission prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
