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

/** Formatters insert narrow spaces; normalise them for comparison. */
const norm = (value: string) => value.replace(/[  ]/g, ' ')

describe('number formatting', () => {
  it('uses comma decimals for distances and drops them from 100 km', () => {
    expect(norm(formatDistance(68.84))).toBe('68,8 km')
    expect(norm(formatDistance(118.42))).toBe('118 km')
  })

  it('signs elevation with the typographic minus', () => {
    expect(norm(formatSigned(922.2))).toBe('+922 m')
    expect(norm(formatSigned(-921.34))).toBe('−921 m')
  })

  it('converts API minutes into hours and minutes', () => {
    expect(norm(formatDuration(178.4))).toBe('2 h 58')
    expect(norm(formatDuration(45))).toBe('45 min')
    expect(norm(formatDuration(120))).toBe('2 h')
    expect(formatDuration(Number.NaN)).toBe('—')
  })

  it('distinguishes a fraction from a precomputed percentage', () => {
    expect(norm(formatRatio(0.0412))).toBe('4,1 %')
    expect(norm(formatPercent(24))).toBe('24,0 %')
    expect(norm(formatPercent(-12.4))).toBe('−12,4 %')
  })

  it('writes coordinates with the same decimal comma as the rest', () => {
    // Mixing 40.5964 and 68,8 in one panel reads as a bug.
    expect(formatCoordinates(40.5964, -3.6318)).toBe('40,5964 · −3,6318')
  })
})

describe('unreadable dates', () => {
  // A broken timestamp must not crash the page rendering it.
  it('returns a dash instead of throwing', () => {
    expect(formatDate('2026-9-28T08:12:00Z')).toBe('—')
    expect(formatDateTime('nope')).toBe('—')
    expect(formatRelative('')).toBe('—')
  })
})
