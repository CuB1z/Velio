import { useCallback, useEffect, useRef, useState } from 'react'

/** Ancho y alto reales del nodo. Los gráficos se dibujan en píxeles, no en un
 *  viewBox estirado, para que el texto no se deforme. */
export function useElementSize<T extends HTMLElement>(): {
  ref: (node: T | null) => void
  width: number
  height: number
} {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const observer = useRef<ResizeObserver | null>(null)

  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect()
    if (!node) return

    observer.current = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((previous) =>
        Math.abs(previous.width - width) < 0.5 && Math.abs(previous.height - height) < 0.5
          ? previous
          : { width, height },
      )
    })
    observer.current.observe(node)
    const rect = node.getBoundingClientRect()
    setSize({ width: rect.width, height: rect.height })
  }, [])

  useEffect(() => () => observer.current?.disconnect(), [])

  return { ref, ...size }
}
