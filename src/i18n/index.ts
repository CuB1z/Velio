import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './en'
import es from './es'

export const LANGUAGES = ['es', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'velio.lang'

export function isLanguage(value: string | null | undefined): value is Language {
  return LANGUAGES.includes(value as Language)
}

export function resolveLanguage(
  pathname: string,
  stored: string | null,
  navigatorLanguage: string | undefined,
): Language {
  const prefix = pathname.split('/')[1]
  if (isLanguage(prefix)) return prefix
  if (isLanguage(stored)) return stored
  return navigatorLanguage?.toLowerCase().startsWith('en') ? 'en' : 'es'
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const initial = resolveLanguage(location.pathname, readStored(), navigator.language)

void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: initial,
  fallbackLng: 'es',
  initAsync: false,
  interpolation: { escapeValue: false },
})

/** format.ts reads the locale from <html lang>, so keep it in sync. */
function syncDocumentLanguage(language: string): void {
  document.documentElement.lang = language
}

syncDocumentLanguage(initial)

i18n.on('languageChanged', (language) => {
  syncDocumentLanguage(language)
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // no persistence; the language still applies for this session
  }
})

export default i18n
