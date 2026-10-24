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
 * Route list that doubles as the map legend: each row shows its swatch next to
 * the name, so identity never relies on color alone.
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
              'flex min-h-9 items-center gap-2 rounded-full px-3 text-sm transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              isSelected
                ? 'bg-foreground font-semibold text-background'
                : 'bg-surface-secondary font-medium text-muted hover:text-foreground',
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
