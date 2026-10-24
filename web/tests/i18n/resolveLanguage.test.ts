import { describe, expect, it } from 'vitest'

import { resolveLanguage } from '@/i18n/languages'

describe('resolveLanguage', () => {
  it('takes the URL prefix over everything else', () => {
    expect(resolveLanguage('/en/loops', 'es', 'es-ES')).toBe('en')
    expect(resolveLanguage('/es', 'en', 'en-US')).toBe('es')
  })

  it('falls back to the stored preference without a prefix', () => {
    expect(resolveLanguage('/loops', 'en', 'es-ES')).toBe('en')
    expect(resolveLanguage('/', 'es', 'en-US')).toBe('es')
  })

  it('falls back to the browser language, defaulting to English', () => {
    expect(resolveLanguage('/', null, 'es-ES')).toBe('es')
    expect(resolveLanguage('/', null, 'fr-FR')).toBe('en')
    expect(resolveLanguage('/', null, undefined)).toBe('en')
  })

  it('ignores segments that merely start with a language code', () => {
    expect(resolveLanguage('/estate', null, 'fr-FR')).toBe('en')
    expect(resolveLanguage('/english', 'es', 'fr-FR')).toBe('es')
  })
})
