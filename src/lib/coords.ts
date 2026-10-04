import type { LatLon } from '@/types/api'

/**
 * Accepts both decimal separators: the UI shows commas, external sources use dots.
 *   "40.5964, -3.6318"   "40,5964 −3,6318"   "40.5964 -3.6318"
 */
const NUMBER = /[-−+]?\d+(?:[.,]\d+)?/g

export function parseCoordinates(input: string): LatLon | null {
  const matches = input.match(NUMBER)
  if (!matches || matches.length !== 2) return null

  const [lat, lon] = matches.map((raw) =>
    Number.parseFloat(raw.replace('−', '-').replace(',', '.')),
  )

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null

  return { lat, lon }
}

/** Editable field text, with dot decimals like pasted coordinates. */
export function coordinatesToInput({ lat, lon }: LatLon): string {
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`
}

export function sameCoordinates(a: LatLon | null, b: LatLon | null): boolean {
  if (!a || !b) return a === b
  return Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lon - b.lon) < 1e-7
}
