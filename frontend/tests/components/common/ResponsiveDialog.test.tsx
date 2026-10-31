import { Button, useOverlayState } from '@heroui/react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { ResponsiveDialog } from '@/components/common/ResponsiveDialog'

function phoneWidth(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matches && query === '(width < 48rem)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function Confirm() {
  const state = useOverlayState({ defaultOpen: true })
  return (
    <ResponsiveDialog state={state}>
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Heading>Delete the route?</ResponsiveDialog.Heading>
      </ResponsiveDialog.Header>
      <ResponsiveDialog.Body>It cannot be undone.</ResponsiveDialog.Body>
      <ResponsiveDialog.Footer>
        <Button onPress={state.close}>Cancel</Button>
        <Button>Delete</Button>
      </ResponsiveDialog.Footer>
    </ResponsiveDialog>
  )
}

afterEach(() => vi.unstubAllGlobals())

it('opens as a bottom drawer with a handle on a phone', () => {
  phoneWidth(true)
  render(<Confirm />)

  const dialog = screen.getByRole('dialog', { name: 'Delete the route?' })
  expect(dialog).toHaveAttribute('data-slot', 'drawer-dialog')
  expect(dialog).toHaveAttribute('data-placement', 'bottom')
  expect(dialog.querySelector('[data-slot="drawer-handle"]')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Delete' }).parentElement).toHaveClass('flex-col-reverse')
})

it('stays a centred modal from the tablet width up and closes through its state', async () => {
  phoneWidth(false)
  render(<Confirm />)

  const dialog = screen.getByRole('dialog', { name: 'Delete the route?' })
  expect(dialog).not.toHaveAttribute('data-slot', 'drawer-dialog')
  expect(screen.getByRole('button', { name: 'Delete' }).parentElement).toHaveClass('justify-end')

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})
