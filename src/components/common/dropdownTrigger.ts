import { buttonVariants } from '@heroui/react'

import { cn } from '@/lib/cn'

type ButtonOptions = Parameters<typeof buttonVariants>[0]

/**
 * Button-look classes for a Dropdown.Trigger, which already renders the <button>
 * (nesting a HeroUI <Button> is invalid HTML). Restores the inline-flex that
 * `.dropdown__trigger`'s `display: block` overrides, or the icon sticks to the left.
 */
export function dropdownTriggerClass(options: ButtonOptions, extra?: string): string {
  return cn(buttonVariants(options), 'inline-flex items-center justify-center', extra)
}
