import { useTranslation } from 'react-i18next'

import { useTheme } from '@/hooks/useTheme'
import { categorical } from '@/lib/chartPalette'
import { cn } from '@/lib/cn'
import { formatDistance, formatDuration, formatScore, formatSigned } from '@/lib/format'
import type { AnyRouteResult } from '@/types/api'

type Props = {
  variants: AnyRouteResult[]
  selected: number
  onSelect: (index: number) => void
  className?: string
}

/**
 * Lista de trazados. Hace de leyenda del mapa: con dos o más series la
 * identidad no puede depender solo del color, así que cada fila lleva su
 * muestra junto al nombre.
 */
export function VariantList({ variants, selected, onSelect, className }: Props) {
  const { t } = useTranslation()
  const { resolved } = useTheme()

  if (variants.length < 2) return null

  return (
    <div role="group" aria-label={t('result.variants')} className={cn('flex flex-wrap gap-1.5', className)}>
      {variants.map((variant, index) => {
        const isSelected = index === selected
        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            aria-pressed={isSelected}
            title={`${formatDistance(variant.distance_km)} · ${formatSigned(variant.gain_m)} · ${formatDuration(variant.duration_min)}`}
            className={cn(
              'flex min-h-9 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              isSelected
                ? 'border-accent bg-accent-soft font-semibold'
                : 'border-border bg-surface hover:bg-surface-hover',
            )}
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: categorical(resolved, index) }}
            />
            {index === 0 ? t('result.variantMain') : t('result.variantAlternative', { index })}
            {variant.cycling_score ? (
              <span className="tnum font-semibold">{formatScore(variant.cycling_score.total)}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
