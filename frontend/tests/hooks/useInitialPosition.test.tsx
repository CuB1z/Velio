import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useInitialPosition } from '@/hooks/useInitialPosition'

function Probe({
  onPosition,
  onFailure,
}: {
  onPosition: (p: { lat: number; lon: number }) => void
  onFailure?: (cause: string) => void
}) {
  useInitialPosition(onPosition, onFailure)
  return null
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useInitialPosition', () => {
  it('delivers the browser position when available', () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: 40.45, longitude: -3.69 } } as GeolocationPosition),
    )
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
    const onPosition = vi.fn()

    render(<Probe onPosition={onPosition} />)

    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(onPosition).toHaveBeenCalledWith({ lat: 40.45, lon: -3.69 })
  })

  it('does nothing and does not crash without geolocation', () => {
    vi.stubGlobal('navigator', {})
    const onPosition = vi.fn()

    render(<Probe onPosition={onPosition} />)

    expect(onPosition).not.toHaveBeenCalled()
  })

  it('keeps the default and reports why when permission is denied', () => {
    const getCurrentPosition = vi.fn((_ok: PositionCallback, fail?: PositionErrorCallback) =>
      fail?.({ code: 1, message: 'denied' } as GeolocationPositionError),
    )
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const onPosition = vi.fn()
    const onFailure = vi.fn()

    render(<Probe onPosition={onPosition} onFailure={onFailure} />)

    expect(onPosition).not.toHaveBeenCalled()
    expect(onFailure).toHaveBeenCalledWith('denied')
  })

  it('tells "unavailable" apart from "denied" (Brave on Linux)', () => {
    const getCurrentPosition = vi.fn((_ok: PositionCallback, fail?: PositionErrorCallback) =>
      fail?.({ code: 2, message: 'Network location provider error' } as GeolocationPositionError),
    )
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const onFailure = vi.fn()

    render(<Probe onPosition={vi.fn()} onFailure={onFailure} />)

    expect(onFailure).toHaveBeenCalledWith('unavailable')
  })
})
