import { Button, Tooltip } from '@heroui/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { coordinatesToInput, parseCoordinates } from '@/lib/coords'
import type { LatLon } from '@/types/api'
import { TextInput } from '../common/field'

type Props = {
  label: string
  /** El grupo que lo contiene ya muestra el rótulo: dejarlo solo para lectores. */
  labelHidden?: boolean
  value: LatLon | null
  onChange: (value: LatLon | null) => void
  /** Activa el modo "elegir en el mapa" para este campo. */
  onPick?: () => void
  isPicking?: boolean
  onLocate?: () => void
  isRequired?: boolean
}

export function CoordinateField({
  label,
  labelHidden,
  value,
  onChange,
  onPick,
  isPicking,
  onLocate,
  isRequired,
}: Props) {
  const { t } = useTranslation()
  const [text, setText] = useState(value ? coordinatesToInput(value) : '')
  const [touched, setTouched] = useState(false)

  // Cuando el punto llega del mapa hay que reflejarlo en el texto, pero sin
  // pisar lo que el usuario esté escribiendo.
  useEffect(() => {
    if (!value) return
    const parsed = parseCoordinates(text)
    if (!parsed || Math.abs(parsed.lat - value.lat) > 1e-6 || Math.abs(parsed.lon - value.lon) > 1e-6) {
      setText(coordinatesToInput(value))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleChange(next: string) {
    setText(next)
    setTouched(true)
    onChange(parseCoordinates(next))
  }

  const invalid = touched && text.trim().length > 0 && parseCoordinates(text) === null

  return (
    <div className="flex items-end gap-2">
      <TextInput
        label={label}
        labelHidden={labelHidden}
        value={text}
        onChange={handleChange}
        placeholder={t('planner.originPlaceholder')}
        // Sin etiqueta visible el asterisco flota solo; el formulario ya
        // impide enviar sin origen.
        isRequired={labelHidden ? undefined : isRequired}
        inputMode="decimal"
        errorMessage={invalid ? t('analyze.polylineInvalid') : undefined}
        className="flex-1"
      />
      {onPick ? (
        <Tooltip>
          <Tooltip.Trigger>
            <Button
              variant={isPicking ? 'primary' : 'secondary'}
              isIconOnly
              aria-label={t('map.pickOnMap')}
              onPress={onPick}
              className="size-11 shrink-0"
            >
              <PinIcon />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>{isPicking ? t('map.pickOnMapHint') : t('map.pickOnMap')}</Tooltip.Content>
        </Tooltip>
      ) : null}
      {onLocate ? (
        <Tooltip>
          <Tooltip.Trigger>
            <Button
              variant="secondary"
              isIconOnly
              aria-label={t('map.locate')}
              onPress={onLocate}
              className="size-11 shrink-0"
            >
              <CrosshairIcon />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>{t('map.locate')}</Tooltip.Content>
        </Tooltip>
      ) : null}
    </div>
  )
}

function PinIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 14.5s5-4.2 5-8a5 5 0 1 0-10 0c0 3.8 5 8 5 8Z" />
      <circle cx="8" cy="6.4" r="1.9" />
    </svg>
  )
}

function CrosshairIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="3.4" />
      <path d="M8 1v2.2M8 12.8V15M1 8h2.2M12.8 8H15" />
    </svg>
  )
}
