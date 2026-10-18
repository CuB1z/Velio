import { cn } from '@/lib/cn'

export type SegmentOption<T extends string> = { id: T; label: string }

/**
 * Segmented control: a pill track with the active option in foreground.
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
      className={cn('grid gap-1 rounded-full bg-surface-secondary p-1', className)}
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
              'min-h-11 truncate rounded-full px-3 text-sm transition-colors duration-150 ease-enter md:min-h-9',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
              isSelected
                ? 'bg-foreground font-semibold text-background'
                : 'font-medium text-muted hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
