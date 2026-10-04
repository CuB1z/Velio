import { describe, expect, it } from 'vitest'

import { checkPassword, isPasswordValid } from './passwordPolicy'

describe('política de contraseña', () => {
  it('acepta la que cumple las cuatro condiciones del backend', () => {
    expect(isPasswordValid('Secret-123', 'rider@example.com')).toBe(true)
  })

  it('rechaza por longitud, minúscula, mayúscula o dígito', () => {
    expect(isPasswordValid('Ab1', '')).toBe(false)
    expect(isPasswordValid('SECRET-123', '')).toBe(false)
    expect(isPasswordValid('secret-123', '')).toBe(false)
    expect(isPasswordValid('SecretPass', '')).toBe(false)
  })

  it('rechaza que contenga la parte local del correo', () => {
    const rule = checkPassword('Rider-2026', 'rider@example.com').find(
      (item) => item.id === 'notEmail',
    )
    expect(rule?.passed).toBe(false)
  })

  it('no penaliza partes locales demasiado cortas para ser señal', () => {
    const rule = checkPassword('Abc-12345', 'ab@example.com').find((item) => item.id === 'notEmail')
    expect(rule?.passed).toBe(true)
  })
})
