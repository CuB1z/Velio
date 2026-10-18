import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ChevronIcon } from '@/components/common/icons'

type Props = {
  form: ReactNode
  map: ReactNode
  /** Eyebrow and title above the form. */
  heading?: ReactNode
  result?: ReactNode
  /** Collapsed by the user to see the whole map. Desktop only. */
  resultCollapsed?: boolean
  onResultCollapsedChange?: (collapsed: boolean) => void
}

/**
 * Desktop: a panel overlaid on the map's left edge, the result floating over the
 * map. Mobile: map on the top half, everything else stacked below in page flow.
 */
export function PlannerLayout({
  form,
  map,
  heading,
  result,
  resultCollapsed: collapsed = false,
  onResultCollapsedChange,
}: Props) {
  // Collapsing only applies on desktop, where the result covers half the map.
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="order-2 flex shrink-0 flex-col bg-background p-4 pb-0 lg:order-1 lg:relative lg:z-10 lg:h-full lg:w-[420px] lg:overflow-y-auto lg:rounded-e-3xl lg:px-7 lg:pt-6 lg:ring-1 lg:ring-border lg:[scrollbar-gutter:stable]">
        {heading ? <div className="flex flex-col gap-1.5 pb-5">{heading}</div> : null}
        {form}
      </aside>

      <div className="order-1 flex min-h-0 flex-1 flex-col lg:order-2 lg:-ms-6">
        <div className="relative h-[45vh] shrink-0 lg:h-full lg:flex-1">
          {map}

          {result ? (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 hidden lg:left-10 lg:block">
              <div className="pointer-events-auto overflow-hidden rounded-3xl bg-overlay/90 ring-1 ring-border backdrop-blur-xl">
                {/* Sheet handle: toggles the panel; its label lives in aria-label. */}
                <button
                  type="button"
                  onClick={() => onResultCollapsedChange?.(!collapsed)}
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? t('result.show') : t('result.hide')}
                  className="flex w-full flex-col items-center gap-1 pb-1 pt-2 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="h-1 w-9 rounded-full bg-border" aria-hidden="true" />
                  <ChevronIcon
                    className={
                      collapsed
                        ? 'text-muted transition-transform'
                        : 'rotate-180 text-muted transition-transform'
                    }
                  />
                </button>

                {collapsed ? null : (
                  <div className="max-h-[56vh] overflow-y-auto px-7 pb-6">{result}</div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {result ? <div className="order-3 p-4 lg:hidden">{result}</div> : null}
      </div>
    </div>
  )
}
