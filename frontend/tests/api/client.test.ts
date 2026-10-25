import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { request, setAuthHandlers } from '@/api/client'
import i18n from '@/i18n'
import { ApiError } from '@/api/errors'

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

let token: string | null
const refresh = vi.fn<() => Promise<boolean>>()
const onSessionLost = vi.fn()
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  token = 'old'
  refresh.mockReset()
  onSessionLost.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  setAuthHandlers({ getAccessToken: () => token, refresh, onSessionLost })
})

afterEach(() => {
  setAuthHandlers(null)
  vi.unstubAllGlobals()
})

const authHeader = (call: number) =>
  (fetchMock.mock.calls[call][1]?.headers as Record<string, string> | undefined)?.Authorization

it('attaches the access token to authenticated requests only', async () => {
  fetchMock.mockImplementation(async () => json(200, { ok: true }))
  await request('/auth/me', { auth: true })
  await request('/public')
  expect(authHeader(0)).toBe('Bearer old')
  expect(authHeader(1)).toBeUndefined()
})

it('tells the API which language the rider is using', async () => {
  fetchMock.mockImplementation(async () => json(202, {}))
  await i18n.changeLanguage('es')
  await request('/auth/forgot-password', { method: 'POST', body: { email: 'marta@velio.cc' } })
  await i18n.changeLanguage('en')
  await request('/auth/forgot-password', { method: 'POST', body: { email: 'marta@velio.cc' } })
  const language = (call: number) =>
    (fetchMock.mock.calls[call][1]?.headers as Record<string, string> | undefined)?.['Accept-Language']
  expect(language(0)).toBe('es')
  expect(language(1)).toBe('en')
})

it('refreshes on a 401 and retries with the new token', async () => {
  fetchMock.mockImplementationOnce(async () => json(401, { error: 'UNAUTHORIZED', message: 'expired' }))
  fetchMock.mockImplementationOnce(async () => json(200, { id: 'u1' }))
  refresh.mockImplementation(async () => {
    token = 'new'
    return true
  })

  await expect(request('/auth/me', { auth: true })).resolves.toEqual({ id: 'u1' })
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(authHeader(1)).toBe('Bearer new')
  expect(onSessionLost).not.toHaveBeenCalled()
})

it('concurrent 401s share a single refresh', async () => {
  let release!: () => void
  refresh.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        release = () => {
          token = 'new'
          resolve(true)
        }
      }),
  )
  fetchMock.mockImplementation(async (_, init) =>
    (init?.headers as Record<string, string> | undefined)?.Authorization === 'Bearer new'
      ? json(200, { ok: true })
      : json(401, { error: 'UNAUTHORIZED', message: 'expired' }),
  )

  const calls = Promise.all([1, 2, 3].map((n) => request(`/routes/saved?n=${n}`, { auth: true })))
  await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
  release()

  await expect(calls).resolves.toHaveLength(3)
  expect(refresh).toHaveBeenCalledTimes(1)
})

it('a failed refresh ends the session and surfaces the 401', async () => {
  fetchMock.mockImplementation(async () => json(401, { error: 'INVALID_REFRESH_TOKEN', message: 'reused' }))
  refresh.mockResolvedValue(false)

  const error = await request('/auth/me', { auth: true }).catch((cause: unknown) => cause)
  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).code).toBe('INVALID_REFRESH_TOKEN')
  expect(onSessionLost).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('without a session a 401 is returned as is, with no refresh or retry', async () => {
  setAuthHandlers(null)
  fetchMock.mockImplementation(async () => json(401, { error: 'UNAUTHORIZED', message: 'no token' }))

  await expect(request('/auth/me', { auth: true })).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('maps the error envelope, and a non JSON body to a code derived from the status', async () => {
  fetchMock.mockImplementationOnce(async () =>
    json(422, { error: 'VALIDATION_ERROR', message: 'Bad name', details: { field: 'name' } }),
  )
  await expect(request('/routes/saved', { method: 'POST', body: {} })).rejects.toMatchObject({
    code: 'VALIDATION_ERROR',
    message: 'Bad name',
    details: { field: 'name' },
  })

  fetchMock.mockImplementationOnce(async () => new Response('<html>Bad gateway</html>', { status: 502 }))
  await expect(request('/routes')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 502 })
})
