import polyline from '@mapbox/polyline'
import { expect, test } from '@playwright/test'

import { LANDING_EXAMPLES } from '../../src/pages/landingExamples'
import { json, LOOP, signedIn, sse } from '../support/mockApi'

const visible = (locator: import('@playwright/test').Locator) => locator.filter({ visible: true }).first()

test('a loop streams in, shows its figures on the map panel and can be saved', async ({ page }) => {
  let saved: unknown = null
  await signedIn(page, {
    '**/api/v1/loops/stream': (route) =>
      route.fulfill(
        sse(['progress', { seed: 1, seeds: 6, iteration: 0, distance_km: null }], ['loop', LOOP], ['result', LOOP]),
      ),
    '**/api/v1/routes/saved': async (route) => {
      saved = route.request().postDataJSON()
      await route.fulfill(
        json({ id: 's1', name: 'Domingo', created_at: '2026-10-10T08:00:00Z', updated_at: '2026-10-10T08:00:00Z', payload: LOOP }, 201),
      )
    },
  })
  await page.goto('/loops')
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()

  await page.getByRole('button', { name: 'Generar ruta' }).click()
  await expect(visible(page.getByText('31,2 km'))).toBeVisible()

  await visible(page.getByRole('button', { name: 'Guardar' })).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(visible(page.getByRole('button', { name: 'Guardada' }))).toBeVisible()
  expect(saved).toMatchObject({ payload: { distance_km: 31.2 } })
})

test('a rate limited generate keeps the button disabled with the wait', async ({ page }) => {
  await signedIn(page, {
    '**/api/v1/loops/stream': (route) =>
      route.fulfill({ ...json({ error: 'RATE_LIMITED', message: 'Too many requests' }, 429), headers: { 'retry-after': '5' } }),
  })
  await page.goto('/loops')
  await page.getByRole('button', { name: 'Generar ruta' }).click()
  await expect(page.getByRole('button', { name: /^Espera \d s$/ })).toBeDisabled()
})

test('a point to point route with the default stops', async ({ page }) => {
  await signedIn(page, { '**/api/v1/routes': (route) => route.fulfill(json(LOOP)) })
  await page.goto('/routes')
  await page.getByRole('button', { name: 'Trazar la ruta' }).click()
  await expect(visible(page.getByText('31,2 km'))).toBeVisible()
})

test('hovering the elevation profile marks that point on the map', async ({ page }) => {
  const sierra = LANDING_EXAMPLES[1]
  const loop = { ...sierra.result, polyline: polyline.encode(sierra.shape, 6), profile: sierra.profile, alternatives: null }
  await signedIn(page, { '**/api/v1/loops/stream': (route) => route.fulfill(sse(['result', loop])) })
  await page.goto('/loops')
  await page.getByRole('button', { name: 'Generar ruta' }).click()

  const chart = visible(page.getByRole('img', { name: /Perfil de elevación/ }))
  await expect(chart).toBeVisible()
  const box = await chart.boundingBox()
  if (!box) throw new Error('profile not laid out')
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2)

  const marker = page.locator('.maplibregl-marker', { hasText: ' km · ' })
  await expect(marker).toBeVisible()
  await expect(marker).toHaveText(/^\d+,\d\s*km · [\d.]+\s*m/)

  await page.mouse.move(box.x + box.width * 0.6, box.y - 200)
  await expect(marker).toHaveCount(0)
})
