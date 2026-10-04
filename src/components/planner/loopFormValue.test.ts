import { describe, expect, it } from 'vitest'

import { DEFAULT_LOOP_FORM, toLoopRequest } from './loopFormValue'

describe('toLoopRequest', () => {
  it('sends both filters and no raw costing', () => {
    // The bike is the bicycle_type; a raw costing would override it in the backend.
    const request = toLoopRequest({ ...DEFAULT_LOOP_FORM, bike: 'gravel', hills: 'hilly' })

    expect(request?.bike).toBe('gravel')
    expect(request?.hills).toBe('hilly')
    expect(request?.costing).toBeUndefined()
  })

  it('omits the elevation target when it is off', () => {
    const request = toLoopRequest({ ...DEFAULT_LOOP_FORM, gainEnabled: false })

    expect(request?.gain_m).toBeUndefined()
    expect(request?.gain_tolerance).toBeUndefined()
    // The climbing preference is independent of the exact target.
    expect(request?.hills).toBe('rolling')
  })

  it('counts alternatives on top of the main loop', () => {
    expect(toLoopRequest(DEFAULT_LOOP_FORM)?.routes).toBeUndefined()
    expect(toLoopRequest({ ...DEFAULT_LOOP_FORM, alternatives: 3 })?.routes).toBe(4)
  })

  it('does not request a route without an origin', () => {
    expect(toLoopRequest({ ...DEFAULT_LOOP_FORM, origin: null })).toBeNull()
  })
})
