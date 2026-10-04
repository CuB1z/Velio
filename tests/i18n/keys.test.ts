import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import en from '@/i18n/en'
import es from '@/i18n/es'

/**
 * Keys built at runtime (`metric.comfort.excellent`, `surface.dirt`, ...) never
 * appear literally in a `t()` call, so a missing translation renders as the key.
 */
const RUNTIME_KEYS = [
  'metric.comfort.excellent',
  'metric.comfort.good',
  'metric.comfort.fair',
  'metric.comfort.demanding',
  'metric.scoreBreakdown.distance',
  'metric.scoreBreakdown.safety',
  'metric.scoreBreakdown.surface',
  'metric.scoreBreakdown.elevation',
  'metric.scoreBreakdown.overlap',
  'surface.paved_smooth',
  'surface.paved',
  'surface.paved_rough',
  'surface.compacted',
  'surface.gravel',
  'surface.dirt',
  'surface.path',
  'surface.sand',
  'surface.impassable',
  'surface.__unknown',
  'map.position.denied',
  'map.position.unavailable',
  'map.position.timeout',
  'map.position.unsupported',
  'auth.heroStatAreaValue',
  'auth.heroStatDemValue',
  'auth.heroStatSpeedValue',
]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.tsx?$/.test(path) && !path.includes('.test.')) out.push(path)
  }
  return out
}

function get(bundle: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((value, part) => {
    if (typeof value !== 'object' || value === null) return undefined
    return (value as Record<string, unknown>)[part]
  }, bundle)
}

describe('translation keys', () => {
  const sources = walk('src')
  const used = new Set<string>()
  // Keys also live in Records indexed later: count any 'section.key' literal
  // whose section exists in the bundle.
  const sections = new Set(Object.keys(en))
  for (const file of sources) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(match[1])
    for (const match of text.matchAll(/'([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)'/g)) {
      if (sections.has(match[1].split('.')[0])) used.add(match[1])
    }
  }
  for (const key of RUNTIME_KEYS) used.add(key)

  it.each([...used].sort())('%s exists in both languages', (key) => {
    expect(typeof get(es, key), `es.${key}`).toBe('string')
    expect(typeof get(en, key), `en.${key}`).toBe('string')
  })
})
