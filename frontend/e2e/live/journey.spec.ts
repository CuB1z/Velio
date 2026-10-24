import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'
import { visible } from '../support/locators'

test.skip(!process.env.E2E_LIVE, 'needs the backend test stack (docker/docker-compose.test.yaml)')

test('a new rider signs up, plans a loop, saves, exports, analyses and signs out', async ({ page }) => {
  const email = `e2e-${randomUUID()}@example.com`
  const password = 'Ruta2026x'
  const name = `E2E ${email.slice(4, 12)}`

  await page.goto('/es/register')
  await page.getByLabel(/Correo electrónico/).fill(email)
  await page.getByLabel(/^Contraseña/).fill(password)
  await page.getByRole('checkbox').check({ force: true })
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page).toHaveURL(/\/verify\?email=/)
  await page.locator('input[autocomplete="one-time-code"]').fill('246810')
  await page.getByRole('button', { name: 'Confirmar' }).click()

  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel(/Correo electrónico/).fill(email)
  await page.getByLabel(/^Contraseña/).fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/loops$/)

  await page.getByRole('button', { name: 'Generar ruta' }).click()
  const save = visible(page.getByRole('button', { name: 'Guardar' }))
  await expect(save).toBeEnabled({ timeout: 120_000 })
  await expect(visible(page.getByText(/\d+,\d\s*km/))).toBeVisible()

  await save.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill(name)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(visible(page.getByRole('button', { name: 'Guardada' }))).toBeVisible()

  await visible(page.getByRole('button', { name: 'Exportar' })).click()
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120_000 }),
    page.getByRole('menuitem', { name: 'GPX, con altitud por punto' }).click(),
  ])
  const gpx = await download.path()
  expect(download.suggestedFilename()).toMatch(/\.gpx$/)

  await page.goto('/es/saved')
  await page.getByRole('link', { name: new RegExp(name) }).first().click()
  await expect(page.getByRole('heading', { name })).toBeVisible()

  await page.goto('/es/analyze')
  await page.locator('input[type="file"]').setInputFiles(gpx)
  await page.getByRole('button', { name: 'Analizar' }).click()
  await expect(visible(page.getByText(/\d+,\d\s*km/))).toBeVisible({ timeout: 60_000 })

  await page.goto('/es/saved')
  await page.getByRole('link', { name: new RegExp(name) }).first().click()
  await visible(page.getByRole('button', { name: 'Eliminar' })).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
  await expect(page).toHaveURL(/\/saved$/)
  await expect(page.getByText('Aún no has guardado ninguna ruta')).toBeVisible()

  await visible(page.getByRole('button', { name: 'Ajustes de cuenta' })).click()
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/es$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Circuitos a tu medida')
})
