/**
 * Formato único para toda la app.
 *
 * Español: decimales con coma y espacio fino antes del %, también en las
 * coordenadas (mezclar 40.5964 con 68,8 en el mismo panel se lee como un fallo).
 * El signo menos es U+2212, no un guion, para que no rompa línea ni se confunda
 * con un separador.
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

/** 68,8 km · 118 km (sin decimales a partir de 100, donde ya no aportan). */
export function formatDistance(km: number): string {
  return `${number(km, km >= 100 ? 0 : 1)}${NBSP}km`
}

export function formatElevation(meters: number): string {
  return `${number(Math.round(meters), 0)}${NBSP}m`
}

/** Desnivel con signo explícito: +922 m / −921 m. */
export function formatSigned(meters: number): string {
  const rounded = Math.round(meters)
  const sign = rounded < 0 ? MINUS : '+'
  return `${sign}${number(Math.abs(rounded), 0)}${NBSP}m`
}

/** El backend da la duración en minutos: 178,4 → "2 h 58". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '—'
  const total = Math.round(minutes)
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest}${NBSP}min`
  if (rest === 0) return `${hours}${NBSP}h`
  return `${hours}${NBSP}h${NBSP}${String(rest).padStart(2, '0')}`
}

/** Fracción 0-1 → "4,1 %". */
export function formatRatio(ratio: number, decimals = 1): string {
  return `${number(ratio * 100, decimals)}${NBSP}%`
}

/** Porcentaje ya expresado como tal → "24,0 %". Un decimal siempre, para no bailar. */
export function formatPercent(percent: number, decimals = 1): string {
  const sign = percent < 0 ? MINUS : ''
  return `${sign}${number(Math.abs(percent), decimals)}${NBSP}%`
}

/** Puntuaciones 0-10 y 0-100 con un decimal fijo. */
export function formatScore(value: number, decimals = 1): string {
  return number(value, decimals)
}

/** 40,5964 · −3,6318 — mismo criterio decimal que el resto de la interfaz. */
export function formatCoordinates(lat: number, lon: number): string {
  const one = (value: number) =>
    `${value < 0 ? MINUS : ''}${number(Math.abs(value), 4)}`
  return `${one(lat)} · ${one(lon)}`
}

/**
 * `Intl.DateTimeFormat.format` lanza `RangeError` ante un `Date` inválido, lo
 * que tumbaría la pantalla entera por un solo campo mal formado. Una marca de
 * tiempo ilegible se pinta como raya.
 */
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

/** "hace 3 días". Cae a fecha absoluta pasado un mes, donde lo relativo estorba. */
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
