import type { ReactNode } from 'react'

type Props = {
  title: string
  eyebrow?: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, eyebrow, subtitle, actions }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">{title}</h1>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
