import type { Page, Route } from '@playwright/test'

export const SESSION = {
  user: { id: 'u1', email: 'marta@velio.cc', full_name: 'Marta Ríos', status: 'active' },
  tokens: { access_token: 'access', refresh_token: 'refresh-2', token_type: 'bearer' },
}

export const LOOP = {
  distance_km: 31.2,
  gain_m: 412,
  loss_m: 412,
  feasible: true,
  iterations: 2,
  polyline: 'gjk_lA~dmdFw{l@_~P?_t`Bv{l@~rrB',
  duration_min: 104,
  overlap_ratio: 0.03,
  score: null,
  cycling_score: null,
  profile: null,
  alternatives: null,
}

export const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

type Handler = (route: Route) => Promise<void> | void

export async function mockApi(page: Page, handlers: Record<string, Handler> = {}) {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => route.fulfill(json({ error: 'NOT_FOUND', message: 'unmocked' }, 404)),
  )
  for (const [pattern, handler] of Object.entries(handlers)) await page.route(pattern, handler)
}

export async function signedIn(page: Page, handlers: Record<string, Handler> = {}) {
  await page.addInitScript(() => localStorage.setItem('velio.refresh', 'refresh-1'))
  await mockApi(page, { '**/api/v1/auth/refresh': (route) => route.fulfill(json(SESSION)), ...handlers })
}

export const sse = (...frames: [string, unknown][]) => ({
  status: 200,
  contentType: 'text/event-stream',
  body: frames.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''),
})
