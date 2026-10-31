import type { LngLat } from '@/lib/polyline'

export type RouteLayer = {
  id: string
  coordinates: LngLat[]
  /** Fixed categorical palette slot: the color belongs to the variant, not its order. */
  colorIndex: number
  selected: boolean
}

export type MapMarker = {
  id: string
  coordinate: LngLat
  kind: 'start' | 'end' | 'via'
  label?: string
}

export type MapFocusPoint = { coordinate: LngLat; label?: string }
