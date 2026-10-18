export const LANGUAGES = ['es', 'en'] as const
export type Language = (typeof LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'es'

export const LANGUAGE_INFO: Record<Language, { name: string; locale: string }> = {
  es: { name: 'Español', locale: 'es-ES' },
  en: { name: 'English', locale: 'en-GB' },
}

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
  const primary = navigatorLanguage?.toLowerCase().split('-')[0]
  return isLanguage(primary) ? primary : DEFAULT_LANGUAGE
}
