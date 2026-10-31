import { act, renderHook } from '@testing-library/react'
import type { MouseEvent, PointerEvent } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useLongPress } from '@/hooks/useLongPress'

const touch = (x = 0, y = 0) => ({ pointerType: 'touch', clientX: x, clientY: y }) as PointerEvent
const click = () => ({ preventDefault: vi.fn(), stopPropagation: vi.fn() }) as unknown as MouseEvent

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('fires after a still half-second hold and swallows the click that ends it', () => {
  const onLongPress = vi.fn()
  const { result } = renderHook(() => useLongPress(onLongPress))

  act(() => result.current.onPointerDown?.(touch()))
  act(() => vi.advanceTimersByTime(500))
  expect(onLongPress).toHaveBeenCalledOnce()

  const ending = click()
  result.current.onClickCapture?.(ending)
  expect(ending.preventDefault).toHaveBeenCalled()

  const next = click()
  result.current.onPointerDown?.(touch())
  result.current.onPointerUp?.()
  result.current.onClickCapture?.(next)
  expect(next.preventDefault).not.toHaveBeenCalled()
})

it('gives up when the finger moves or lifts early, and opens on right-click', () => {
  const onLongPress = vi.fn()
  const { result } = renderHook(() => useLongPress(onLongPress))

  act(() => result.current.onPointerDown?.(touch(0, 0)))
  act(() => result.current.onPointerMove?.(touch(0, 24)))
  act(() => vi.advanceTimersByTime(600))
  act(() => result.current.onPointerDown?.(touch()))
  act(() => result.current.onPointerUp?.())
  act(() => vi.advanceTimersByTime(600))
  expect(onLongPress).not.toHaveBeenCalled()

  const contextMenu = click()
  act(() => result.current.onContextMenu?.(contextMenu))
  expect(contextMenu.preventDefault).toHaveBeenCalled()
  expect(onLongPress).toHaveBeenCalledOnce()
})

it('does nothing while disabled', () => {
  const { result } = renderHook(() => useLongPress(vi.fn(), false))
  expect(result.current).toEqual({})
})
