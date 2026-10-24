import { expect, test } from '@playwright/test'

import { json, mockApi, SESSION } from '../support/mockApi'

const emptyList = json({ data: [], meta: { page: 1, limit: 12, total: 0, total_pages: 1, is_last: true } })

test('a guest is sent to the login and returns to the page they asked for', async ({ page }) => {
  await mockApi(page, {
    '**/api/v1/auth/login': (route) => route.fulfill(json(SESSION)),
    '**/api/v1/routes/saved*': (route) => route.fulfill(emptyList),
  })
  await page.goto('/es/saved')
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel(/Correo electrónico/).fill('marta@velio.cc')
  await page.getByLabel(/^Contraseña/).fill('Ruta2026x')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/saved$/)
  await expect(page.getByRole('heading', { name: 'Rutas guardadas' })).toBeVisible()
})

test('registering needs a valid password and the terms, then asks for the emailed code', async ({ page }) => {
  await mockApi(page, { '**/api/v1/auth/register': (route) => route.fulfill(json(SESSION.user, 201)) })
  await page.goto('/es/register')
  const submit = page.getByRole('button', { name: 'Crear cuenta' })
  await expect(submit).toBeDisabled()

  await page.getByLabel(/Correo electrónico/).fill('marta@velio.cc')
  await page.getByLabel(/^Contraseña/).fill('corta')
  await page.getByRole('checkbox').check({ force: true })
  await expect(submit).toBeDisabled()

  await page.getByLabel(/^Contraseña/).fill('Ruta2026x')
  await expect(submit).toBeEnabled()
  await submit.click()

  await expect(page).toHaveURL(/\/verify\?email=marta%40velio\.cc$/)
  await expect(page.getByRole('heading', { name: 'Confirma tu correo' })).toBeVisible()
  await expect(page.getByText('Código incorrecto')).toHaveCount(0)
})

test('a rate limited login counts the Retry-After down before allowing another try', async ({ page }) => {
  await mockApi(page, {
    '**/api/v1/auth/login': (route) =>
      route.fulfill({ ...json({ error: 'RATE_LIMITED', message: 'Too many requests' }, 429), headers: { 'retry-after': '2' } }),
  })
  await page.goto('/es/login')
  await page.getByLabel(/Correo electrónico/).fill('marta@velio.cc')
  await page.getByLabel(/^Contraseña/).fill('Ruta2026x')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByRole('button', { name: 'Espera 2 s' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Espera 1 s' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled({ timeout: 4000 })
})
