import { expect, test } from '@playwright/test'

import { mockApi } from '../support/mockApi'

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

test('the landing shows the product without maps and leads to sign up', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Circuitos a tu medida')
  await expect(page.getByText('Sierra · Manzanares el Real').first()).toBeVisible()
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(0)

  await page.getByRole('link', { name: 'Empezar gratis' }).first().click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible()
})

test('the header anchors scroll to their sections', async ({ page }) => {
  await page.goto('/')
  await page.locator('header nav').getByRole('link', { name: 'Cómo funciona' }).click()
  await expect(page).toHaveURL(/#como-funciona$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Cómo funciona' })).toBeInViewport()
})

test('the tagline lights up word by word while scrolling', async ({ page }) => {
  await page.goto('/')
  const tagline = page.locator('p', { hasText: 'Dos circuitos de 70 km' })
  const lit = () => tagline.locator('span').evaluateAll((spans) => spans.filter((s) => (s as HTMLElement).style.opacity === '1').length)
  expect(await lit()).toBe(0)
  await tagline.scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 400)
  await expect.poll(lit).toBeGreaterThan(0)
})

test('the theme choice survives a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Cambiar de tema' }).first().click()
  await page.getByRole('menuitemradio', { name: 'Oscuro' }).or(page.getByRole('menuitem', { name: 'Oscuro' })).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
})
