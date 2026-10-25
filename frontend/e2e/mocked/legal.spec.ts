import { expect, test } from '@playwright/test'

import { mockApi } from '../support/mockApi'

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

test('the footer opens the documents in a new tab', async ({ page }) => {
  await page.goto('/es')
  const footer = page.locator('footer')
  for (const [name, href] of [['Privacidad', '/es/privacy'], ['Condiciones', '/es/terms']]) {
    await expect(footer.getByRole('link', { name })).toHaveAttribute('href', href)
    await expect(footer.getByRole('link', { name })).toHaveAttribute('target', '_blank')
  }
})

test('the privacy policy has its own head tags', async ({ page }) => {
  await page.goto('/es/privacy')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de privacidad')
  await expect(page).toHaveTitle('Política de privacidad · Velio')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/es\/privacy$/)
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /^https?:\/\/[^/]+\/privacy$/)
  await expect(page.getByRole('link', { name: 'cub1zdev@gmail.com' }).first()).toHaveAttribute('href', 'mailto:cub1zdev@gmail.com')
})

test('the footer row also points to the code and the author', async ({ page }) => {
  await page.goto('/es')
  const footer = page.locator('footer')
  await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/CuB1z/Velio')
  await expect(footer.getByRole('link', { name: 'Autor' })).toHaveAttribute('href', 'https://cub1z.es')
})

test('the language menu keeps the reader on the same document', async ({ page }) => {
  await page.goto('/es/terms')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Condiciones de uso')
  await page.getByRole('button', { name: 'Cambiar de idioma' }).click()
  await page.getByRole('menuitemradio', { name: 'English' }).or(page.getByRole('menuitem', { name: 'English' })).click()
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/terms$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Terms of service')
})

test('the navbar anchors lead back to their landing section', async ({ page }) => {
  await page.goto('/es/terms')
  await page.locator('header nav').getByRole('link', { name: 'Cómo funciona' }).click()
  await expect(page).toHaveURL(/\/es#como-funciona$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Cómo funciona' })).toBeInViewport()
})

test('each document links to the other', async ({ page }) => {
  await page.goto('/es/privacy')
  await page.locator('article').getByRole('link', { name: 'condiciones de uso' }).click()
  await expect(page).toHaveURL(/\/es\/terms$/)
  await page.locator('article').getByRole('link', { name: 'política de privacidad' }).click()
  await expect(page).toHaveURL(/\/es\/privacy$/)
})

test('signing up links both documents without ticking the box', async ({ page }) => {
  await page.goto('/es/register')
  const [policy] = await Promise.all([
    page.context().waitForEvent('page'),
    page.getByRole('link', { name: 'Política de privacidad' }).first().click(),
  ])
  await expect(policy).toHaveURL(/\/es\/privacy$/)
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await expect(page.getByText('Al continuar con Google aceptas')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Condiciones', exact: true })).toHaveAttribute('href', '/es/terms')
})
