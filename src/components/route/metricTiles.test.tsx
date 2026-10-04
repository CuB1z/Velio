import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import type { LoopResult } from '@/types/api'
import { MetricTiles } from './metricTiles'

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

const LOOP: LoopResult = {
  distance_km: 60,
  gain_m: 768,
  loss_m: 768,
  feasible: true,
  iterations: 3,
  polyline: '',
  duration_min: 200,
  overlap_ratio: 0.02,
  score: null,
  cycling_score: null,
}

describe('MetricTiles', () => {
  it('sin objetivo de desnivel enseña la densidad de subida', () => {
    // 768 m en 60 km: es lo que distingue «llano» de «montañoso» a la vista.
    render(<MetricTiles result={LOOP} targetKm={60} />)
    expect(screen.getByText('12,8 m/km')).toBeInTheDocument()
  })

  it('con objetivo, el objetivo manda en la pista', () => {
    render(<MetricTiles result={LOOP} targetKm={60} targetGainM={900} />)
    expect(screen.queryByText(/m\/km/)).not.toBeInTheDocument()
    expect(screen.getByText(/\+900 m/)).toBeInTheDocument()
  })
})
