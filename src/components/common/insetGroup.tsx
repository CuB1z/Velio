import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Lista agrupada con inserto: un título en sentence case fuera, y dentro un
 * contenedor de pergamino con radio 11 y filas separadas por hairline.
 * Los campos de texto que caigan dentro se pintan blancos y las pistas un
 * paso más oscuras, para que ninguno se funda con el pergamino (las
 * variables de HeroUI se heredan hacia abajo).
 */
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
        // Dentro del pergamino, lo blanco sube a superficie y lo "default"
        // (pistas de slider, interruptores apagados, chips) baja un paso,
        // o se funde con el fondo del grupo y desaparece.
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

/** Una fila del grupo. `stacked` para filas con control debajo del rótulo. */
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
