import { describe, expect, it } from 'vitest'

import en from './en'
import es from './es'

/** Sorted paths of every leaf in the object. */
function leafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => leafPaths(child, prefix ? `${prefix}.${key}` : key))
    .sort()
}

describe('translations', () => {
  it('es and en have exactly the same keys', () => {
    // A key missing in one language renders as "auth.loginTitle".
    expect(leafPaths(en)).toEqual(leafPaths(es))
  })

  it('has no empty strings', () => {
    for (const [name, bundle] of [
      ['es', es],
      ['en', en],
    ] as const) {
      const walk = (value: unknown, path: string): void => {
        if (typeof value === 'string') {
          expect(value.trim(), `${name}.${path}`).not.toBe('')
          return
        }
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
          walk(child, path ? `${path}.${key}` : key)
        }
      }
      walk(bundle, '')
    }
  })

  it('interpolations match across languages', () => {
    const placeholders = (value: unknown): string[] =>
      typeof value === 'string' ? [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort() : []

    const walk = (a: unknown, b: unknown, path: string): void => {
      if (typeof a === 'string' || typeof b === 'string') {
        expect(placeholders(b), path).toEqual(placeholders(a))
        return
      }
      for (const key of Object.keys(a as Record<string, unknown>)) {
        walk(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key,
        )
      }
    }
    walk(es, en, '')
  })
})
