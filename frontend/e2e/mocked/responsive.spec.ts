import { expect, test, type Page } from '@playwright/test'

import { json, LOOP, mockApi, SESSION, signedIn } from '../support/mockApi'

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

test('the landing fits the screen without horizontal scroll', async ({ page }) => {
  await mockApi(page)
  await page.goto('/es')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await overflow(page)).toBeLessThanOrEqual(0)
})

test('the footer keeps the logo and the toggles on one line', async ({ page }) => {
  await mockApi(page)
  await page.goto('/es')
  const footer = page.getByRole('contentinfo')
  const logo = (await footer.getByRole('link', { name: 'Velio' }).boundingBox())!
  const toggles = (await footer.getByRole('button').last().boundingBox())!
  const middle = (box: { y: number; height: number }) => box.y + box.height / 2

  expect(Math.abs(middle(logo) - middle(toggles))).toBeLessThan(2)
  expect(toggles.x).toBeGreaterThan(logo.x + logo.width)
})

test('the login keeps only the form, without the product panel', async ({ page }) => {
  await mockApi(page)
  await page.goto('/es/login')
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  await expect(page.getByText('Circuitos a tu medida, puntuados antes de salir.')).toBeHidden()
  expect(await overflow(page)).toBeLessThanOrEqual(0)
})

test('nothing sits under the status bar when the app draws edge to edge', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 32, bottom: 24 } })
  const logoTop = async () => (await page.getByRole('banner').getByRole('link', { name: 'Velio' }).boundingBox())!.y

  await mockApi(page)
  await page.goto('/es')
  expect(await logoTop()).toBeGreaterThanOrEqual(32)
  await page.evaluate(() => window.scrollTo({ top: 2000, behavior: 'instant' }))
  expect(await logoTop()).toBeGreaterThanOrEqual(32)

  await signedIn(page)
  await page.goto('/es/loops')
  expect(await logoTop()).toBeGreaterThanOrEqual(32)
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
  await expect(submit).not.toBeInViewport()

  const handle = page.getByRole('button', { name: 'Desplegar el panel' })
  await handle.hover()
  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 6 })
  await page.mouse.up()
  const hidden = page.getByRole('button', { name: 'Mostrar el panel' })
  await expect(hidden).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(async () => (await hidden.boundingBox())!.y).toBeGreaterThan(viewport.height * 0.8)

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

test.describe('in English, where the action labels are short', () => {
  test.use({ locale: 'en-GB' })

  test('a saved route keeps a long title in view next to its actions', async ({ page }) => {
    const saved = {
      id: 'r1',
      name: 'Madrid to Navacerrada',
      created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-02T10:00:00Z',
      payload: LOOP,
    }
    await signedIn(page, { '**/api/v1/routes/saved/r1': (route) => route.fulfill(json(saved)) })
    await page.goto('/saved/r1')
    const title = page.getByRole('heading', { level: 1, name: 'Madrid to Navacerrada' })
    await expect(title).toBeVisible()
    const box = (await title.boundingBox())!
    expect(box.width).toBeGreaterThan(150)
    expect(await overflow(page)).toBeLessThanOrEqual(0)
  })
})

test('a saved route is renamed from its card through bottom sheets', async ({ page }) => {
  const rows = [{ id: 'r1', name: 'Ruta del domingo', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z', payload: LOOP }]
  await signedIn(page, {
    '**/api/v1/routes/saved?*': (route) =>
      route.fulfill(json({ data: rows, meta: { page: 1, limit: 12, total: rows.length, total_pages: 1, is_last: true } })),
    '**/api/v1/routes/saved/r1': async (route) => {
      rows[0].name = route.request().postDataJSON().name
      await route.fulfill({ status: 204, body: '' })
    },
  })
  await page.goto('/es/saved')

  await page.getByRole('button', { name: 'Acciones de Ruta del domingo' }).click()
  const sheet = page.getByRole('dialog', { name: 'Ruta del domingo' })
  await expect(sheet).toHaveAttribute('data-placement', 'bottom')
  await sheet.getByRole('button', { name: 'Renombrar' }).click()

  const rename = page.getByRole('dialog', { name: 'Renombrar la ruta' })
  await expect(rename).toHaveAttribute('data-placement', 'bottom')
  await rename.getByRole('textbox').fill('Ruta del sábado')
  await rename.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('link', { name: 'Ruta del sábado' })).toBeVisible()
  expect(await overflow(page)).toBeLessThanOrEqual(0)
})

test('a sheet reopens on the first tap while the previous one is still closing', async ({ page }) => {
  const rows = [{ id: 'r1', name: 'Ruta del domingo', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z', payload: LOOP }]
  await signedIn(page, {
    '**/api/v1/routes/saved?*': (route) =>
      route.fulfill(json({ data: rows, meta: { page: 1, limit: 12, total: rows.length, total_pages: 1, is_last: true } })),
  })
  await page.goto('/es/saved')
  const trigger = page.getByRole('button', { name: 'Acciones de Ruta del domingo' })
  await trigger.click()
  const box = (await trigger.boundingBox())!
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(800)
  await expect(page.getByRole('dialog', { name: 'Ruta del domingo' })).toBeVisible()
})
