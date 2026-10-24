import { expect, test, type Page } from '@playwright/test'

import { json, mockApi, SESSION, signedIn } from '../support/mockApi'

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

test('the landing fits the screen without horizontal scroll', async ({ page }) => {
  await mockApi(page)
  await page.goto('/es')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await overflow(page)).toBeLessThanOrEqual(0)
})

test('the login keeps only the form, without the product panel', async ({ page }) => {
  await mockApi(page)
  await page.goto('/es/login')
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  await expect(page.getByText('Circuitos a tu medida, puntuados antes de salir.')).toBeHidden()
  expect(await overflow(page)).toBeLessThanOrEqual(0)
})

test('the loop planner puts the form in a sheet over a full-screen map', async ({ page }) => {
  await signedIn(page)
  await page.goto('/es/loops')
  const map = page.locator('.maplibregl-canvas')
  const submit = page.getByRole('button', { name: 'Generar ruta' })
  await expect(map).toBeVisible()
  await expect(submit).toBeInViewport()
  const viewport = page.viewportSize()!
  const mapBox = await map.boundingBox()
  expect(mapBox && mapBox.height > viewport.height * 0.8).toBe(true)
  expect(await overflow(page)).toBeLessThanOrEqual(0)

  expect((await page.getByRole('button', { name: 'Plegar el panel' }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await page.getByRole('button', { name: 'Plegar el panel' }).click()
  await expect(submit).toBeHidden()

  const handle = page.getByRole('button', { name: 'Desplegar el panel' })
  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 6 })
  await page.mouse.up()
  const hidden = page.getByRole('button', { name: 'Mostrar el panel' })
  await expect(hidden).toHaveAttribute('aria-expanded', 'false')
  expect((await hidden.boundingBox())!.y).toBeGreaterThan(viewport.height * 0.8)

  await hidden.click()
  await page.getByRole('button', { name: 'Desplegar el panel' }).click()
  await expect(submit).toBeInViewport()
})

test('the settings keep the section nav in reach while scrolling', async ({ page }) => {
  await signedIn(page, {
    '**/api/v1/auth/me': (route) => route.fulfill(json(SESSION.user)),
    '**/api/v1/auth/sessions': (route) => route.fulfill(json([])),
  })
  await page.goto('/es/account')
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible()
  expect(await overflow(page)).toBeLessThanOrEqual(0)

  const nav = page.getByRole('navigation', { name: 'Ajustes' })
  await nav.getByRole('link', { name: 'Cuenta' }).click()
  await expect(nav.getByRole('link', { name: 'Cuenta' })).toHaveAttribute('aria-current', 'true')
  await expect(nav).toBeInViewport()
  await expect(page.getByRole('heading', { name: 'Salir o eliminar' })).toBeInViewport()
})

test('the map attribution shows first and folds into its button after a few seconds', async ({ page }) => {
  await signedIn(page)
  await page.goto('/es/loops')
  const attribution = page.locator('.maplibregl-ctrl-attrib')
  await expect(attribution).toHaveClass(/maplibregl-compact-show/)
  await expect(attribution).not.toHaveClass(/maplibregl-compact-show/, { timeout: 8_000 })
  await expect(attribution.locator('.maplibregl-ctrl-attrib-button')).toBeVisible()
})

test('the GPX picker speaks of tapping, not dragging, on a touch screen', async ({ page }) => {
  await signedIn(page)
  await page.goto('/es/analyze')
  await expect(page.getByText('Elige tu GPX')).toBeVisible()
  await expect(page.getByText('Arrastra aquí tu GPX')).toBeHidden()
})
