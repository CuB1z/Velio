import { describe, expect, it } from 'vitest'

import { swapLang, withLang } from '@/lib/paths'

describe('withLang', () => {
  it('prefixes a path with the language', () => {
    expect(withLang('/loops', 'es')).toBe('/es/loops')
    expect(withLang('/saved/42', 'en')).toBe('/en/saved/42')
  })

  it('maps the root to the bare prefix', () => {
    expect(withLang('/', 'en')).toBe('/en')
  })
})

describe('swapLang', () => {
  it('replaces an existing prefix', () => {
    expect(swapLang('/es/account', 'en')).toBe('/en/account')
    expect(swapLang('/en', 'es')).toBe('/es')
  })

  it('prefixes a path that has none', () => {
    expect(swapLang('/account', 'en')).toBe('/en/account')
    expect(swapLang('/', 'en')).toBe('/en')
  })

  it('leaves segments that only look like a language alone', () => {
    expect(swapLang('/english/guide', 'es')).toBe('/es/english/guide')
  })
})
