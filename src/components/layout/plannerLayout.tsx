import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ChevronIcon } from '@/components/common/icons'

type Props = {
  form: ReactNode
  map: ReactNode
  result?: ReactNode
  /** Collapsed by the user to see the whole map. Desktop only. */
  resultCollapsed?: boolean
  onResultCollapsedChange?: (collapsed: boolean) => void
}

/**
 * Desktop: fixed panel on the left, map on the right, result floating over the map.
 * Mobile: map on the top half, everything else stacked below in normal page flow.
 */
export function PlannerLayout({
  form,
  map,
  result,
  resultCollapsed: collapsed = false,
  onResultCollapsedChange,
}: Props) {
  // Collapsing only applies on desktop, where the result covers half the map.
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="order-2 shrink-0 border-border p-4 lg:order-1 lg:w-[420px] lg:overflow-y-auto lg:border-e lg:py-5 lg:ps-5 lg:pe-2 lg:[scrollbar-gutter:stable]">
        {form}
      </aside>

      <div className="order-1 flex min-h-0 flex-1 flex-col lg:order-2">
        <div className="relative h-[45vh] shrink-0 lg:h-full lg:flex-1">
          {map}

          {result ? (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 hidden lg:block">
              <div className="pointer-events-auto overflow-hidden rounded-2xl bg-overlay/95 shadow-raised backdrop-blur-xl">
                {/* Sheet handle: toggles the panel; its label lives in aria-label. */}
                <button
                  type="button"
                  onClick={() => onResultCollapsedChange?.(!collapsed)}
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? t('result.show') : t('result.hide')}
                  className="flex w-full flex-col items-center gap-1 pb-1 pt-2 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="h-1.5 w-9 rounded-full bg-border" aria-hidden="true" />
                  <ChevronIcon
                    className={
                      collapsed
                        ? 'text-muted transition-transform'
                        : 'rotate-180 text-muted transition-transform'
                    }
                  />
                </button>

                {collapsed ? null : (
                  <div className="max-h-[52vh] overflow-y-auto px-5 pb-5">{result}</div>
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
