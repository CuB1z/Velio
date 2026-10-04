import { useTranslation } from 'react-i18next'

import { useTheme } from '@/hooks/useTheme'
import { status } from '@/lib/chartPalette'
import { cn } from '@/lib/cn'
import { formatDistance, formatRatio } from '@/lib/format'
import { LANDING_REPAIR } from '@/pages/landingExamples'
import { Reveal } from './reveal'
import { RouteMap } from './routeMap'

type Figure = { label: string; value: string; tone?: 'warn' | 'good' | 'accent' }

export function RepairSteps() {
  const { t } = useTranslation()
  const { resolved } = useTheme()
  const { before, after } = LANDING_REPAIR
  const repeated = t('landing.storyRepeated')

  const steps: {
    title: string
    body: string
    shape: [number, number][]
    highlight?: [number, number][][]
    figures: Figure[]
  }[] = [
    {
      title: 'landing.storyStep1Title',
      body: 'landing.storyStep1Body',
      shape: before.shape,
      figures: [
        { label: t('metric.distance'), value: formatDistance(before.distance_km) },
        { label: repeated, value: formatRatio(before.overlap, 0), tone: 'warn' },
      ],
    },
    {
      title: 'landing.storyStep2Title',
      body: 'landing.storyStep2Body',
      shape: before.shape,
      highlight: before.repeated,
      figures: [{ label: repeated, value: formatRatio(before.overlap, 0), tone: 'warn' }],
    },
    {
      title: 'landing.storyStep3Title',
      body: 'landing.storyStep3Body',
      shape: after.shape,
      figures: [
        { label: repeated, value: formatRatio(after.overlap, 0), tone: 'good' },
        { label: t('metric.score'), value: after.score.toFixed(1), tone: 'accent' },
      ],
    },
  ]

  return (
    <ol className="grid gap-5 md:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step.title}>
          <Reveal delay={index * 120} className="h-full">
            <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-surface shadow-card">
              <div className="relative aspect-[4/3]">
                <RouteMap shape={step.shape} highlight={step.highlight} padding={28} className="size-full" />
                <span className="tnum absolute start-4 top-4 rounded-full bg-surface px-2.5 py-1 text-[13px] font-semibold text-accent shadow-card">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-xl font-semibold tracking-tight text-balance">
                  {t(step.title)}
                </h3>
                <p className="mt-2 mb-6 leading-relaxed text-muted text-pretty">{t(step.body)}</p>
                <dl className="mt-auto flex gap-8 border-t border-separator pt-4">
                  {step.figures.map((figure) => (
                    <div key={figure.label}>
                      <dt className="text-[13px] text-muted">{figure.label}</dt>
                      <dd
                        className={cn(
                          'tnum mt-0.5 text-2xl font-semibold',
                          figure.tone === 'accent' && 'text-accent',
                        )}
                        style={
                          figure.tone === 'warn' || figure.tone === 'good'
                            ? { color: status(resolved, figure.tone === 'warn' ? 'warning' : 'good') }
                            : undefined
                        }
                      >
                        {figure.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </article>
          </Reveal>
        </li>
      ))}
    </ol>
  )
}
