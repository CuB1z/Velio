/**
 * Data colours as literal hex: charts and SVG gradients need real values, not
 * `var(--…)`. Read from the theme when the token exists, else these fallbacks
 * (SSR, tests). `status` ignores the theme on purpose: its colours carry meaning.
 *
 * Orange and green are close under tritanopia, so every categorical use keeps
 * direct labels and a 2 px gap between segments. Don't remove the labels.
 */

export type ChartMode = 'light' | 'dark'

/** Fixed order: a colour belongs to the entity, never to its rank. */
const CATEGORICAL: Record<ChartMode, string[]> = {
  light: ['#126CC7', '#0E8F6F', '#B4531A', '#7A3EA1', '#A8123F'],
  dark: ['#388AE8', '#2B9F7E', '#CD6A35', '#A66AD0', '#DF4F6B'],
}

/** Neutral grey for "no data", not an extra category. */
const NEUTRAL: Record<ChartMode, string> = {
  light: '#9AA1AB',
  dark: '#6E7681',
}

/** Single hue for magnitude (elevation profile, score bars). */
const ACCENT: Record<ChartMode, string> = {
  light: '#126CC7',
  dark: '#4188DB',
}

/** Reserved for status; never reused as a series colour. */
const STATUS = {
  light: { good: '#1F7A4D', warning: '#96590B', critical: '#B02020' },
  dark: { good: '#4FBE85', warning: '#D89A3A', critical: '#E8695F' },
} as const

const INK: Record<ChartMode, { grid: string; axis: string; muted: string; surface: string }> = {
  light: { grid: '#E8ECF1', axis: '#C7CED7', muted: '#6B7280', surface: '#FFFFFF' },
  dark: { grid: '#333333', axis: '#454545', muted: '#A1A1A1', surface: '#222222' },
}

/** Theme colour if defined, otherwise the compiled fallback. */
function themed(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export function categorical(mode: ChartMode, index: number): string {
  const slot = index % CATEGORICAL[mode].length
  const override = themed(`--chart-${slot + 1}`, '')
  if (override) return override
  const scale = CATEGORICAL[mode]
  // No 6th colour is generated: it falls back to neutral ("other").
  return scale[index] ?? NEUTRAL[mode]
}

export function neutral(mode: ChartMode): string {
  const override = themed('--chart-neutral', '')
  if (override) return override
  return NEUTRAL[mode]
}

export function accent(mode: ChartMode): string {
  return themed('--accent', ACCENT[mode])
}

export function status(mode: ChartMode, kind: keyof (typeof STATUS)['light']): string {
  return STATUS[mode][kind]
}

export function ink(mode: ChartMode): (typeof INK)['light'] {
  const fallback = INK[mode]
  return {
    grid: themed('--separator', fallback.grid),
    axis: themed('--border', fallback.axis),
    muted: themed('--muted', fallback.muted),
    surface: themed('--surface', fallback.surface),
  }
}

/** Stable colour per surface type across routes: paved is always blue, dirt always orange. */
const SURFACE_SLOT: Record<string, number> = {
  paved_smooth: 0,
  paved: 0,
  compacted: 1,
  paved_rough: 2,
  dirt: 2,
  gravel: 3,
  path: 4,
}

export function surfaceColor(mode: ChartMode, key: string): string {
  if (key === '__unknown') return neutral(mode)
  const slot = SURFACE_SLOT[key]
  return slot === undefined ? neutral(mode) : categorical(mode, slot)
}
