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
   * Con unidad, el valor se puede escribir: un slider de 1 km en 500 no se
   * clava arrastrando. Sin ella se muestra `display` tal cual.
   */
  unit?: string
  /** Valor ya formateado, para los usos que no necesitan edición. */
  display?: string
  hint?: string
}

/**
 * El Slider de HeroUI es un grid con áreas propias — "label output" arriba y
 * "track" debajo —, así que sus tres hijos van directamente dentro: meter un
 * div de por medio saca a la etiqueta de su área.
 *
 * Aspecto: pista fina de 4px y pomo blanco de 24px con hairline, en vez de la
 * pista gorda y el pomo azul por defecto. El pomo se posiciona a la mitad de
 * la pista, así que puede ser más alto que ella sin romper nada.
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
    <div className="flex flex-col gap-4.5">
      <Slider
        value={value}
        onChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
        minValue={min}
        maxValue={max}
        step={step}
        className="gap-x-3 gap-y-4.5"
      >
        <Label className="text-[15px] text-foreground">{label}</Label>
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
          <Slider.Output className="tnum text-[15px] font-medium">{display}</Slider.Output>
        )}
        <Slider.Track className="h-1 rounded-full">
          <Slider.Fill className="rounded-full" />
          <Slider.Thumb className="size-6 border border-border bg-surface data-[dragging=true]:bg-surface" />
        </Slider.Track>
      </Slider>
      {hint ? <span className="text-[12px] text-muted">{hint}</span> : null}
    </div>
  )
}

/**
 * El valor como campo: se escribe, se confirma al salir o con Intro, y se
 * acota al rango del slider. El borrador solo existe mientras el campo tiene
 * el foco; fuera de él se muestra el valor real, así el slider y el campo no
 * necesitan sincronizarse con un efecto.
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
    <span className="tnum flex items-baseline gap-1 text-[15px] font-medium">
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
      <span className="text-muted">{unit}</span>
    </span>
  )
}
