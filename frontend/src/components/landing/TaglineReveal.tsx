import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/cn'

const reducedMotion = () =>
  typeof matchMedia === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches

export function TaglineReveal({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const words = text.split(' ')
  const [lit, setLit] = useState(() => (reducedMotion() ? words.length : 0))

  useEffect(() => {
    const element = ref.current
    if (!element || reducedMotion()) return
    let frame = 0
    const update = () => {
      frame = 0
      const { top, height } = element.getBoundingClientRect()
      const start = window.innerHeight * 0.85
      const end = window.innerHeight * 0.3 - height * 0.5
      const progress = Math.min(1, Math.max(0, (start - top) / (start - end)))
      setLit(Math.round(progress * words.length))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [words.length])

  return (
    <p ref={ref} className={cn('text-pretty sm:text-balance', className)}>
      {words.map((word, index) => (
        <span
          key={index}
          className="transition-opacity duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ opacity: index < lit ? 1 : 0.3 }}
        >
          {index < words.length - 1 ? `${word} ` : word}
        </span>
      ))}
    </p>
  )
}
