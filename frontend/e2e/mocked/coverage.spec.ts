import { expect, test } from '@playwright/test'

import { json, signedIn } from '../support/mockApi'
import { visible } from '../support/locators'

const box = [
  [-3.75, 40.38],
  [-3.65, 40.38],
  [-3.65, 40.45],
  [-3.75, 40.45],
  [-3.75, 40.38],
]
const COVERAGE = {
  regions: [{ key: 'spain', name: 'Spain', iso: 'ES' }],
  bbox: [-3.75, 40.38, -3.65, 40.45],
  geometry: { type: 'MultiPolygon', coordinates: [[box]] },
}

test('a click outside the coverage leads to asking for that country', async ({ page }) => {
  let asked: unknown = null
  await signedIn(page, {
    '**/api/v1/coverage': (route) => route.fulfill(json(COVERAGE)),
    '**/api/v1/coverage/requests': async (route) => {
      asked = route.request().postDataJSON()
      await route.fulfill(json({ country: 'FR', recorded: true }, 202))
    },
  })
  await page.goto('/es/loops')
  const canvas = page.locator('.maplibregl-canvas')
  await expect(canvas).toBeVisible()

  await page.getByLabel('Elegir en el mapa').first().click()
  const size = await canvas.boundingBox()
  await canvas.click({ position: { x: (size?.width ?? 400) - 80, y: (size?.height ?? 400) - 80 } })
  await visible(page.getByRole('button', { name: 'Pide tu país' })).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('textbox', { name: /Email/ })).toHaveCount(0)
  await dialog.getByRole('combobox', { name: /País/ }).fill('fran')
  await page.getByRole('option', { name: 'Francia' }).click()
  await dialog.getByRole('button', { name: 'Enviar petición' }).click()

  await expect(dialog.getByText('Contamos tu petición para Francia. Gracias.')).toBeVisible()
  expect(asked).toEqual({ country: 'FR' })
})
