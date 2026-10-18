import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

import { useActiveSection } from '@/hooks/useActiveSection'

const IDS = ['a', 'b', 'c']

function mount(tops: number[], container?: HTMLElement) {
  const parent = container ?? document.body
  IDS.forEach((id, index) => {
    const section = document.createElement('section')
    section.id = id
    section.getBoundingClientRect = () => ({ top: tops[index] }) as DOMRect
    parent.append(section)
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

it('activates the last section whose top crossed the reading line', async () => {
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
  mount([-500, 100, 900])

  const { result } = renderHook(() => useActiveSection(IDS))
  await waitFor(() => expect(result.current).toBe('b'))

  for (const [index, top] of [-900, -300, 500].entries()) {
    const section = document.getElementById(IDS[index])!
    section.getBoundingClientRect = () => ({ top }) as DOMRect
  }
  window.dispatchEvent(new Event('scroll'))
  await waitFor(() => expect(result.current).toBe('b'))

  document.getElementById('c')!.getBoundingClientRect = () => ({ top: 300 }) as DOMRect
  window.dispatchEvent(new Event('scroll'))
  await waitFor(() => expect(result.current).toBe('c'))
})

it('falls back to the first section before anything crossed the line', async () => {
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
  mount([600, 1200, 1800])

  const { result } = renderHook(() => useActiveSection(IDS))
  await waitFor(() => expect(result.current).toBe('a'))
})

it('activates the last section at the bottom of a scroll container', async () => {
  const container = document.createElement('main')
  container.style.overflowY = 'auto'
  Object.defineProperties(container, {
    clientHeight: { value: 800 },
    scrollHeight: { value: 3000 },
    scrollTop: { value: 2200, writable: true },
  })
  container.getBoundingClientRect = () => ({ top: 0 }) as DOMRect
  document.body.append(container)
  mount([-1400, -600, 500], container)

  const { result } = renderHook(() => useActiveSection(IDS))
  await waitFor(() => expect(result.current).toBe('c'))
})
