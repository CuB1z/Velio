import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

type Props = {
  label: string
  description?: string
  children: ReactNode
  /** Controls taller than one line sit at the top of the row. */
  align?: 'center' | 'start'
  className?: string
}

/** One setting: label and help on the left, the control on the right, a hairline above. */
export function SettingRow({ label, description, children, align = 'center', className }: Props) {
  return (
    <div
      className={cn(
        'grid gap-4 border-t border-border py-6 lg:grid-cols-2 lg:gap-8',
        align === 'start' ? 'lg:items-start' : 'lg:items-center',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="text-base font-medium">{label}</span>
        {description ? <span className="text-sm text-muted text-pretty">{description}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">{children}</div>
    </div>
  )
}
