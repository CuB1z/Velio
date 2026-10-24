import { act, renderHook } from '@testing-library/react'
import { beforeAll, expect, it } from 'vitest'

import { profilePointLabel, useProfileFocus } from '@/hooks/useProfileFocus'
import i18n from '@/i18n'

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

const climb = { lat: 40.8, lon: -3.9, distance_m: 12340, elevation_m: 1024.4, grade_pct: 8.47 }

it('labels a point with distance, altitude and grade', () => {
  expect(profilePointLabel(climb)).toMatch(/^12,3\s*km · 1024\s*m · 8,5\s*%$/)
  expect(profilePointLabel({ ...climb, distance_m: 0, grade_pct: null })).toMatch(/^0,0\s*km · 1024\s*m$/)
})

it('turns the hovered point into a map focus point as [lon, lat]', () => {
  const { result } = renderHook(() => useProfileFocus())
  act(() => result.current.onProfileHover(climb))
  expect(result.current.focusPoint?.coordinate).toEqual([-3.9, 40.8])
  act(() => result.current.onProfileHover(null))
  expect(result.current.focusPoint).toBeNull()
})
