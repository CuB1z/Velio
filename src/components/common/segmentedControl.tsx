import { cn } from '@/lib/cn'

export type SegmentOption<T extends string> = { id: T; label: string }

/**
 * Segmented control: a track with a white pill over the active option.
 * Options are `aria-pressed` buttons.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid gap-0.5 rounded-[9px] bg-surface-tertiary p-0.5', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const isSelected = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={isSelected}
            data-selected={isSelected}
            className={cn(
              'min-h-11 truncate rounded-[7px] px-2 text-[13px] transition-colors duration-150 ease-enter md:min-h-8',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
              isSelected
                ? // White in light mode; in dark, one step above the track.
                  'bg-surface font-semibold text-foreground shadow-sm dark:bg-surface-hover'
                : 'text-muted hover:bg-surface/60 hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
