import { expect, test } from '@playwright/test'

import { json, mockApi, SESSION, signedIn } from '../support/mockApi'

const overflow = (page: import('@playwright/test').Page) =>
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

test('the loop planner stacks the map over the form', async ({ page }) => {
  await signedIn(page)
  await page.goto('/es/loops')
  const map = page.locator('.maplibregl-canvas')
  const submit = page.getByRole('button', { name: 'Generar ruta' })
  await expect(map).toBeVisible()
  const [mapBox, submitBox] = await Promise.all([map.boundingBox(), submit.boundingBox()])
  expect(mapBox && submitBox && mapBox.y < submitBox.y).toBe(true)
  expect(await overflow(page)).toBeLessThanOrEqual(0)
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
