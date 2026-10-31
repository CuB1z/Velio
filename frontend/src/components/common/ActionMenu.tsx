import { Button, Dropdown, type useOverlayState } from '@heroui/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { MoreIcon } from '@/components/common/Icons'
import { ResponsiveDialog } from '@/components/common/ResponsiveDialog'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { dropdownTriggerClass } from '@/lib/dropdownTrigger'

export type MenuAction = { id: string; label: string; icon?: ReactNode; danger?: boolean; selected?: boolean }

type Props = {
  label: string
  title: string
  subtitle?: string
  actions: MenuAction[]
  onAction: (id: string) => void
  state: ReturnType<typeof useOverlayState>
  className?: string
}

export function ActionMenu({ label, title, subtitle, actions, onAction, state, className }: Props) {
  const { t } = useTranslation()
  const phone = useMediaQuery('(width < 48rem)')
  const safe = actions.filter((action) => !action.danger)
  const danger = actions.filter((action) => action.danger)

  if (phone) {
    const row = (action: MenuAction) => (
      <li key={action.id}>
        <button
          type="button"
          aria-current={action.selected || undefined}
          onClick={() => {
            state.close()
            onAction(action.id)
          }}
          className={cn(
            'flex min-h-13 w-full items-center gap-3.5 rounded-xl px-1 text-start text-base transition-colors active:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent',
            action.danger ? 'text-danger' : 'text-foreground',
          )}
        >
          <span className={cn('flex w-5 shrink-0 justify-center', !action.danger && 'text-muted')}>{action.icon}</span>
          <span className="flex-1">{action.label}</span>
          {action.selected ? <span aria-hidden="true" className="size-2 rounded-full bg-accent" /> : null}
        </button>
      </li>
    )

    return (
      <>
        <Button variant="ghost" isIconOnly aria-label={label} className={cn('size-11', className)} onPress={state.open}>
          <MoreIcon />
        </Button>
        <ResponsiveDialog state={state}>
          <ResponsiveDialog.Header>
            <ResponsiveDialog.Heading>{title}</ResponsiveDialog.Heading>
            {subtitle ? <p className="tnum mt-0.5 text-sm text-muted">{subtitle}</p> : null}
          </ResponsiveDialog.Header>
          <ResponsiveDialog.Body>
            <ul className="flex flex-col border-t border-separator pt-1.5">
              {safe.map(row)}
              {danger.length ? <li aria-hidden="true" className="my-1.5 border-t border-separator" /> : null}
              {danger.map(row)}
            </ul>
          </ResponsiveDialog.Body>
          <ResponsiveDialog.Footer>
            <Button variant="ghost" className="min-h-11" onPress={state.close}>
              {t('common.cancel')}
            </Button>
          </ResponsiveDialog.Footer>
        </ResponsiveDialog>
      </>
    )
  }

  const item = (action: MenuAction) => (
    <Dropdown.Item
      key={action.id}
      id={action.id}
      textValue={action.label}
      className={cn('gap-2.5 px-2.5', action.danger && 'text-danger')}
    >
      {action.icon}
      {action.label}
    </Dropdown.Item>
  )

  return (
    <Dropdown isOpen={state.isOpen} onOpenChange={state.setOpen}>
      <Dropdown.Trigger
        aria-label={label}
        className={dropdownTriggerClass({ variant: 'ghost', isIconOnly: true }, cn('size-11', className))}
      >
        <MoreIcon />
      </Dropdown.Trigger>
      <Dropdown.Popover className="min-w-52 p-1.5">
        <Dropdown.Menu aria-label={title} onAction={(key) => onAction(String(key))}>
          <Dropdown.Section>{safe.map(item)}</Dropdown.Section>
          {danger.length ? (
            <Dropdown.Section className="mt-1.5 border-t border-border pt-1.5">{danger.map(item)}</Dropdown.Section>
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
