import { expect, test } from '@playwright/test'

import { mockApi } from '../support/mockApi'

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

test('the landing describes the app as structured data and stays indexable', async ({ page }) => {
  await page.goto('/es')
  const blocks = page.locator('script[type="application/ld+json"]')
  await expect(blocks).toHaveCount(1)
  const data = JSON.parse((await blocks.textContent()) ?? '{}') as Record<string, unknown>
  expect(data['@type']).toBe('WebApplication')
  expect(data.inLanguage).toBe('es')
  expect(data.isAccessibleForFree).toBe(true)
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
})

test('the sign-in screens ask search engines not to index them', async ({ page }) => {
  for (const path of ['/es/login', '/es/register']) {
    await page.goto(path)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0)
  }
})

test('a legal page shares as a card', async ({ page }) => {
  await page.goto('/es/terms')
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Condiciones de uso · Velio')
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /\/es\/terms$/)
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'es_ES')
})
