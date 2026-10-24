import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { formatCoordinates } from '@/lib/format'
import type { LatLon } from '@/types/api'

const LETTERS = 'ABCDEFGHIJKLMNOPQRST'

export const MAX_WAYPOINTS = 20

type Props = {
  value: LatLon[]
  onChange: (value: LatLon[]) => void
  pickTarget: number | null
  onPick: (index: number | null) => void
}

/**
 * Ordered stops. Reordered with buttons, not drag, so keyboard and screen
 * reader users can do it too.
 */
export function WaypointEditor({ value, onChange, pickTarget, onPick }: Props) {
  const { t } = useTranslation()

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return
    const next = [...value]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-5">
      <div className="flex items-center justify-between">
        <h3 className="eyebrow">{t('planner.stops')}</h3>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 text-sm text-accent-text md:min-h-9"
          onPress={() => onChange([...value].reverse())}
          isDisabled={value.length < 2}
        >
          {t('planner.reverse')}
        </Button>
      </div>

      <ol className="flex flex-col divide-y divide-border">
        {value.map((point, index) => {
          const [lat, lon] = formatCoordinates(point.lat, point.lon).split(' · ')
          return (
            <li key={index} className="flex min-h-14 items-center gap-3 py-1">
              <span
                aria-hidden="true"
                className="code flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background"
              >
                {LETTERS[index] ?? index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="sr-only">{t('planner.stopLetter', { letter: LETTERS[index] })}</span>
                <span className="code block text-sm leading-tight text-foreground">{lat}</span>
                <span className="code block text-sm leading-tight text-foreground">{lon}</span>
              </span>
              <Button
                variant={pickTarget === index ? 'primary' : 'ghost'}
                isIconOnly
                size="sm"
                className="size-11 shrink-0"
                aria-label={t('map.pickOnMap')}
                onPress={() => onPick(pickTarget === index ? null : index)}
              >
                <PinIcon />
              </Button>
              <Button
                variant="ghost"
                isIconOnly
                size="sm"
                className="size-11 shrink-0"
                aria-label={`${t('planner.stops')} ${index} ↑`}
                isDisabled={index === 0}
                onPress={() => move(index, index - 1)}
              >
                <ArrowIcon up />
              </Button>
              <Button
                variant="ghost"
                isIconOnly
                size="sm"
                className="size-11 shrink-0"
                aria-label={`${t('planner.stops')} ${index + 2} ↓`}
                isDisabled={index === value.length - 1}
                onPress={() => move(index, index + 1)}
              >
                <ArrowIcon />
              </Button>
              <Button
                variant="ghost"
                isIconOnly
                size="sm"
                className="size-11 shrink-0"
                aria-label={t('common.remove')}
                isDisabled={value.length <= 2}
                onPress={() => onChange(value.filter((_, i) => i !== index))}
              >
                <CloseIcon />
              </Button>
            </li>
          )
        })}
        <li className="px-2">
          <Button
            variant="ghost"
            className="min-h-11 w-full justify-start gap-2 px-2 text-[15px] text-accent-text"
            isDisabled={value.length >= MAX_WAYPOINTS}
            onPress={() => {
              const last = value[value.length - 1]
              onChange([...value, { lat: last.lat + 0.05, lon: last.lon + 0.05 }])
              onPick(value.length)
            }}
          >
            <PlusIcon />
            {t('planner.addStop')}
          </Button>
        </li>
      </ol>
      <p className="px-4 text-[12px] text-muted">{t('planner.stopsHint')}</p>
    </div>
  )
}

function PinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 14.5s5-4.2 5-8a5 5 0 1 0-10 0c0 3.8 5 8 5 8Z" />
      <circle cx="8" cy="6.4" r="1.9" />
    </svg>
  )
}

function ArrowIcon({ up }: { up?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={up ? undefined : { transform: 'rotate(180deg)' }}>
      <path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}
