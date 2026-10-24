/**
 * Mirror of the backend password policy, for instant feedback only.
 * The server stays authoritative (422 VALIDATION_ERROR).
 */
export type PasswordRule = {
  id: 'length' | 'lower' | 'upper' | 'digit' | 'notEmail'
  passed: boolean
}

export function checkPassword(password: string, email = ''): PasswordRule[] {
  const localPart = email.split('@')[0]?.toLowerCase() ?? ''
  const lower = password.toLowerCase()

  return [
    { id: 'length', passed: password.length >= 8 && password.length <= 128 },
    { id: 'lower', passed: /[a-z]/.test(password) },
    { id: 'upper', passed: /[A-Z]/.test(password) },
    { id: 'digit', passed: /\d/.test(password) },
    {
      id: 'notEmail',
      passed:
        password.length > 0 &&
        lower !== email.toLowerCase() &&
        (localPart.length < 3 || !lower.includes(localPart)),
    },
  ]
}

export function isPasswordValid(password: string, email = ''): boolean {
  return checkPassword(password, email).every((rule) => rule.passed)
}
