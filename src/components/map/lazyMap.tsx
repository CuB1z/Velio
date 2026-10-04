import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

// Derivado del propio componente: una lista de props duplicada a mano se
// queda atrás en cuanto MapView gana una.
import type { MapViewProps } from './mapView'

/**
 * maplibre-gl pesa cerca de un megabyte y solo hace falta en el planificador.
 * Cargándolo aparte, las pantallas de acceso no lo descargan.
 */
const MapView = lazy(async () => ({ default: (await import('./mapView')).MapView }))

export function LazyMap(props: MapViewProps) {
  const { t } = useTranslation()

  return (
    <Suspense
      fallback={
        <div
          className={props.className}
          role="status"
          aria-label={t('common.loading')}
        >
          <div className="size-full animate-pulse bg-surface-secondary" />
        </div>
      }
    >
      <MapView {...props} />
    </Suspense>
  )
}
