import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/** Form section: an eyebrow over hairline-separated rows, no container. */
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
    <section className={cn('flex flex-col gap-3 border-t border-border pt-5', className)}>
      {title ? <h3 className="eyebrow">{title}</h3> : null}
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

/** A section row. `stacked` puts the control below the label. */
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
        stacked ? 'flex flex-col gap-3 py-1' : 'flex min-h-11 items-center gap-3',
        className,
      )}
    >
      {children}
    </div>
  )
}
