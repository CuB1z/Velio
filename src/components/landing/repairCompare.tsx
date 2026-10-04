import { useTranslation } from 'react-i18next'

import { formatDistance, formatRatio } from '@/lib/format'
import { LANDING_REPAIR } from '@/pages/landingExamples'
import { Reveal } from './reveal'
import { RouteMap } from './routeMap'

/**
 * El mismo circuito, antes y después del arreglo de ida-y-vuelta, sobre el
 * mapa real. En naranja, la vía que el primero recorre dos veces.
 */
export function RepairCompare() {
  const { t } = useTranslation()
  const { before, after } = LANDING_REPAIR
  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
      <Reveal>
        <figure className="overflow-hidden rounded-2xl border border-border bg-surface">
          <RouteMap shape={before.shape} highlight={before.repeated} padding={26} className="aspect-[4/3]" />
          <figcaption className="flex items-baseline justify-between gap-3 p-4">
            <span className="text-[15px] font-semibold">{t('landing.repairBefore')}</span>
            <span className="tnum text-[13px] text-muted">
              {formatDistance(before.distance_km)} · <span className="text-[#b45309]">{t('landing.repairRepeated', { value: formatRatio(before.overlap, 0) })}</span>
            </span>
          </figcaption>
        </figure>
      </Reveal>
      <div className="hidden text-muted sm:block" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
      <Reveal delay={120}>
        <figure className="overflow-hidden rounded-2xl border border-border bg-surface">
          <RouteMap shape={after.shape} padding={26} className="aspect-[4/3]" />
          <figcaption className="flex items-baseline justify-between gap-3 p-4">
            <span className="text-[15px] font-semibold">{t('landing.repairAfter')}</span>
            <span className="tnum text-[13px] text-muted">
              {formatDistance(after.distance_km)} · {t('landing.repairRepeated', { value: formatRatio(after.overlap, 0) })} ·{' '}
              <span className="font-semibold text-accent">{t('landing.repairScore', { value: after.score.toFixed(1) })}</span>
            </span>
          </figcaption>
        </figure>
      </Reveal>
    </div>
  )
}
