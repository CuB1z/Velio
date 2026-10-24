import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, expect, it, vi } from 'vitest'

import * as savedRoutes from '@/api/savedRoutes'
import { SaveRouteDialog } from '@/components/route/saveRouteDialog'
import i18n from '@/i18n'

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

it('saving invalidates the saved routes list', async () => {
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  vi.spyOn(savedRoutes, 'save').mockResolvedValue({
    id: 'new-id',
    name: 'Domingo largo',
    created_at: '2026-10-10T08:00:00Z',
    updated_at: '2026-10-10T08:00:00Z',
    payload: {},
  })
  const onSaved = vi.fn()

  render(
    <QueryClientProvider client={client}>
      <SaveRouteDialog payload={{ distance_km: 61.3 }} defaultName="Domingo largo" onSaved={onSaved} />
    </QueryClientProvider>,
  )

  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Guardar' }))

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('new-id'))
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['savedRoutes'] })
})
