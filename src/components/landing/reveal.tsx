import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

const supportsObserver = () => typeof IntersectionObserver !== 'undefined'

/**
 * Aparece al entrar en pantalla, una vez. Sin IntersectionObserver (jsdom,
 * navegadores viejos) se muestra directamente: el revelado es un adorno, el
 * contenido no puede depender de él.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  /** Escalonado entre hermanos, en ms. */
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(() => !supportsObserver())

  useEffect(() => {
    const element = ref.current
    if (!element || !supportsObserver()) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-visible={visible}
      className={cn('reveal', className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
