import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

// Derived from the component so the props cannot drift out of sync.
import type { MapViewProps } from './mapView'

/**
 * maplibre-gl weighs about a megabyte and is only needed in the planner;
 * loading it separately keeps it off the auth screens.
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
