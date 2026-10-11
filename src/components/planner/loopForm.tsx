import { Button, Label, NumberField, Switch } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { formatDistance, formatRatio } from '@/lib/format'
import { minimumLoopKm } from '@/lib/geo'
import {
  DISTANCE_TOLERANCE,
  GAIN_TOLERANCE,
  type LoopFormValue,
} from './loopFormValue'
import { CoordinateField } from './coordinateField'
import { ChevronIcon } from '@/components/common/icons'
import { InsetGroup, InsetRow } from '@/components/common/insetGroup'
import { BikeSegments, HillsSegments } from './bikePicker'
import { SliderField } from './sliderField'


type Props = {
  value: LoopFormValue
  onChange: (value: LoopFormValue) => void
  onSubmit: () => void
  retryIn?: number
  onCancel?: () => void
  isBusy?: boolean
  pickTarget: 'origin' | number | null
  onPick: (target: 'origin' | number | null) => void
  onLocate?: () => void
}

export function LoopForm({
  value,
  onChange,
  onSubmit,
  retryIn = 0,
  onCancel,
  isBusy,
  pickTarget,
  onPick,
  onLocate,
}: Props) {
  const { t } = useTranslation()
  const patch = (next: Partial<LoopFormValue>) => onChange({ ...value, ...next })

  // A loop reaching a point D km away needs at least 2·D; below that the engine
  // can only return an out-and-back along the same road.
  const minimumKm = minimumLoopKm(value.origin, value.via)
  const viaTooFar = minimumKm > 0 && value.distanceKm < minimumKm
  const suggestedKm = Math.min(300, Math.ceil((minimumKm * 1.15) / 5) * 5)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      {/* ----------------------------------------------------------- start */}
      <InsetGroup title={t('planner.origin')}>
        <InsetRow className="py-2">
          <CoordinateField
            label={t('planner.origin')}
            labelHidden
            value={value.origin}
            onChange={(origin) => patch({ origin })}
            onPick={() => onPick(pickTarget === 'origin' ? null : 'origin')}
            isPicking={pickTarget === 'origin'}
            onLocate={onLocate}
            isRequired
          />
        </InsetRow>
        {value.via.map((point, index) => (
          <InsetRow key={index} className="py-2">
            <CoordinateField
              label={`${t('planner.via')} ${index + 1}`}
              labelHidden
              value={point}
              onChange={(next) =>
                patch({ via: value.via.map((item, i) => (i === index && next ? next : item)) })
              }
              onPick={() => onPick(pickTarget === index ? null : index)}
              isPicking={pickTarget === index}
            />
            <Button
              variant="ghost"
              isIconOnly
              aria-label={t('common.remove')}
              className="size-11 shrink-0"
              onPress={() => patch({ via: value.via.filter((_, i) => i !== index) })}
            >
              <CloseIcon />
            </Button>
          </InsetRow>
        ))}
        <InsetRow className="px-2">
          <Button
            variant="ghost"
            className="min-h-11 w-full justify-start gap-2 px-2 text-[15px] text-accent"
            onPress={() => {
              patch({ via: [...value.via, value.origin ?? { lat: 40.4168, lon: -3.7038 }] })
              onPick(value.via.length)
            }}
          >
            <PlusIcon />
            {t('planner.addVia')}
          </Button>
        </InsetRow>
      </InsetGroup>

      {viaTooFar ? (
        <div className="flex flex-col gap-2 rounded-xl bg-warning/10 p-3">
          <p className="text-[13px] leading-relaxed">
            {t('planner.viaTooFar', { minimum: formatDistance(minimumKm) })}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="min-h-11 self-start"
            onPress={() => patch({ distanceKm: suggestedKm })}
          >
            {t('planner.viaTooFarAction', { distance: formatDistance(suggestedKm) })}
          </Button>
        </div>
      ) : null}

      {/* ----------------------------------------------------------- route */}
      <InsetGroup title={t('planner.ride')}>
        <InsetRow stacked>
          <SliderField
            label={t('planner.distanceTarget')}
            value={value.distanceKm}
            onChange={(distanceKm) => patch({ distanceKm })}
            min={10}
            max={500}
            unit="km"
            hint={t('planner.tolerance', { value: formatRatio(DISTANCE_TOLERANCE, 0) })}
          />
        </InsetRow>
        <InsetRow stacked>
          <span className="text-[15px]">{t('hills.label')}</span>
          <HillsSegments hills={value.hills} onChange={(hills) => patch({ hills })} />
        </InsetRow>
        <InsetRow>
          <Switch
            isSelected={value.gainEnabled}
            onChange={(gainEnabled) => patch({ gainEnabled })}
            className="flex min-h-11 w-full items-center"
          >
            <Switch.Content className="flex w-full items-center justify-between gap-3">
              <span className="text-[15px]">{t('planner.gainTarget')}</span>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </InsetRow>
        {value.gainEnabled ? (
          <InsetRow stacked>
            <SliderField
              label={t('planner.gainTargetAmount')}
              value={value.gainM}
              onChange={(gainM) => patch({ gainM })}
              min={0}
              max={3000}
              step={50}
              unit="m"
              hint={t('planner.tolerance', { value: formatRatio(GAIN_TOLERANCE, 0) })}
            />
          </InsetRow>
        ) : null}
      </InsetGroup>

      {/* ------------------------------------------------------------ bike */}
      <InsetGroup title={t('bike.label')}>
        <InsetRow stacked>
          <BikeSegments bike={value.bike} onChange={(bike) => patch({ bike })} />
        </InsetRow>
      </InsetGroup>

      {/* -------------------------------------------------------- advanced */}
      <details className="group flex flex-col gap-1.5">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-xl bg-surface px-4 text-[15px] shadow-card marker:hidden">
          {t('planner.advanced')}
          <ChevronIcon className="text-muted transition-transform group-open:rotate-180" />
        </summary>
        <InsetGroup className="mt-1.5">
          <InsetRow stacked>
            <div className="grid grid-cols-2 gap-3">
              <NumberFieldRow
                label={t('planner.waypointCount')}
                value={value.waypointCount}
                onChange={(waypointCount) => patch({ waypointCount })}
                min={4}
                max={24}
              />
              <NumberFieldRow
                label={t('planner.maxIterations')}
                value={value.maxIterations}
                onChange={(maxIterations) => patch({ maxIterations })}
                min={1}
                max={16}
              />
            </div>
          </InsetRow>
          <InsetRow stacked>
            <NumberFieldRow
              label={t('planner.alternatives')}
              value={value.alternatives}
              onChange={(alternatives) => patch({ alternatives })}
              min={0}
              max={3}
            />
          </InsetRow>
          <InsetRow>
            <Switch
              isSelected={value.includeProfile}
              onChange={(includeProfile) => patch({ includeProfile })}
              className="flex min-h-11 w-full items-center justify-between gap-3"
            >
              <Switch.Content className="flex w-full items-center justify-between gap-3">
                <span className="text-[15px]">{t('planner.includeProfile')}</span>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </InsetRow>
        </InsetGroup>
      </details>

      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          fullWidth
          className="min-h-11 text-[15px] font-semibold"
          isDisabled={!value.origin || isBusy || retryIn > 0}
        >
          {isBusy
            ? t('planner.generating')
            : retryIn > 0
              ? t('common.retryIn', { seconds: retryIn })
              : t('planner.generateLoop')}
        </Button>
        {isBusy && onCancel ? (
          <Button variant="ghost" className="min-h-11" onPress={onCancel}>
            {t('common.cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  )
}

function NumberFieldRow({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
}) {
  return (
    <NumberField
      value={value}
      onChange={onChange}
      minValue={min}
      maxValue={max}
      className="flex flex-col gap-2"
    >
      <Label className="text-[13px] text-muted">{label}</Label>
      <NumberField.Group className="flex items-center">
        <NumberField.DecrementButton className="size-11 shrink-0" />
        <NumberField.Input className="code w-full text-center" />
        <NumberField.IncrementButton className="size-11 shrink-0" />
      </NumberField.Group>
    </NumberField>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
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
