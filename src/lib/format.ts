/**
 * App-wide number and date formatting; coordinates use the same decimal separator.
 * Minus is U+2212, not a hyphen, so it never breaks a line or reads as a separator.
 */

const MINUS = '−'
const EM_DASH = '\u2014'
const NBSP = ' '

function locale(): string {
  return document.documentElement.lang === 'en' ? 'en-GB' : 'es-ES'
}

function number(value: number, decimals: number): string {
  return new Intl.NumberFormat(locale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** 68,8 km · 118 km (no decimals from 100 km up). */
export function formatDistance(km: number): string {
  return `${number(km, km >= 100 ? 0 : 1)}${NBSP}km`
}

export function formatElevation(meters: number): string {
  return `${number(Math.round(meters), 0)}${NBSP}m`
}

/** Elevation with an explicit sign: +922 m / −921 m. */
export function formatSigned(meters: number): string {
  const rounded = Math.round(meters)
  const sign = rounded < 0 ? MINUS : '+'
  return `${sign}${number(Math.abs(rounded), 0)}${NBSP}m`
}

/** API duration in minutes: 178.4 → "2 h 58". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '—'
  const total = Math.round(minutes)
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest}${NBSP}min`
  if (rest === 0) return `${hours}${NBSP}h`
  return `${hours}${NBSP}h${NBSP}${String(rest).padStart(2, '0')}`
}

/** Fraction 0-1 → "4,1 %". */
export function formatRatio(ratio: number, decimals = 1): string {
  return `${number(ratio * 100, decimals)}${NBSP}%`
}

/** Value already in percent → "24,0 %". Fixed decimals so values don't jitter. */
export function formatPercent(percent: number, decimals = 1): string {
  const sign = percent < 0 ? MINUS : ''
  return `${sign}${number(Math.abs(percent), decimals)}${NBSP}%`
}

/** 0-10 and 0-100 scores with fixed decimals. */
export function formatScore(value: number, decimals = 1): string {
  return number(value, decimals)
}

/** 40,5964 · −3,6318, same decimal separator as the rest of the UI. */
export function formatCoordinates(lat: number, lon: number): string {
  const one = (value: number) =>
    `${value < 0 ? MINUS : ''}${number(Math.abs(value), 4)}`
  return `${one(lat)} · ${one(lon)}`
}

/** Invalid timestamps render as a dash: `Intl.DateTimeFormat` throws `RangeError` on them. */
function whenValid(iso: string, render: (date: Date) => string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? EM_DASH : render(date)
}

export function formatDate(iso: string): string {
  return whenValid(iso, (date) =>
    new Intl.DateTimeFormat(locale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date),
  )
}

export function formatDateTime(iso: string): string {
  return whenValid(iso, (date) =>
    new Intl.DateTimeFormat(locale(), {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date),
  )
}

/** "3 days ago"; falls back to an absolute date after a month. */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return EM_DASH

  const seconds = Math.round((then - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs > 60 * 60 * 24 * 30) return formatDate(iso)

  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (abs >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return rtf.format(0, 'minute')
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}${NBSP}B`
  if (bytes < 1024 * 1024) return `${number(bytes / 1024, 0)}${NBSP}KB`
  return `${number(bytes / (1024 * 1024), 1)}${NBSP}MB`
}
