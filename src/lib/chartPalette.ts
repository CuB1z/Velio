/**
 * Colores de datos resueltos a hex literal: los gráficos y los SVG necesitan
 * el valor real, no `var(--…)`, para degradados y cálculos. Se leen del tema
 * cuando el token existe y caen a estas listas cuando no (SSR, tests).
 *
 * `status` es la excepción y no sigue al tema: verde, ámbar y rojo significan
 * algo por sí mismos y no deben moverse con la marca.
 *
 * Cada modo tiene sus propios pasos, no un volteo automático del otro. Ambas
 * listas pasan las seis comprobaciones del validador contra su fondo real
 * (#FFFFFF y #222222): banda de luminosidad, croma mínimo, separación para
 * daltonismo, suelo de visión normal y contraste.
 *
 * Aviso del validador: el par naranja↔verde queda en la banda baja de
 * tritanopía (ΔE 5,0 claro / 3,7 oscuro). Solo es admisible con codificación
 * secundaria, así que todo uso categórico lleva etiqueta directa y separación
 * de 2 px entre tramos. No quitar las etiquetas.
 */

export type ChartMode = 'light' | 'dark'

/** Orden fijo. Un color pertenece a la entidad, nunca a su posición en el ranking. */
const CATEGORICAL: Record<ChartMode, string[]> = {
  light: ['#126CC7', '#0E8F6F', '#B4531A', '#7A3EA1', '#A8123F'],
  dark: ['#388AE8', '#2B9F7E', '#CD6A35', '#A66AD0', '#DF4F6B'],
}

/** Gris neutro para "sin datos": no es una categoría más, es la ausencia de una. */
const NEUTRAL: Record<ChartMode, string> = {
  light: '#9AA1AB',
  dark: '#6E7681',
}

/** Un solo tono para magnitud (perfil de elevación, barras de puntuación). */
const ACCENT: Record<ChartMode, string> = {
  light: '#126CC7',
  dark: '#4188DB',
}

/** Reservados para estado. Nunca se reutilizan como "serie 4". */
const STATUS = {
  light: { good: '#1F7A4D', warning: '#96590B', critical: '#B02020' },
  dark: { good: '#4FBE85', warning: '#D89A3A', critical: '#E8695F' },
} as const

const INK: Record<ChartMode, { grid: string; axis: string; muted: string; surface: string }> = {
  light: { grid: '#E8ECF1', axis: '#C7CED7', muted: '#6B7280', surface: '#FFFFFF' },
  dark: { grid: '#333333', axis: '#454545', muted: '#A1A1A1', surface: '#222222' },
}

/**
 * Un color del tema, si está definido; si no, el valor compilado.
 *
 * Los colores de los gráficos vivían solo aquí, en TypeScript, así que un
 * cambio de identidad visual podía mover toda la interfaz menos las barras y
 * las leyendas. Leyéndolos del CSS, una dirección completa es solo tema.
 */
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
  // Un 6.º color no se genera: cae al neutro y se agrupa como "otros".
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

/**
 * Color de firme por tipo, estable entre rutas: el asfalto siempre es azul y
 * la tierra siempre naranja, aunque cambien de orden o desaparezcan.
 */
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
