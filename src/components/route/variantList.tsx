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
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="text-[13px] text-muted">
        {t('result.variants')}
      </span>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {variants.map((variant, index) => {
          const isSelected = index === selected
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelect(index)}
              aria-pressed={isSelected}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                isSelected
                  ? 'border-accent bg-accent-soft'
                  : 'border-border bg-surface hover:bg-surface-hover',
              )}
            >
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: categorical(resolved, index) }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {index === 0
                    ? t('result.variantMain')
                    : t('result.variantAlternative', { index })}
                </span>
                <span className="tnum mt-0.5 block truncate text-xs text-muted">
                  {formatDistance(variant.distance_km)} · {formatSigned(variant.gain_m)} ·{' '}
                  {formatDuration(variant.duration_min)}
                </span>
              </span>
              {variant.cycling_score ? (
                <span className="tnum shrink-0 text-base font-semibold">
                  {formatScore(variant.cycling_score.total)}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
