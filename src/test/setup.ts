import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Without `globals: true` testing-library skips its auto-cleanup and DOM leaks between tests.
afterEach(cleanup)

// jsdom lacks ResizeObserver, which the charts use to measure themselves.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

// matchMedia is queried by the theme and reduced-motion checks.
globalThis.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof globalThis.matchMedia
