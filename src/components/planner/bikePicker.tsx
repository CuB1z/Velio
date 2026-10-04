import { useTranslation } from 'react-i18next'

import { InsetGroup, InsetRow } from '@/components/common/insetGroup'
import { SegmentedControl } from '@/components/common/segmentedControl'
import type { BikeType, HillsPreference } from '@/types/api'

const BIKES: BikeType[] = ['road', 'city', 'gravel', 'mtb']
const HILLS: HillsPreference[] = ['flat', 'rolling', 'hilly']

/** Cuatro posiciones y una línea que dice qué implica la elegida. */
export function BikeSegments({
  bike,
  onChange,
}: {
  bike: BikeType
  onChange: (value: BikeType) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        label={t('bike.label')}
        options={BIKES.map((id) => ({ id, label: t(`bike.${id}`) }))}
        value={bike}
        onChange={onChange}
      />
      <p className="text-xs leading-relaxed text-muted">{t(`bike.${bike}Hint`)}</p>
    </div>
  )
}

export function HillsSegments({
  hills,
  onChange,
}: {
  hills: HillsPreference
  onChange: (value: HillsPreference) => void
}) {
  const { t } = useTranslation()
  return (
    <SegmentedControl
      label={t('hills.label')}
      options={HILLS.map((id) => ({ id, label: t(`hills.${id}`) }))}
      value={hills}
      onChange={onChange}
    />
  )
}

/**
 * Las dos preguntas que se hace un ciclista antes de salir, como dos grupos.
 * El planificador de circuitos las reparte en su propia estructura; este
 * conjunto es para las pantallas que solo necesitan las dos juntas.
 */
export function BikePicker({
  bike,
  hills,
  onBikeChange,
  onHillsChange,
}: {
  bike: BikeType
  hills: HillsPreference
  onBikeChange: (value: BikeType) => void
  onHillsChange: (value: HillsPreference) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <InsetGroup title={t('bike.label')}>
        <InsetRow stacked>
          <BikeSegments bike={bike} onChange={onBikeChange} />
        </InsetRow>
      </InsetGroup>
      <InsetGroup title={t('hills.label')}>
        <InsetRow stacked>
          <HillsSegments hills={hills} onChange={onHillsChange} />
        </InsetRow>
      </InsetGroup>
    </div>
  )
}
