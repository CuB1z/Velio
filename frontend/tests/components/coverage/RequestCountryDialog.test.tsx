import { useOverlayState } from '@heroui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'

import { AuthContext, type AuthContextValue } from '@/auth/context'
import { RequestCountryDialog } from '@/components/coverage/RequestCountryDialog'
import i18n from '@/i18n'
import { COVERAGE } from '../../fixtures/coverage'

let requests: { body: Record<string, unknown> }[] = []

function serve(answer: () => Response) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (String(input).includes('/coverage/requests')) {
      requests.push({ body: JSON.parse(String(init?.body)) })
      return answer()
    }
    return new Response(JSON.stringify(COVERAGE), { status: 200 })
  })
}

function Harness() {
  const state = useOverlayState({ defaultOpen: true })
  return <RequestCountryDialog state={state} />
}

function renderDialog(status: AuthContextValue['status']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ status, user: null } as AuthContextValue}>
        <Harness />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
  return screen.getByRole('dialog')
}

async function pickCountry(dialog: HTMLElement, search: string, name: string) {
  const field = within(dialog).getByRole('combobox', { name: /País/ })
  await userEvent.clear(field)
  await userEvent.type(field, search)
  await userEvent.click(await screen.findByRole('option', { name }))
}

const json = (body: unknown, status = 202, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers })

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

beforeEach(() => {
  vi.restoreAllMocks()
  requests = []
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(256)
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['es-ES'])
})

it('signed out, it needs a valid email and records the request', async () => {
  serve(() => json({ country: 'FR', recorded: true }))
  const dialog = renderDialog('anonymous')

  await waitFor(() => expect(requests).toHaveLength(0))
  await userEvent.type(within(dialog).getByRole('combobox', { name: /País/ }), 'Espa')
  await waitFor(() => expect(screen.queryByRole('option', { name: 'España' })).not.toBeInTheDocument())
  await pickCountry(dialog, 'fran', 'Francia')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar petición' }))
  expect(within(dialog).getByText('Escribe un email válido.')).toBeInTheDocument()
  expect(requests).toHaveLength(0)

  await userEvent.type(within(dialog).getByRole('textbox', { name: /Email/ }), 'rider@example.com')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar petición' }))

  expect(await within(dialog).findByText('Contamos tu petición para Francia. Gracias.')).toBeInTheDocument()
  expect(requests[0].body).toEqual({ country: 'FR', email: 'rider@example.com' })
})

it('signed in, it asks no email and says when it was already asked', async () => {
  serve(() => json({ country: 'IT', recorded: false }))
  const dialog = renderDialog('authenticated')

  expect(within(dialog).queryByRole('textbox', { name: /Email/ })).not.toBeInTheDocument()
  await pickCountry(dialog, 'ital', 'Italia')
  await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nota (opcional)' }), '  Dolomitas ')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar petición' }))

  expect(await within(dialog).findByText('Ya nos habías pedido Italia: seguimos contando contigo.')).toBeInTheDocument()
  expect(requests[0].body).toEqual({ country: 'IT', note: 'Dolomitas' })
})

it('the email when it arrives is off until the rider ticks it', async () => {
  serve(() => json({ country: 'IT', recorded: true }))
  const dialog = renderDialog('authenticated')

  const optIn = within(dialog).getByRole('checkbox', { name: /Avísame cuando llegue/ })
  expect(optIn).not.toBeChecked()
  await pickCountry(dialog, 'ital', 'Italia')
  await userEvent.click(optIn)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar petición' }))

  expect(
    await within(dialog).findByText('Contamos tu petición para Italia. Te escribiremos una sola vez cuando llegue.'),
  ).toBeInTheDocument()
  expect(requests[0].body).toEqual({ country: 'IT', notify: true })
})

it('a rate limited request counts down on the submit button', async () => {
  serve(() => json({ error: 'RATE_LIMITED', message: 'Too many requests' }, 429, { 'retry-after': '5' }))
  const dialog = renderDialog('authenticated')

  await pickCountry(dialog, 'ital', 'Italia')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar petición' }))

  expect(await within(dialog).findByRole('button', { name: /^Espera \d s$/ })).toBeDisabled()
})

it('suggests the browser region once the coverage is known', async () => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR'])
  serve(() => json({ country: 'FR', recorded: true }))
  const dialog = renderDialog('authenticated')

  await waitFor(() => expect(within(dialog).getByRole('combobox', { name: /País/ })).toHaveValue('Francia'))
})
