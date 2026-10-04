import { useCallback, useEffect, useRef, useState } from 'react'

/** Cuenta atrás para reenviar códigos, en segundos. */
export function useCooldown(seconds: number): { left: number; start: () => void } {
  const [left, setLeft] = useState(0)
  const timer = useRef<number | null>(null)

  const start = useCallback(() => setLeft(seconds), [seconds])

  useEffect(() => {
    if (left <= 0) return
    timer.current = window.setTimeout(() => setLeft((current) => current - 1), 1000)
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [left])

  return { left, start }
}
