import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { isLanguage } from '@/i18n/languages'

export function withLang(path: string, lang: string): string {
  return `/${lang}${path === '/' ? '' : path}`
}

export function swapLang(pathname: string, lang: string): string {
  const [, first, ...rest] = pathname.split('/')
  return withLang(isLanguage(first) ? `/${rest.join('/')}` : pathname, lang)
}

export function useLangPath() {
  const { i18n } = useTranslation()
  return useCallback((path: string) => withLang(path, i18n.language), [i18n.language])
}
