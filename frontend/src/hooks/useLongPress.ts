import { useRef, type MouseEvent, type PointerEvent } from 'react'

const HOLD_MS = 500
const SLOP_PX = 10

export function useLongPress(onLongPress: () => void, enabled = true) {
  const timer = useRef<number | undefined>(undefined)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  const cancel = () => {
    window.clearTimeout(timer.current)
    origin.current = null
  }

  if (!enabled) return {}

  return {
    onPointerDown: (event: PointerEvent) => {
      fired.current = false
      if (event.pointerType !== 'touch') return
      origin.current = { x: event.clientX, y: event.clientY }
      timer.current = window.setTimeout(() => {
        fired.current = true
        onLongPress()
      }, HOLD_MS)
    },
    onPointerMove: (event: PointerEvent) => {
      const start = origin.current
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > SLOP_PX) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (event: MouseEvent) => {
      event.preventDefault()
      cancel()
      onLongPress()
    },
    onClickCapture: (event: MouseEvent) => {
      if (!fired.current) return
      fired.current = false
      event.preventDefault()
      event.stopPropagation()
    },
  }
}
