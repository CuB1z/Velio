import { describe, expect, it } from 'vitest'

import { compare, comparePaths } from '../../scripts/checkContract.mjs'

/**
 * Frontend and backend live in separate repos; only this test keeps their contracts in sync.
 * Compares against the versioned contract/openapi.json; refresh it with `pnpm contract:pull`.
 */
describe('backend contract', () => {
  it('types match the OpenAPI schema', () => {
    expect(compare()).toEqual([])
  })

  it('every path the frontend calls exists in the backend', () => {
    expect(comparePaths()).toEqual([])
  })
})
