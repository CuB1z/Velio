import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/** Bento grid: cells of different sizes in a shared frame, with uniform gap and radius. */
export function Bento({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-5 sm:grid-cols-6 lg:grid-cols-12', className)}>
      {children}
    </div>
  )
}

export function BentoCell({
  children,
  span = 4,
  glow = false,
  className,
}: {
  children: ReactNode
  /** Columns spanned in the 12-column grid (always full width on mobile). */
  span?: 3 | 4 | 5 | 6 | 7 | 8 | 12
  /** A faint accent light in the top-left corner, for the lead cell. */
  glow?: boolean
  className?: string
}) {
  const spans: Record<number, string> = {
    3: 'sm:col-span-2 lg:col-span-3',
    4: 'sm:col-span-3 lg:col-span-4',
    5: 'sm:col-span-3 lg:col-span-5',
    6: 'sm:col-span-6 lg:col-span-6',
    7: 'sm:col-span-6 lg:col-span-7',
    8: 'sm:col-span-6 lg:col-span-8',
    12: 'sm:col-span-6 lg:col-span-12',
  }
  return (
    <div
      className={cn(
        'relative flex flex-col justify-between gap-8 overflow-hidden rounded-3xl bg-surface p-8 ring-1 ring-border',
        spans[span],
        className,
      )}
    >
      {glow ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[20%] -top-[60%] h-[140%] w-[70%]"
          style={{
            background:
              'radial-gradient(50% 50% at 50% 50%, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 70%)',
          }}
        />
      ) : null}
      {children}
    </div>
  )
}

/** Shared cell footer: an eyebrow, the title and one sentence. */
export function BentoLabel({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="relative flex flex-col gap-2">
      <span className="eyebrow">{eyebrow}</span>
      <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
      {body ? <p className="leading-relaxed text-muted text-pretty">{body}</p> : null}
    </div>
  )
}
