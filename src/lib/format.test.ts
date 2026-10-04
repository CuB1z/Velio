import { describe, expect, it } from 'vitest'

import {
  formatCoordinates,
  formatDate,
  formatDateTime,
  formatDistance,
  formatDuration,
  formatPercent,
  formatRatio,
  formatRelative,
  formatSigned,
} from './format'

/** Los formatos meten espacios finos; para comparar da igual cuál sea. */
const norm = (value: string) => value.replace(/[  ]/g, ' ')

describe('formato de cifras', () => {
  it('usa coma decimal en distancias y quita decimales a partir de 100 km', () => {
    expect(norm(formatDistance(68.84))).toBe('68,8 km')
    expect(norm(formatDistance(118.42))).toBe('118 km')
  })

  it('marca el signo del desnivel con el menos tipográfico', () => {
    expect(norm(formatSigned(922.2))).toBe('+922 m')
    expect(norm(formatSigned(-921.34))).toBe('−921 m')
  })

  it('convierte los minutos de la API en horas y minutos', () => {
    expect(norm(formatDuration(178.4))).toBe('2 h 58')
    expect(norm(formatDuration(45))).toBe('45 min')
    expect(norm(formatDuration(120))).toBe('2 h')
    expect(formatDuration(Number.NaN)).toBe('—')
  })

  it('distingue fracción de porcentaje ya calculado', () => {
    expect(norm(formatRatio(0.0412))).toBe('4,1 %')
    expect(norm(formatPercent(24))).toBe('24,0 %')
    expect(norm(formatPercent(-12.4))).toBe('−12,4 %')
  })

  it('escribe las coordenadas con la misma coma decimal que el resto', () => {
    // Mezclar 40.5964 con 68,8 en el mismo panel se lee como un fallo.
    expect(formatCoordinates(40.5964, -3.6318)).toBe('40,5964 · −3,6318')
  })
})

describe('fechas ilegibles', () => {
  // Una marca de tiempo rota no debe tumbar la página que la pinta.
  it('devuelve raya en vez de lanzar', () => {
    expect(formatDate('2026-9-28T08:12:00Z')).toBe('—')
    expect(formatDateTime('nope')).toBe('—')
    expect(formatRelative('')).toBe('—')
  })
})
