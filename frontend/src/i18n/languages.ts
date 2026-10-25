export const LANGUAGES = ['es', 'en'] as const
export type Language = (typeof LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'en'

export const LANGUAGE_INFO: Record<Language, { name: string; locale: string }> = {
  es: { name: 'Español', locale: 'es-ES' },
  en: { name: 'English', locale: 'en-GB' },
}

export function isLanguage(value: string | null | undefined): value is Language {
  return LANGUAGES.includes(value as Language)
}

export function resolveLanguage(pathname: string): Language {
  const prefix = pathname.split('/')[1]
  return isLanguage(prefix) ? prefix : DEFAULT_LANGUAGE
}
