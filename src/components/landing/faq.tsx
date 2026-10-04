import { useTranslation } from 'react-i18next'

import { ChevronIcon } from '@/components/common/icons'

const QUESTIONS = ['coverage', 'free', 'gpx', 'accuracy', 'traffic', 'offline']

/**
 * Preguntas frecuentes con `details` nativo: se abre sin JavaScript, el
 * navegador aporta la semántica y el teclado funciona solo. Además es la
 * única sección de la página sin un solo gráfico — ese contraste es
 * justamente lo que le da respiro al resto.
 */
export function Faq() {
  const { t } = useTranslation()
  return (
    <div className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface px-6 shadow-card">
      {QUESTIONS.map((key) => (
        <details key={key} className="group">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-semibold tracking-tight marker:hidden">
            {t(`landing.faq.${key}.q`)}
            <ChevronIcon className="shrink-0 text-muted transition-transform duration-300 ease-enter group-open:rotate-180" />
          </summary>
          <p className="max-w-2xl pb-6 leading-relaxed text-muted text-pretty">
            {t(`landing.faq.${key}.a`)}
          </p>
        </details>
      ))}
    </div>
  )
}
