import { Accordion } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import { AskCountryButton } from '@/components/coverage/requestCountryDialog'

const QUESTIONS = ['coverage', 'free', 'gpx', 'accuracy', 'traffic', 'offline']

export function Faq({ onAskCountry }: { onAskCountry: () => void }) {
  const { t } = useTranslation()
  return (
    <Accordion variant="surface" className="divide-y divide-border rounded-none bg-transparent shadow-none ring-0">
      {QUESTIONS.map((key) => (
        <Accordion.Item key={key} id={key} className="border-0 bg-transparent after:start-0! after:w-full! last:after:hidden">
          <Accordion.Heading>
            <Accordion.Trigger className="min-h-16 rounded-none! gap-6 px-0 py-6 text-xl font-medium tracking-tight transition-colors hover:bg-transparent! hover:text-muted data-[hovered=true]:bg-transparent!">
              {t(`landing.faq.${key}.q`)}
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="max-w-2xl px-0 pb-7 text-lg leading-relaxed text-muted text-pretty">
              {t(`landing.faq.${key}.a`)}
              {key === 'coverage' ? (
                <span className="mt-5 flex">
                  <AskCountryButton onPress={onAskCountry} />
                </span>
              ) : null}
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  )
}
