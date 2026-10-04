import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './en'
import es from './es'

export const LANGUAGES = ['es', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'velio.lang'

function detect(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'es' || stored === 'en') return stored
  } catch {
    // no localStorage: fall back to the browser language
  }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es'
}

const initial = detect()

void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: initial,
  fallbackLng: 'es',
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
