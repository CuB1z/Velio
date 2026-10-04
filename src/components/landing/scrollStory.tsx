import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Sección con lienzo fijo: el lienzo se queda quieto mientras los pasos pasan
 * por delante, y el paso activo manda lo que se ve. Es el recurso de las
 * páginas de producto de Apple y aquí cuenta algo real: cómo el motor repara
 * un circuito de ida y vuelta.
 *
 * Sin IntersectionObserver (jsdom) se muestran todos los pasos en vertical y
 * el lienzo en su último estado: sigue leyéndose, solo que sin la coreografía.
 */
export function ScrollStory({
  steps,
  children,
  className,
}: {
  steps: { id: string; title: string; body: string }[]
  /** Recibe el índice del paso activo y pinta el lienzo. */
  children: (active: number) => ReactNode
  className?: string
}) {
  // Sin IntersectionObserver (jsdom) el último paso es el estado inicial: así
  // la sección se lee entera de una vez, sin efecto y sin estado que ajustar.
  const hasObserver = typeof IntersectionObserver !== 'undefined'
  const [active, setActive] = useState(() => (hasObserver ? 0 : steps.length - 1))
  const refs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!hasObserver) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => Number((entry.target as HTMLElement).dataset.step))
        if (visible.length) setActive(Math.max(...visible))
      },
      // Banda estrecha en el centro: el paso cambia cuando cruza la mitad.
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    refs.current.forEach((element) => element && observer.observe(element))
    return () => observer.disconnect()
  }, [hasObserver, steps.length])

  return (
    <div className={cn('grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-20', className)}>
      <div className="order-2 lg:order-1">
        {steps.map((step, index) => (
          <div
            key={step.id}
            data-step={index}
            ref={(element) => {
              refs.current[index] = element
            }}
            className="flex min-h-[34vh] flex-col justify-center py-6 lg:min-h-[52vh] lg:py-0"
          >
            <span
              aria-hidden="true"
              className={cn(
                'tnum text-[13px] transition-colors duration-300',
                index === active ? 'text-accent' : 'text-muted',
              )}
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3
              className={cn(
                'mt-3 text-2xl font-semibold tracking-tight transition-opacity duration-300 sm:text-[32px] sm:leading-[1.15]',
                index === active ? 'opacity-100' : 'opacity-45',
              )}
            >
              {step.title}
            </h3>
            <p
              className={cn(
                'mt-4 max-w-md text-lg leading-relaxed text-muted text-pretty transition-opacity duration-300',
                index === active ? 'opacity-100' : 'opacity-40',
              )}
            >
              {step.body}
            </p>
          </div>
        ))}
      </div>

      <div className="order-1 lg:order-2">
        <div className="lg:sticky lg:top-20 lg:flex lg:h-[80vh] lg:items-center">
          {children(active)}
        </div>
      </div>
    </div>
  )
}
