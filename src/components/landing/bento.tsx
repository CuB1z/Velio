import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Rejilla bento: celdas de distinto tamaño en un marco común. Es lo que da
 * variedad a una sección de funciones — una captura grande manda, y alrededor
 * conviven gráficos, cifras y texto. Hueco y radio uniformes.
 */
export function Bento({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-6 lg:grid-cols-12', className)}>
      {children}
    </div>
  )
}

export function BentoCell({
  children,
  span = 4,
  tone = 'surface',
  className,
}: {
  children: ReactNode
  /** Columnas que ocupa en la rejilla de 12 (en móvil siempre ocupa todo). */
  span?: 3 | 4 | 5 | 6 | 7 | 8 | 12
  tone?: 'surface' | 'parchment' | 'ink' | 'accent'
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
  const tones = {
    surface: 'bg-surface',
    parchment: 'bg-surface-secondary',
    ink: 'bg-ink text-white',
    accent: 'bg-accent text-accent-foreground',
  }
  return (
    <div className={cn('overflow-hidden rounded-2xl shadow-card', spans[span], tones[tone], className)}>
      {children}
    </div>
  )
}

/** Cabecera común de una celda: rótulo pequeño y frase. */
export function BentoLabel({ title, body, tone }: { title: string; body?: string; tone?: 'ink' }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {body ? (
        <p className={cn('leading-relaxed text-pretty', tone === 'ink' ? 'text-ink-muted' : 'text-muted')}>
          {body}
        </p>
      ) : null}
    </div>
  )
}
