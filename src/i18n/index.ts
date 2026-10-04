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
    // sin localStorage: se decide por el idioma del navegador
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

/** format.ts lee el idioma de <html lang>, así que hay que mantenerlo al día. */
function syncDocumentLanguage(language: string): void {
  document.documentElement.lang = language
}

syncDocumentLanguage(initial)

i18n.on('languageChanged', (language) => {
  syncDocumentLanguage(language)
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // sin persistencia; el idioma sigue aplicado en esta sesión
  }
})

export default i18n
