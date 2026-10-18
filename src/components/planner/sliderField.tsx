import { Label, Slider } from '@heroui/react'
import { useState } from 'react'

type Props = {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  /**
   * With a unit, the value is typeable: 1 km on a 500 km slider is hard to hit by
   * dragging. Without one, `display` is shown as is.
   */
  unit?: string
  /** Pre-formatted value, for uses that need no editing. */
  display?: string
  hint?: string
}

/**
 * HeroUI's Slider is a grid with named areas ("label output" / "track"), so its
 * three children must be direct: a wrapper div pulls the label out of its area.
 */
export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  display,
  hint,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <Slider
        value={value}
        onChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
        minValue={min}
        maxValue={max}
        step={step}
        className="items-end gap-x-3 gap-y-4"
      >
        <Label className="eyebrow">{label}</Label>
        {unit ? (
          <EditableValue
            label={label}
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            step={step}
            unit={unit}
          />
        ) : (
          <Slider.Output className="code text-3xl font-medium tracking-tight">{display}</Slider.Output>
        )}
        <Slider.Track className="h-0.5 rounded-full bg-border">
          <Slider.Fill className="rounded-full bg-foreground" />
          <Slider.Thumb className="size-4 border-0" />
        </Slider.Track>
      </Slider>
      {hint ? <span className="eyebrow">{hint}</span> : null}
    </div>
  )
}

/**
 * The value as an input: commits on blur or Enter, clamped to the slider range.
 * The draft only exists while focused, so slider and input need no sync effect.
 */
function EditableValue({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  unit: string
}) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    const text = draft
    setDraft(null)
    if (text === null) return
    const parsed = Number(text.replace(',', '.'))
    if (Number.isNaN(parsed)) return
    const clamped = Math.min(max, Math.max(min, Math.round(parsed / step) * step))
    if (clamped !== value) onChange(clamped)
  }

  return (
    <span className="code flex items-baseline gap-1.5 text-3xl font-medium tracking-tight">
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={draft ?? String(value)}
        onFocus={() => setDraft(String(value))}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
        }}
        className="w-[5ch] rounded-md bg-transparent text-right outline-none focus-visible:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
      />
      <span className="text-sm text-muted">{unit}</span>
    </span>
  )
}
