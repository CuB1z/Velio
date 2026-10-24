import { renderHook } from '@testing-library/react'
import { beforeAll, expect, it } from 'vitest'

import { ApiError } from '@/api/errors'
import { useApiErrorMessage } from '@/components/common/apiErrorMessage'
import i18n from '@/i18n'

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

it('names the covered regions when a point is out of coverage', () => {
  const { result } = renderHook(() => useApiErrorMessage())
  const error = new ApiError({
    code: 'OUT_OF_COVERAGE',
    message: 'Some points are outside the covered regions',
    status: 422,
    details: { points: [0], regions: ['AD', 'ES', 'PT'] },
  })

  expect(result.current(error)).toBe(
    'Algún punto queda fuera de la zona que cubrimos por ahora (Andorra, España y Portugal).',
  )
})
