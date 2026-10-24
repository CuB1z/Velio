import { describe, expect, it } from 'vitest'

import { swapLang, withLang } from '@/lib/paths'

describe('withLang', () => {
  it('prefixes a path with a non-default language', () => {
    expect(withLang('/loops', 'es')).toBe('/es/loops')
    expect(withLang('/', 'es')).toBe('/es')
  })

  it('leaves the default language unprefixed', () => {
    expect(withLang('/saved/42', 'en')).toBe('/saved/42')
    expect(withLang('/', 'en')).toBe('/')
  })
})

describe('swapLang', () => {
  it('replaces or removes an existing prefix', () => {
    expect(swapLang('/es/account', 'en')).toBe('/account')
    expect(swapLang('/en/account', 'es')).toBe('/es/account')
    expect(swapLang('/es', 'en')).toBe('/')
  })

  it('prefixes an unprefixed path', () => {
    expect(swapLang('/account', 'es')).toBe('/es/account')
    expect(swapLang('/', 'es')).toBe('/es')
    expect(swapLang('/account', 'en')).toBe('/account')
  })

  it('leaves segments that only look like a language alone', () => {
    expect(swapLang('/english/guide', 'es')).toBe('/es/english/guide')
  })
})
