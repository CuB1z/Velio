import { describe, expect, it } from 'vitest'

import { damp, neighbour, settle, stretch } from '@/lib/sheet'

describe('settle', () => {
  it('moves one stop once the drag passes 40 px', () => {
    expect(settle('full', 60, 0)).toBe('peek')
    expect(settle('peek', -60, 0)).toBe('full')
    expect(settle('peek', 30, 0)).toBe('peek')
  })

  it('moves on a fast flick even under 40 px, in the flick direction', () => {
    expect(settle('peek', 20, 0.6)).toBe('hidden')
    expect(settle('hidden', -15, -0.5)).toBe('peek')
    expect(settle('full', 80, -0.9)).toBe('full')
  })

  it('stays on the end stops', () => {
    expect(settle('full', -200, -2)).toBe('full')
    expect(settle('hidden', 200, 2)).toBe('hidden')
    expect(neighbour('hidden', -1)).toBe('hidden')
  })
})

describe('stretch', () => {
  it('follows the finger inside the range and gives less and less past it', () => {
    expect(stretch(300, 44, 600)).toBe(300)
    expect(damp(0)).toBe(0)
    expect(damp(100)).toBeLessThan(100)
    expect(damp(200) - damp(100)).toBeLessThan(damp(100))
    expect(stretch(700, 44, 600)).toBeCloseTo(600 + damp(100))
    expect(stretch(4, 44, 600)).toBeCloseTo(44 - damp(40))
  })
})
