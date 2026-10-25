import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'

import { ElevationProfile } from '@/components/route/ElevationProfile'
import i18n from '@/i18n'
import type { ElevationPoint } from '@/types/api'

const PROFILE: ElevationPoint[] = [
  { lat: 40.41, lon: -3.7, distance_m: 0, elevation_m: 650, grade_pct: null },
  { lat: 40.42, lon: -3.69, distance_m: 1000, elevation_m: 712, grade_pct: 6.2 },
  { lat: 40.43, lon: -3.68, distance_m: 2000, elevation_m: 690, grade_pct: -2.2 },
]

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 96, width: 400, height: 96, toJSON: () => ({}),
  })
})

it('reports the profile point under the pointer once per point, and null when it leaves', () => {
  const onHover = vi.fn()
  render(<ElevationProfile profile={PROFILE} distanceKm={2} height={96} onHover={onHover} />)
  const chart = screen.getByRole('img')

  fireEvent.pointerMove(chart, { clientX: 220 })
  expect(onHover).toHaveBeenLastCalledWith(PROFILE[1])

  fireEvent.pointerMove(chart, { clientX: 226 })
  expect(onHover).toHaveBeenCalledTimes(1)

  fireEvent.pointerMove(chart, { clientX: 385 })
  expect(onHover).toHaveBeenLastCalledWith(PROFILE[2])

  fireEvent.pointerLeave(chart)
  expect(onHover).toHaveBeenLastCalledWith(null)
  expect(onHover).toHaveBeenCalledTimes(3)
})
