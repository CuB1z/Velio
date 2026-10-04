import { Accordion } from '@heroui/react'
import { useTranslation } from 'react-i18next'

const QUESTIONS = ['coverage', 'free', 'gpx', 'accuracy', 'traffic', 'offline']

export function Faq() {
  const { t } = useTranslation()
  return (
    <Accordion variant="surface" className="shadow-card">
      {QUESTIONS.map((key) => (
        <Accordion.Item key={key} id={key}>
          <Accordion.Heading>
            <Accordion.Trigger className="min-h-16 gap-6 px-6 py-5 text-lg font-semibold tracking-tight">
              {t(`landing.faq.${key}.q`)}
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="max-w-2xl px-6 pb-6 text-base leading-relaxed text-muted text-pretty">
              {t(`landing.faq.${key}.a`)}
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  )
}
