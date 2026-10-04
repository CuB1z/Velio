import { useEffect } from 'react'

import type { LatLon } from '@/types/api'

/** Suficiente para una posición aproximada; no hace falta esperar al GPS fino. */
const TIMEOUT_MS = 8000

export type PositionFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported'

/** Códigos de GeolocationPositionError → causa legible. */
export function positionFailure(error: { code: number }): PositionFailure {
  if (error.code === 1) return 'denied'
  if (error.code === 3) return 'timeout'
  return 'unavailable'
}

/**
 * Pide la posición del navegador una vez, al montar, y la entrega si llega.
 *
 * Si no llega, la página se queda con su valor por defecto (Madrid centro) y
 * `onFailure` recibe la causa. No es un detalle: "no coge mi ubicación pese a
 * tener permisos" suele ser POSITION_UNAVAILABLE — un navegador de escritorio
 * sin servicio de localización (Brave o Chromium en Linux sin GeoClue) — y
 * callar convierte un límite del navegador en un misterio de la app.
 */
export function useInitialPosition(
  onPosition: (position: LatLon) => void,
  onFailure?: (cause: PositionFailure) => void,
): void {
  useEffect(() => {
    const geolocation = typeof navigator !== 'undefined' ? navigator.geolocation : undefined
    if (!geolocation) {
      onFailure?.('unsupported')
      return
    }
    let cancelled = false
    geolocation.getCurrentPosition(
      (result) => {
        if (cancelled) return
        onPosition({ lat: result.coords.latitude, lon: result.coords.longitude })
      },
      (error) => {
        if (cancelled) return
        // Visible en la consola del navegador para poder diagnosticarlo.
        console.warn('[velio] geolocation failed', error.code, error.message)
        onFailure?.(positionFailure(error))
      },
      { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: 60_000 },
    )
    return () => {
      cancelled = true
    }
    // Solo al montar: volver a pedirla en cada render sería un prompt en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
