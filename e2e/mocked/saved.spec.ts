import { expect, test } from '@playwright/test'

import { json, LOOP, signedIn } from '../support/mockApi'

const rows = Array.from({ length: 30 }, (_, index) => ({
  id: `r${index + 1}`,
  name: `Ruta ${index + 1}`,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  payload: LOOP,
}))

test('the saved list pages, changes page size and opens a route', async ({ page }) => {
  const asked: string[] = []
  await signedIn(page, {
    '**/api/v1/routes/saved?*': (route) => {
      const url = new URL(route.request().url())
      asked.push(url.search)
      const pageNumber = Number(url.searchParams.get('page'))
      const limit = Number(url.searchParams.get('limit'))
      const total = rows.length
      return route.fulfill(
        json({
          data: rows.slice((pageNumber - 1) * limit, pageNumber * limit),
          meta: { page: pageNumber, limit, total, total_pages: Math.ceil(total / limit), is_last: pageNumber * limit >= total },
        }),
      )
    },
    '**/api/v1/routes/saved/r1': (route) => route.fulfill(json(rows[0])),
  })

  await page.goto('/saved')
  await expect(page.getByRole('link', { name: 'Ruta 1', exact: true })).toBeAttached()
  await expect(page.getByRole('link', { name: 'Ruta 13', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: '24' }).click()
  await expect(page.getByRole('link', { name: 'Ruta 24', exact: true })).toBeAttached()
  expect(asked.at(-1)).toBe('?page=1&limit=24')

  await page.locator('a[href="/saved/r1"]').first().click()
  await expect(page).toHaveURL(/\/saved\/r1$/)
  await expect(page.getByRole('heading', { name: 'Ruta 1' })).toBeVisible()
})

test('selection mode: a click on a card selects it instead of opening it', async ({ page }) => {
  await signedIn(page, {
    '**/api/v1/routes/saved?*': (route) =>
      route.fulfill(
        json({ data: rows.slice(0, 3), meta: { page: 1, limit: 12, total: 3, total_pages: 1, is_last: true } }),
      ),
  })
  await page.goto('/saved')
  await expect(page.getByRole('link', { name: 'Ruta 2', exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(0)

  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click()
  await page.getByRole('listitem').filter({ hasText: 'Ruta 2' }).click()

  await expect(page).toHaveURL(/\/saved$/)
  await expect(page.getByText('1 seleccionada')).toBeVisible()
  await page.getByRole('button', { name: 'Seleccionar todas' }).click()
  await expect(page.getByText('3 seleccionadas')).toBeVisible()
})
