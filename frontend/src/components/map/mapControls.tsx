import { Button, Tooltip } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { SegmentedControl } from '@/components/common/segmentedControl'
import { cn } from '@/lib/cn'
import type { MapStyleId } from '@/lib/mapStyles'

const STYLES: { id: MapStyleId; labelKey: string }[] = [
  { id: 'map', labelKey: 'map.styleMap' },
  { id: 'satellite', labelKey: 'map.styleSatellite' },
]

type Props = {
  styleId: MapStyleId
  onStyleChange: (id: MapStyleId) => void
  relief: boolean
  onReliefChange: (on: boolean) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFit?: () => void
  onLocate?: () => void
}

/** Map controls, all with a 44 px touch target, desktop included. */
export function MapControls({
  styleId,
  onStyleChange,
  relief,
  onReliefChange,
  onZoomIn,
  onZoomOut,
  onFit,
  onLocate,
}: Props) {
  const { t } = useTranslation()
  const reliefOn = relief && styleId === 'map'

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
      {/* Segmented control on translucent material: the form's pill, without shadow. */}
      <SegmentedControl
        label={t('map.style')}
        options={STYLES.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
        value={styleId}
        onChange={onStyleChange}
        className="pointer-events-auto bg-overlay/85 ring-1 ring-border backdrop-blur-xl [&>button]:px-3.5"
      />

      <button
        type="button"
        aria-pressed={reliefOn}
        disabled={styleId !== 'map'}
        onClick={() => onReliefChange(!relief)}
        className={cn(
          'pointer-events-auto flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm ring-1 ring-border backdrop-blur-xl transition-colors duration-150 ease-enter disabled:opacity-50',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          reliefOn
            ? 'bg-foreground font-semibold text-background'
            : 'bg-overlay/85 font-medium text-muted enabled:hover:text-foreground',
        )}
      >
        <ReliefIcon />
        {t('map.relief')}
      </button>

      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-full bg-overlay/85 ring-1 ring-border backdrop-blur-xl">
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
              className="pointer-events-auto size-11 rounded-full bg-overlay/85 ring-1 ring-border backdrop-blur-xl"
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
              className="pointer-events-auto size-11 rounded-full bg-overlay/85 ring-1 ring-border backdrop-blur-xl"
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

function ReliefIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 13 6 5.5l3 5 1.8-2.8L14.5 13z" />
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
