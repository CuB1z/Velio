import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Cifra que cuenta desde cero al entrar en pantalla. Sin observer o con
 * movimiento reducido muestra el valor final directamente: el número es el
 * contenido, la cuenta es el adorno.
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  durationMs = 1400,
}: {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  durationMs?: number
}) {
  const { i18n } = useTranslation()
  const ref = useRef<HTMLSpanElement>(null)
  const animate =
    typeof IntersectionObserver !== 'undefined' &&
    !(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [shown, setShown] = useState(animate ? 0 : value)

  useEffect(() => {
    const element = ref.current
    if (!element || !animate) return
    let frame = 0
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      const start = performance.now()
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / durationMs)
        const eased = 1 - Math.pow(1 - progress, 3)
        setShown(value * eased)
        if (progress < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [animate, durationMs, value])

  const text = shown.toLocaleString(i18n.language, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return (
    <span ref={ref} className="tnum">
      {prefix}
      {text}
      {suffix}
    </span>
  )
}
