import { isLanguage } from '@/i18n/languages'

export function withLang(path: string, lang: string): string {
  return `/${lang}${path === '/' ? '' : path}`
}

export function swapLang(pathname: string, lang: string): string {
  const [, first, ...rest] = pathname.split('/')
  return withLang(isLanguage(first) ? `/${rest.join('/')}` : pathname, lang)
}
