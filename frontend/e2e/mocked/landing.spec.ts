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

test('the footer language menu moves the landing to the other language', async ({ page }) => {
  await page.goto('/es')
  await page.getByRole('button', { name: 'Cambiar de idioma' }).click()
  await page.getByRole('menuitemradio', { name: 'English' }).or(page.getByRole('menuitem', { name: 'English' })).click()
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Loops cut to your distance')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('the logo brings the page back to the top', async ({ page }) => {
  await page.goto('/es')
  await page.getByRole('heading', { level: 2, name: 'Cómo funciona' }).scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.locator('header').getByRole('link', { name: 'Velio' }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test('picking a bike highlights what it means', async ({ page }) => {
  await page.goto('/es')
  const picker = page.getByRole('group', { name: 'Tu bici' })
  await picker.getByRole('button', { name: 'Gravel' }).click()
  await expect(picker.getByRole('button', { name: 'Gravel' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('listitem').filter({ hasText: 'Gravel.' })).toHaveCSS('opacity', '1')
  await expect(page.getByRole('listitem').filter({ hasText: 'Carretera.' })).toHaveCSS('opacity', '0.4')
})

test('the closing call to action also asks for a country', async ({ page }) => {
  await page.goto('/es')
  const closing = page.locator('section', { has: page.getByRole('heading', { name: 'Tu próxima vuelta sale de tu puerta' }) })
  await closing.getByRole('button', { name: 'Pide tu país' }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Pide tu país' })).toBeVisible()
})
