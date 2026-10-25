import { describe, expect, it } from 'vitest'

import { resolveLanguage } from '@/i18n/languages'

describe('resolveLanguage', () => {
  it('takes the language from the URL prefix', () => {
    expect(resolveLanguage('/en/loops')).toBe('en')
    expect(resolveLanguage('/es')).toBe('es')
    expect(resolveLanguage('/es/privacy')).toBe('es')
  })

  it('serves English on every path without a prefix', () => {
    expect(resolveLanguage('/')).toBe('en')
    expect(resolveLanguage('/loops')).toBe('en')
    expect(resolveLanguage('/privacy')).toBe('en')
  })

  it('ignores segments that merely start with a language code', () => {
    expect(resolveLanguage('/estate')).toBe('en')
    expect(resolveLanguage('/english')).toBe('en')
  })
})
