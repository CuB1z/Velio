import { expect, test } from '@playwright/test'

import { json, SESSION, signedIn } from '../support/mockApi'

const CHROME_LINUX =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

test('settings: rename, switch the theme and close another session', async ({ page }) => {
  const user = { ...SESSION.user }
  const sessions = [
    { id: 1, created_at: '2026-10-18T08:02:00Z', user_agent: CHROME_LINUX, current: true },
    { id: 2, created_at: '2026-10-11T19:47:00Z', user_agent: SAFARI_IPHONE, current: false },
  ]
  const revoked: string[] = []
  await signedIn(page, {
    '**/api/v1/auth/me': (route) => {
      if (route.request().method() === 'PATCH') {
        user.full_name = (route.request().postDataJSON() as { full_name: string }).full_name
      }
      return route.fulfill(json(user))
    },
    '**/api/v1/auth/sessions': (route) => route.fulfill(json(sessions)),
    '**/api/v1/auth/sessions/2': (route) => {
      revoked.push(route.request().method())
      sessions.splice(1, 1)
      return route.fulfill({ status: 204 })
    },
  })

  await page.goto('/es/account')
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible()
  await expect(page.getByText('Chrome en Linux')).toBeVisible()

  await page.getByRole('textbox', { name: 'Nombre' }).fill('Marta Ruiz')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Marta Ruiz' })).toBeVisible()

  await page.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Claro' }).click()
  await expect(page.locator('html')).toHaveClass(/light/)

  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect.poll(() => revoked).toContain('DELETE')
  await expect(page.getByText('Safari en iPhone')).toHaveCount(0)
})

test('switching the language keeps the settings page under the other prefix', async ({ page }) => {
  await signedIn(page, {
    '**/api/v1/auth/me': (route) => route.fulfill(json(SESSION.user)),
    '**/api/v1/auth/sessions': (route) => route.fulfill(json([])),
  })

  await page.goto('/es/account')
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')

  await page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'English' }).click()
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/account$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
})

test('the section nav follows the scroll and jumps to a section', async ({ page }) => {
  await signedIn(page, {
    '**/api/v1/auth/me': (route) => route.fulfill(json(SESSION.user)),
    '**/api/v1/auth/sessions': (route) => route.fulfill(json([])),
  })

  await page.goto('/es/account')
  const nav = page.getByRole('navigation', { name: 'Ajustes' })
  await expect(nav.getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'true')

  await nav.getByRole('link', { name: 'Sesiones' }).click()
  await expect(nav.getByRole('link', { name: 'Sesiones' })).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('heading', { name: 'Dispositivos con sesión abierta' })).toBeInViewport()
})
