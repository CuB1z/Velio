export type Device = { browser: string | null; platform: string | null; mobile: boolean }

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/CriOS\//, 'Chrome'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

const PLATFORMS: [RegExp, string][] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Ubuntu/, 'Ubuntu'],
  [/Linux/, 'Linux'],
]

/** The browser and platform a session came from, read off its User-Agent. */
export function parseUserAgent(userAgent: string | null): Device {
  if (!userAgent) return { browser: null, platform: null, mobile: false }
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null
  const platform = PLATFORMS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null
  return { browser, platform, mobile: /iPhone|iPad|Android|Mobile/.test(userAgent) }
}
