import { Button, ComboBox, Description, Input, Label, ListBox, Modal, useOverlayState } from '@heroui/react'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ListLayout, Virtualizer } from 'react-aria-components'
import { useTranslation } from 'react-i18next'

import { requestCoverage } from '@/api/coverage'
import { isApiError } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import { ErrorState } from '@/components/common/errorState'
import { TextInput } from '@/components/common/field'
import { useCoverage } from '@/hooks/useCoverage'
import { useRetryAfter } from '@/hooks/useRetryAfter'
import { countryOptions, preferredCountry, type CountryOption } from '@/lib/countries'
import { DEFAULT_LANGUAGE, isLanguage, LANGUAGE_INFO } from '@/i18n/languages'
import { cn } from '@/lib/cn'

const NOTE_MAX = 280
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Props = { state: ReturnType<typeof useOverlayState> }

export function AskCountryButton({ onPress, className }: { onPress: () => void; className?: string }) {
  const { t } = useTranslation()
  return (
    <Button variant="secondary" size="sm" onPress={onPress} className={cn('min-h-11 md:min-h-9', className)}>
      {t('coverage.ask')}
    </Button>
  )
}

export function RequestCountryDialog({ state }: Props) {
  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>{state.isOpen ? <RequestCountryForm onClose={state.close} /> : null}</Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

function RequestCountryForm({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const { status } = useAuth()
  const signedIn = status === 'authenticated'
  const { coverage, isos } = useCoverage()
  const locale = LANGUAGE_INFO[isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE].locale
  const options = useMemo(() => countryOptions(locale, isos), [locale, isos])
  const [picked, setPicked] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const suggested = coverage ? preferredCountry(navigator.languages ?? [], isos) : null
  const country = picked ?? suggested ?? ''

  const mutation = useMutation({
    mutationFn: () =>
      requestCoverage(
        { country, email: signedIn ? undefined : email.trim(), note: note.trim() || undefined },
        signedIn,
      ),
  })
  const retryIn = useRetryAfter(mutation.error)
  const countryName = options.find((option) => option.code === (mutation.data?.country ?? country))?.name ?? country

  const emailError = !signedIn && touched && !EMAIL.test(email.trim()) ? t('coverage.emailInvalid') : undefined
  const noteError = note.length > NOTE_MAX ? t('coverage.noteTooLong', { max: NOTE_MAX }) : undefined
  const canSubmit = Boolean(country) && (signedIn || EMAIL.test(email.trim())) && !noteError

  if (mutation.data) {
    const recorded = mutation.data.recorded
    return (
      <>
        <Modal.Header>
          <Modal.Heading>{recorded ? t('coverage.recordedTitle') : t('coverage.alreadyTitle')}</Modal.Heading>
        </Modal.Header>
        <Modal.Body>
          <p className="text-sm text-muted" role="status">
            {t(recorded ? 'coverage.recorded' : 'coverage.already', { country: countryName })}
          </p>
        </Modal.Body>
        <Modal.Footer className="flex justify-end">
          <Button variant="primary" className="min-h-11" onPress={onClose}>
            {t('coverage.close')}
          </Button>
        </Modal.Footer>
      </>
    )
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setTouched(true)
        if (canSubmit) mutation.mutate()
      }}
    >
      <Modal.Header>
        <Modal.Heading>{t('coverage.title')}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t('coverage.body')}</p>

        <ComboBox
          fullWidth
          isRequired
          defaultItems={options}
          selectedKey={country || null}
          onSelectionChange={(key) => setPicked(key ? String(key) : '')}
          className="flex flex-col gap-2"
        >
          <Label>{t('coverage.country')}</Label>
          <ComboBox.InputGroup>
            <Input placeholder={t('coverage.countryPlaceholder')} />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Popover className="w-(--trigger-width)">
            <Virtualizer layout={ListLayout} layoutOptions={{ rowHeight: 40 }}>
              <ListBox className="max-h-64 overflow-y-auto">
                {(option: CountryOption) => (
                  <ListBox.Item id={option.code} textValue={option.name}>
                    {option.name}
                  </ListBox.Item>
                )}
              </ListBox>
            </Virtualizer>
          </ComboBox.Popover>
        </ComboBox>

        {signedIn ? null : (
          <TextInput
            label={t('coverage.email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            isRequired
            description={t('coverage.emailHint')}
            errorMessage={emailError}
          />
        )}

        <TextInput
          label={t('coverage.note')}
          placeholder={t('coverage.notePlaceholder')}
          value={note}
          onChange={setNote}
          errorMessage={noteError}
        />

        {mutation.error && !(isApiError(mutation.error) && mutation.error.code === 'RATE_LIMITED') ? (
          <ErrorState error={mutation.error} />
        ) : null}
        {touched && !country ? (
          <Description className="text-danger">{t('coverage.countryRequired')}</Description>
        ) : null}
      </Modal.Body>
      <Modal.Footer className="flex justify-end gap-2">
        <Button variant="ghost" className="min-h-11" onPress={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="min-h-11"
          isDisabled={mutation.isPending || retryIn > 0}
        >
          {retryIn > 0 ? t('common.retryIn', { seconds: retryIn }) : t('coverage.submit')}
        </Button>
      </Modal.Footer>
    </form>
  )
}
