import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ChevronIcon } from '@/components/common/Icons'
import { cn } from '@/lib/cn'
import { neighbour, settle, stretch, type SheetStop } from '@/lib/sheet'

const SETTLE = 'height 300ms cubic-bezier(0.32,0.72,0,1)'
const HANDLE_HEIGHT = 44
const FULL_SHARE = 0.7
const STALE_GESTURE_MS = 100

type Drag = { y: number; height: number; lastY: number; lastTime: number; velocity: number; moved: boolean }

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
  const [sheet, setSheet] = useState<SheetStop>('full')
  const [resultSeen, setResultSeen] = useState(hasResult)
  if (hasResult !== resultSeen) {
    setResultSeen(hasResult)
    if (hasResult) setSheet('peek')
  }

  const sheetRef = useRef<HTMLElement>(null)
  const drag = useRef<Drag | null>(null)
  const swallowClick = useRef(false)
  const settleFrom = useRef<number | null>(null)
  const settling = useRef<AbortController | null>(null)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const [moves, setMoves] = useState(0)

  function moveTo(next: SheetStop) {
    settleFrom.current = sheetRef.current?.offsetHeight ?? null
    setSheet(next)
    setMoves((count) => count + 1)
  }

  useLayoutEffect(() => {
    const el = sheetRef.current
    const from = settleFrom.current
    settleFrom.current = null
    settling.current?.abort()
    if (!el || from === null) return
    el.style.transition = ''
    el.style.height = ''
    el.style.maxHeight = ''
    const to = el.offsetHeight
    if (Math.abs(from - to) < 1 || matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const controller = new AbortController()
    settling.current = controller
    el.style.maxHeight = 'none'
    el.style.height = `${from}px`
    void el.offsetHeight
    el.style.transition = SETTLE
    el.style.height = `${to}px`
    el.addEventListener(
      'transitionend',
      (event) => {
        if (event.target !== el) return
        controller.abort()
        el.style.transition = ''
        el.style.height = ''
        el.style.maxHeight = ''
      },
      { signal: controller.signal },
    )
  }, [moves])

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
        ref={sheetRef}
        className={cn(
          'absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-3xl bg-overlay/95 ring-1 ring-border backdrop-blur-xl',
          sheet === 'full' ? 'max-h-[70%]' : 'max-h-[40%]',
          'lg:static lg:z-10 lg:h-full lg:max-h-none lg:w-[420px] lg:shrink-0 lg:overflow-hidden lg:rounded-none lg:rounded-e-3xl lg:bg-background lg:backdrop-blur-none',
        )}
        style={dragHeight === null ? undefined : { height: dragHeight, maxHeight: 'none' }}
      >
        {notice ? (
          <div className="pointer-events-none absolute inset-x-4 bottom-full mb-3 flex justify-center lg:hidden">{notice}</div>
        ) : null}
        <button
          type="button"
          aria-expanded={sheet !== 'hidden'}
          aria-label={sheetLabel}
          onClick={() => {
            if (swallowClick.current) {
              swallowClick.current = false
              return
            }
            moveTo(sheet === 'peek' ? 'full' : 'peek')
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              moveTo(neighbour(sheet, event.key === 'ArrowDown' ? -1 : 1))
            }
          }}
          onPointerDown={(event) => {
            const el = sheetRef.current
            if (!el) return
            event.currentTarget.setPointerCapture(event.pointerId)
            swallowClick.current = false
            settling.current?.abort()
            el.style.transition = ''
            drag.current = {
              y: event.clientY,
              height: el.offsetHeight,
              lastY: event.clientY,
              lastTime: event.timeStamp,
              velocity: 0,
              moved: false,
            }
          }}
          onPointerMove={(event) => {
            const current = drag.current
            const parent = sheetRef.current?.parentElement
            if (!current || !parent) return
            const dy = event.clientY - current.y
            if (Math.abs(dy) > 6) current.moved = true
            const elapsed = event.timeStamp - current.lastTime
            if (elapsed > 0) {
              current.velocity = (event.clientY - current.lastY) / elapsed
              current.lastY = event.clientY
              current.lastTime = event.timeStamp
            }
            if (current.moved) {
              setDragHeight(stretch(current.height - dy, HANDLE_HEIGHT, parent.clientHeight * FULL_SHARE))
            }
          }}
          onPointerUp={(event) => {
            const current = drag.current
            drag.current = null
            if (!current?.moved) return
            swallowClick.current = true
            const velocity = event.timeStamp - current.lastTime > STALE_GESTURE_MS ? 0 : current.velocity
            moveTo(settle(sheet, event.clientY - current.y, velocity))
            setDragHeight(null)
          }}
          onPointerCancel={() => {
            const moved = drag.current?.moved
            drag.current = null
            if (moved) moveTo(sheet)
            setDragHeight(null)
          }}
          className="flex min-h-11 w-full shrink-0 touch-none items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent lg:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </button>

        <div
          className={cn(
            'panel-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 lg:px-7 lg:pt-6',
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
