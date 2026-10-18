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

  it('falls back to the browser language, defaulting to Spanish', () => {
    expect(resolveLanguage('/', null, 'en-GB')).toBe('en')
    expect(resolveLanguage('/', null, 'fr-FR')).toBe('es')
    expect(resolveLanguage('/', null, undefined)).toBe('es')
  })

  it('ignores segments that merely start with a language code', () => {
    expect(resolveLanguage('/english', null, 'fr-FR')).toBe('es')
    expect(resolveLanguage('/estate', 'en', 'fr-FR')).toBe('en')
  })
})
