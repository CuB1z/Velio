import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/cn'

/** Inset grouped list: title outside, hairline-separated rows in a parchment container. */
export function InsetGroup({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className="flex flex-col gap-2">
      {title ? <h3 className="px-4 text-[13px] font-normal text-muted">{title}</h3> : null}
      <div
        className={cn('flex flex-col divide-y divide-separator rounded-xl bg-surface shadow-card', className)}
        // Inside the parchment, fields lift to surface and "default" (slider tracks,
        // off switches, chips) steps down, or they blend into the group background.
        style={
          {
            '--field-background': 'var(--surface)',
            '--default': 'var(--surface-tertiary)',
          } as CSSProperties
        }
      >
        {children}
      </div>
    </section>
  )
}

/** A group row. `stacked` puts the control below the label. */
export function InsetRow({
  children,
  className,
  stacked = false,
}: {
  children: ReactNode
  className?: string
  stacked?: boolean
}) {
  return (
    <div
      className={cn(
        stacked ? 'flex flex-col gap-3 px-4 py-3.5' : 'flex min-h-12 items-center gap-3 px-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
