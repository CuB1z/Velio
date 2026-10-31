import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'

import { useTheme } from '@/hooks/useTheme'

const colours = () =>
  [...document.head.querySelectorAll('meta[name="theme-color"]')].map((meta) => meta.getAttribute('content'))

beforeEach(() => {
  for (const scheme of ['light', 'dark']) {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.setAttribute('media', `(prefers-color-scheme: ${scheme})`)
    meta.content = 'unset'
    document.head.append(meta)
  }
})

afterEach(() => {
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove())
  localStorage.clear()
})

it('paints the browser chrome with the ground of the theme the user picked', () => {
  const { result } = renderHook(() => useTheme())

  act(() => result.current.setPreference('dark'))
  expect(colours()).toEqual(['#000000', '#000000'])

  act(() => result.current.setPreference('light'))
  expect(colours()).toEqual(['#f7f8fa', '#f7f8fa'])
})

it('hands the chrome back to the OS scheme when the preference is system', () => {
  const { result } = renderHook(() => useTheme())

  act(() => result.current.setPreference('dark'))
  act(() => result.current.setPreference('system'))
  expect(colours()).toEqual(['#f7f8fa', '#000000'])
})
