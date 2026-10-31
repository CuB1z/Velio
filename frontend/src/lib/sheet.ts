export type SheetStop = 'hidden' | 'peek' | 'full'

const SHEET_STOPS: SheetStop[] = ['hidden', 'peek', 'full']

const DRAG_STEP = 40
const FLICK_VELOCITY = 0.4

export function neighbour(stop: SheetStop, direction: number): SheetStop {
  const index = SHEET_STOPS.indexOf(stop) + Math.sign(direction)
  return SHEET_STOPS[Math.min(SHEET_STOPS.length - 1, Math.max(0, index))]
}

export function settle(stop: SheetStop, dy: number, velocity: number): SheetStop {
  if (Math.abs(velocity) > FLICK_VELOCITY) return neighbour(stop, -velocity)
  if (Math.abs(dy) > DRAG_STEP) return neighbour(stop, -dy)
  return stop
}

export function damp(overshoot: number): number {
  return 12 * Math.log1p(Math.max(0, overshoot) / 12)
}

export function stretch(value: number, min: number, max: number): number {
  if (value > max) return max + damp(value - max)
  if (value < min) return min - damp(min - value)
  return value
}
