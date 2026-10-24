import { useCallback, useSyncExternalStore } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'velio.theme'
const listeners = new Set<() => void>()

function read(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // localStorage unavailable: fall back to the system preference.
  }
  return 'system'
}

let preference: ThemePreference = read()

const media =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function resolve(value: ThemePreference): 'light' | 'dark' {
  if (value === 'system') return media?.matches ? 'dark' : 'light'
  return value
}

/** <html> always carries one of the two classes: HeroUI themes by class. */
function apply(): void {
  const dark = resolve(preference) === 'dark'
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.classList.toggle('light', !dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
}

if (typeof document !== 'undefined') apply()

function emit(): void {
  apply()
  for (const listener of listeners) listener()
}

// With the "system" preference, follow OS changes live.
media?.addEventListener('change', () => {
  if (preference === 'system') emit()
})

// Another tab changed the theme: mirror it here.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    preference = read()
    emit()
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme(): {
  preference: ThemePreference
  resolved: 'light' | 'dark'
  setPreference: (next: ThemePreference) => void
  toggle: () => void
} {
  const current = useSyncExternalStore(
    subscribe,
    () => preference,
    () => 'system' as ThemePreference,
  )

  const setPreference = useCallback((next: ThemePreference) => {
    preference = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // not persisted, but the theme still applies for this session
    }
    emit()
  }, [])

  const toggle = useCallback(() => {
    setPreference(resolve(preference) === 'dark' ? 'light' : 'dark')
  }, [setPreference])

  return { preference: current, resolved: resolve(current), setPreference, toggle }
}

/** The map needs the resolved theme outside React. */
export function currentlyDark(): boolean {
  return resolve(preference) === 'dark'
}
