import { Description, FieldError, Input, Label, TextField } from '@heroui/react'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

type BaseProps = {
  label: string
  /** Screen-reader only: for when the container already shows the label. */
  labelHidden?: boolean
  value: string
  onChange: (value: string) => void
  placeholder?: string
  description?: ReactNode
  errorMessage?: string
  isRequired?: boolean
  isDisabled?: boolean
  autoComplete?: string
  autoFocus?: boolean
  inputMode?: 'text' | 'email' | 'numeric' | 'decimal'
  type?: 'text' | 'email'
  className?: string
  /** Trailing action inside the field (e.g. locate on the map). */
  endContent?: ReactNode
}

/** TextField + Label + Input + FieldError, which HeroUI v3 leaves to be composed by hand. */
export function TextInput({
  label,
  labelHidden,
  value,
  onChange,
  placeholder,
  description,
  errorMessage,
  isRequired,
  isDisabled,
  autoComplete,
  autoFocus,
  inputMode,
  type = 'text',
  className,
  endContent,
}: BaseProps) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={Boolean(errorMessage)}
      type={type}
      className={cn('flex w-full flex-col gap-2', className)}
    >
      <Label className={labelHidden ? 'sr-only' : undefined}>{label}</Label>
      <div className="relative flex items-center">
        <Input
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          inputMode={inputMode}
          className={cn('w-full', endContent && 'pr-11')}
        />
        {endContent ? (
          <div className="absolute right-1 flex items-center">{endContent}</div>
        ) : null}
      </div>
      {description ? <Description>{description}</Description> : null}
      <FieldError>{errorMessage}</FieldError>
    </TextField>
  )
}

type PasswordProps = Omit<BaseProps, 'type' | 'inputMode' | 'endContent'> & {
  /** Action aligned with the label, e.g. "Forgot it?". */
  labelAction?: ReactNode
}

export function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  description,
  errorMessage,
  isRequired,
  isDisabled,
  autoComplete = 'current-password',
  autoFocus,
  className,
  labelAction,
}: PasswordProps) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const id = useId()

  return (
    <TextField
      value={value}
      onChange={onChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={Boolean(errorMessage)}
      type={visible ? 'text' : 'password'}
      className={cn('flex w-full flex-col gap-2', className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        {labelAction}
      </div>
      <div className="relative flex items-center">
        <Input
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className="w-full pr-11"
          aria-describedby={description ? id : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          /* 44 px touch target, even though the icon is 18. */
          className="absolute right-0 flex size-11 items-center justify-center rounded-md text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {description ? <Description id={id}>{description}</Description> : null}
      <FieldError>{errorMessage}</FieldError>
    </TextField>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M1 8s2.7-4.5 7-4.5S15 8 15 8s-2.7 4.5-7 4.5S1 8 1 8Z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M6.3 3.7A6.7 6.7 0 0 1 8 3.5c4.3 0 7 4.5 7 4.5a13 13 0 0 1-2.2 2.7M4 4.9A12.6 12.6 0 0 0 1 8s2.7 4.5 7 4.5c1 0 1.9-.2 2.7-.6" />
      <path d="M2 2l12 12" />
    </svg>
  )
}
