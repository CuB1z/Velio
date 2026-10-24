import { describe, expect, it } from 'vitest'

import { checkPassword, isPasswordValid } from '@/lib/passwordPolicy'

describe('password policy', () => {
  it("accepts a password meeting the backend's four rules", () => {
    expect(isPasswordValid('Secret-123', 'rider@example.com')).toBe(true)
  })

  it('rejects on length, lowercase, uppercase or digit', () => {
    expect(isPasswordValid('Ab1', '')).toBe(false)
    expect(isPasswordValid('SECRET-123', '')).toBe(false)
    expect(isPasswordValid('secret-123', '')).toBe(false)
    expect(isPasswordValid('SecretPass', '')).toBe(false)
  })

  it("rejects a password containing the email's local part", () => {
    const rule = checkPassword('Rider-2026', 'rider@example.com').find(
      (item) => item.id === 'notEmail',
    )
    expect(rule?.passed).toBe(false)
  })

  it('ignores local parts too short to be meaningful', () => {
    const rule = checkPassword('Abc-12345', 'ab@example.com').find((item) => item.id === 'notEmail')
    expect(rule?.passed).toBe(true)
  })
})
