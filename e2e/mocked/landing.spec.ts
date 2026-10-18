import { expect, test } from '@playwright/test'

import { mockApi } from '../support/mockApi'

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

test('the landing shows the product without maps and leads to sign up', async ({ page }) => {
  await page.goto('/es')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Circuitos a tu medida')
  await expect(page.getByText('Sierra · Manzanares el Real').first()).toBeVisible()
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(0)

  await page.getByRole('link', { name: 'Empezar gratis' }).first().click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible()
})

test('the header anchors scroll to their sections', async ({ page }) => {
  await page.goto('/es')
  await page.locator('header nav').getByRole('link', { name: 'Cómo funciona' }).click()
  await expect(page).toHaveURL(/#como-funciona$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Cómo funciona' })).toBeInViewport()
})

test('the tagline lights up word by word while scrolling', async ({ page }) => {
  await page.goto('/es')
  const tagline = page.locator('p', { hasText: 'Dos circuitos de 70 km' })
  const lit = () => tagline.locator('span').evaluateAll((spans) => spans.filter((s) => (s as HTMLElement).style.opacity === '1').length)
  expect(await lit()).toBe(0)
  await tagline.scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 400)
  await expect.poll(lit).toBeGreaterThan(0)
})

test('the theme choice survives a reload', async ({ page }) => {
  await page.goto('/es')
  await page.getByRole('button', { name: 'Cambiar de tema' }).first().click()
  await page.getByRole('menuitemradio', { name: 'Oscuro' }).or(page.getByRole('menuitem', { name: 'Oscuro' })).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('the bare root follows the browser language to its prefix', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/es$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
})

test('the default language lives at the root and /en redirects there', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('velio.lang', 'en'))
  await page.goto('/en')
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Loops cut to your distance')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https?:\/\/[^/]+\/$/)
  await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveAttribute('href', /\/es$/)
  await expect(page.locator('link[rel="alternate"]')).toHaveCount(3)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /^Velio builds/)
})
