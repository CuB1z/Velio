import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ChevronIcon } from '@/components/common/Icons'
import { cn } from '@/lib/cn'

type Sheet = 'hidden' | 'peek' | 'full'

const SHEETS: Sheet[] = ['hidden', 'peek', 'full']
const DRAG_STEP = 40

type Props = {
  form: ReactNode
  map: ReactNode
  /** Eyebrow and title above the form. */
  heading?: ReactNode
  result?: ReactNode
  mapNotice?: ReactNode
  /** Collapsed by the user to see the whole map. Desktop only. */
  resultCollapsed?: boolean
  onResultCollapsedChange?: (collapsed: boolean) => void
}

/**
 * Desktop: a panel overlaid on the map's left edge, the result floating over the
 * map. Mobile: the map fills the screen and the same panel becomes a bottom sheet
 * with three stops (full form, peek at the result or heading, hidden), dragged
 * or tapped from its handle; a new route drops it to the peek.
 */
export function PlannerLayout({
  form,
  map,
  heading,
  result,
  mapNotice,
  resultCollapsed: collapsed = false,
  onResultCollapsedChange,
}: Props) {
  const { t } = useTranslation()
  const hasResult = Boolean(result)
  const [sheet, setSheet] = useState<Sheet>('full')
  const [resultSeen, setResultSeen] = useState(hasResult)
  if (hasResult !== resultSeen) {
    setResultSeen(hasResult)
    if (hasResult) setSheet('peek')
  }

  const [drag, setDrag] = useState<number | null>(null)
  const dragStart = useRef<number | null>(null)
  const dragged = useRef(false)
  const step = (delta: number) =>
    setSheet((current) => SHEETS[Math.min(SHEETS.length - 1, Math.max(0, SHEETS.indexOf(current) + delta))])
  const notice = mapNotice ? (
    <p
      role="status"
      className="max-w-md rounded-2xl bg-overlay/90 px-4 py-2.5 text-center text-sm text-foreground ring-1 ring-border backdrop-blur-xl"
    >
      {mapNotice}
    </p>
  ) : null
  const sheetLabel = { full: t('planner.sheetFold'), peek: t('planner.sheetExpand'), hidden: t('planner.sheetShow') }[sheet]

  return (
    <div className="relative h-full lg:flex lg:flex-row">
      <aside
        className={cn(
          'absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-3xl bg-overlay/95 ring-1 ring-border backdrop-blur-xl',
          sheet === 'full' ? 'max-h-[70%]' : 'max-h-[40%]',
          drag === null && 'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          'lg:static lg:z-10 lg:h-full lg:max-h-none lg:w-[420px] lg:shrink-0 lg:overflow-hidden lg:rounded-none lg:rounded-e-3xl lg:bg-background lg:backdrop-blur-none',
        )}
        style={drag ? { transform: `translateY(${Math.max(drag, -DRAG_STEP * 2)}px)` } : undefined}
      >
        {notice ? (
          <div className="pointer-events-none absolute inset-x-4 bottom-full mb-3 flex justify-center lg:hidden">{notice}</div>
        ) : null}
        <button
          type="button"
          aria-expanded={sheet !== 'hidden'}
          aria-label={sheetLabel}
          onClick={() => {
            if (dragged.current) {
              dragged.current = false
              return
            }
            setSheet(sheet === 'full' ? 'peek' : sheet === 'peek' ? 'full' : 'peek')
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              step(event.key === 'ArrowDown' ? -1 : 1)
            }
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            dragStart.current = event.clientY
            dragged.current = false
            setDrag(0)
          }}
          onPointerMove={(event) => {
            if (dragStart.current === null) return
            const dy = event.clientY - dragStart.current
            if (Math.abs(dy) > 6) dragged.current = true
            setDrag(dy)
          }}
          onPointerUp={(event) => {
            if (dragStart.current === null) return
            const dy = event.clientY - dragStart.current
            dragStart.current = null
            setDrag(null)
            if (dy > DRAG_STEP) step(-1)
            else if (dy < -DRAG_STEP) step(1)
          }}
          onPointerCancel={() => {
            dragStart.current = null
            setDrag(null)
          }}
          className="flex min-h-11 w-full shrink-0 touch-none items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent lg:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </button>

        <div
          className={cn(
            'panel-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-4 lg:px-7 lg:pt-6',
            sheet === 'hidden' && 'max-lg:hidden',
          )}
        >
          {result ? <div className="pb-5 lg:hidden">{result}</div> : null}
          {heading ? (
            <div className={cn('flex flex-col gap-1.5 pb-5', sheet === 'peek' && hasResult && 'max-lg:hidden')}>{heading}</div>
          ) : null}
          <div className={cn('flex flex-1 flex-col', sheet !== 'full' && 'max-lg:hidden')}>{form}</div>
        </div>
      </aside>

      <div className="planner-map h-full lg:min-w-0 lg:flex-1 lg:-ms-6">
        <div className="relative h-full">
          {map}

          {result || notice ? (
            <div className="pointer-events-none absolute bottom-3 left-10 right-3 z-10 hidden flex-col items-center gap-3 lg:flex">
              {notice}
              {result ? (
                <div className="pointer-events-auto w-full overflow-hidden rounded-3xl bg-overlay/90 ring-1 ring-border backdrop-blur-xl">
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
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
