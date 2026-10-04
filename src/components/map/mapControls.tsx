import { Button, Tooltip } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { SegmentedControl } from '@/components/common/segmentedControl'
import type { MapStyleId } from '@/lib/mapStyles'

const STYLES: { id: MapStyleId; labelKey: string }[] = [
  { id: 'map', labelKey: 'map.styleMap' },
  { id: 'satellite', labelKey: 'map.styleSatellite' },
]

type Props = {
  styleId: MapStyleId
  onStyleChange: (id: MapStyleId) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFit?: () => void
  onLocate?: () => void
}

/** Controles del mapa. Todos con objetivo táctil de 44 px, también en escritorio. */
export function MapControls({
  styleId,
  onStyleChange,
  onZoomIn,
  onZoomOut,
  onFit,
  onLocate,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
      {/* Segmentado sobre material translúcido: la misma píldora que en el
        * formulario, sin sombra. */}
      <SegmentedControl
        label={t('map.style')}
        options={STYLES.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
        value={styleId}
        onChange={onStyleChange}
        className="pointer-events-auto bg-surface-tertiary/90 shadow-card backdrop-blur-xl [&>button]:px-3.5"
      />

      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-xl bg-overlay/95 shadow-card backdrop-blur-xl">
        <Tooltip>
          <Tooltip.Trigger>
            <Button
              variant="ghost"
              isIconOnly
              aria-label={t('map.zoomIn')}
              onPress={onZoomIn}
              className="size-11 rounded-none"
            >
              <PlusIcon />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>{t('map.zoomIn')}</Tooltip.Content>
        </Tooltip>
        <div className="h-px bg-border" />
        <Tooltip>
          <Tooltip.Trigger>
            <Button
              variant="ghost"
              isIconOnly
              aria-label={t('map.zoomOut')}
              onPress={onZoomOut}
              className="size-11 rounded-none"
            >
              <MinusIcon />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>{t('map.zoomOut')}</Tooltip.Content>
        </Tooltip>
      </div>

      {onFit ? (
        <Tooltip>
          <Tooltip.Trigger>
            <Button
              variant="ghost"
              isIconOnly
              aria-label={t('map.fitRoute')}
              onPress={onFit}
              className="pointer-events-auto size-11 rounded-xl bg-overlay/95 shadow-card backdrop-blur-xl"
            >
              <FitIcon />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>{t('map.fitRoute')}</Tooltip.Content>
        </Tooltip>
      ) : null}

      {onLocate ? (
        <Tooltip>
          <Tooltip.Trigger>
            <Button
              variant="ghost"
              isIconOnly
              aria-label={t('map.locate')}
              onPress={onLocate}
              className="pointer-events-auto size-11 rounded-xl bg-overlay/95 shadow-card backdrop-blur-xl"
            >
              <LocateIcon />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>{t('map.locate')}</Tooltip.Content>
        </Tooltip>
      ) : null}
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M3.5 8h9" />
    </svg>
  )
}

function FitIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 5.5V2h3.5M10.5 2H14v3.5M14 10.5V14h-3.5M5.5 14H2v-3.5" />
    </svg>
  )
}

function LocateIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="3.4" />
      <path d="M8 1v2.2M8 12.8V15M1 8h2.2M12.8 8H15" />
    </svg>
  )
}
