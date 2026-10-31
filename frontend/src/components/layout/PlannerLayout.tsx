import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ChevronIcon } from '@/components/common/Icons'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { neighbour, settle, stretch, type SheetStop } from '@/lib/sheet'

const SETTLE = 'transform var(--sheet-duration) var(--sheet-ease)'
const HANDLE_HEIGHT = 44
const PEEK_SHARE = 0.4
const DRAG_SLOP = 6
const STALE_GESTURE_MS = 100
const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [role="slider"], [role="switch"]'

type Drag = { y: number; base: number; lastY: number; lastTime: number; velocity: number; moved: boolean }

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
  const desktop = useMediaQuery('(width >= 64rem)')
  const [sheet, setSheet] = useState<SheetStop>('full')
  const [resultSeen, setResultSeen] = useState(hasResult)
  if (hasResult !== resultSeen) {
    setResultSeen(hasResult)
    if (hasResult) setSheet('peek')
  }

  const sheetRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const peekRef = useRef<HTMLDivElement>(null)
  const offsets = useRef<Record<SheetStop, number>>({ full: 0, peek: 0, hidden: 0 })
  const placed = useRef<SheetStop>(sheet)
  const drag = useRef<Drag | null>(null)
  const swallowClick = useRef(false)

  const measure = useCallback(() => {
    const el = sheetRef.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const height = el.offsetHeight
    const peek = Math.min(HANDLE_HEIGHT + (peekRef.current?.offsetHeight ?? 0), parent.clientHeight * PEEK_SHARE, height)
    offsets.current = { full: 0, peek: height - peek, hidden: height - HANDLE_HEIGHT }
  }, [])

  const place = useCallback((stop: SheetStop, animate: boolean) => {
    const el = sheetRef.current
    if (!el) return
    el.style.transition = animate ? SETTLE : 'none'
    el.style.transform = `translate3d(0, ${offsets.current[stop]}px, 0)`
    placed.current = stop
  }, [])

  useLayoutEffect(() => {
    const el = sheetRef.current
    if (!el) return
    if (desktop) {
      el.style.transition = ''
      el.style.transform = ''
      return
    }
    measure()
    place(sheet, placed.current !== sheet)
    if (sheet !== 'full' && scrollRef.current) scrollRef.current.scrollTop = 0
  }, [sheet, desktop, hasResult, measure, place])

  useLayoutEffect(() => {
    const el = sheetRef.current
    if (!el || desktop) return
    const observer = new ResizeObserver(() => {
      if (drag.current) return
      measure()
      place(placed.current, true)
    })
    observer.observe(el)
    if (el.parentElement) observer.observe(el.parentElement)
    if (peekRef.current) observer.observe(peekRef.current)
    return () => observer.disconnect()
  }, [desktop, hasResult, measure, place])

  const notice = mapNotice ? (
    <p
      role="status"
      className="max-w-md rounded-2xl bg-overlay/90 px-4 py-2.5 text-center text-sm text-foreground ring-1 ring-border backdrop-blur-xl"
    >
      {mapNotice}
    </p>
  ) : null
  const sheetLabel = { full: t('planner.sheetFold'), peek: t('planner.sheetExpand'), hidden: t('planner.sheetShow') }[sheet]
  const offscreen = {
    result: !desktop && sheet === 'hidden',
    heading: !desktop && (sheet === 'hidden' || (sheet === 'peek' && hasResult)),
    form: !desktop && sheet !== 'full',
  }

  return (
    <div className="relative h-full overflow-clip lg:flex lg:flex-row lg:overflow-visible">
      <aside
        ref={sheetRef}
        onPointerDown={(event) => {
          swallowClick.current = false
          const target = event.target as Element
          if (desktop || event.button !== 0) return
          if (!target.closest('[data-sheet-handle]') && (sheet === 'full' || target.closest(INTERACTIVE))) return
          drag.current = {
            y: event.clientY,
            base: offsets.current[sheet],
            lastY: event.clientY,
            lastTime: event.timeStamp,
            velocity: 0,
            moved: false,
          }
        }}
        onPointerMove={(event) => {
          const current = drag.current
          const el = sheetRef.current
          if (!current || !el) return
          const dy = event.clientY - current.y
          if (!current.moved) {
            if (Math.abs(dy) < DRAG_SLOP) return
            current.moved = true
            event.currentTarget.setPointerCapture(event.pointerId)
            el.style.transition = 'none'
          }
          const elapsed = event.timeStamp - current.lastTime
          if (elapsed > 0) {
            current.velocity = (event.clientY - current.lastY) / elapsed
            current.lastY = event.clientY
            current.lastTime = event.timeStamp
          }
          el.style.transform = `translate3d(0, ${stretch(current.base + dy, 0, offsets.current.hidden)}px, 0)`
        }}
        onPointerUp={(event) => {
          const current = drag.current
          drag.current = null
          if (!current?.moved) return
          swallowClick.current = true
          const velocity = event.timeStamp - current.lastTime > STALE_GESTURE_MS ? 0 : current.velocity
          const next = settle(sheet, event.clientY - current.y, velocity)
          if (next === sheet) place(sheet, true)
          else setSheet(next)
        }}
        onPointerCancel={() => {
          const moved = drag.current?.moved
          drag.current = null
          if (moved) place(sheet, true)
        }}
        onClickCapture={(event) => {
          if (!swallowClick.current) return
          swallowClick.current = false
          event.preventDefault()
          event.stopPropagation()
        }}
        className={cn(
          'absolute inset-x-0 bottom-0 z-20 flex max-h-[70%] flex-col rounded-t-3xl bg-overlay ring-1 ring-border will-change-transform',
          sheet !== 'full' && 'touch-none',
          'lg:static lg:z-10 lg:h-full lg:max-h-none lg:w-[420px] lg:shrink-0 lg:touch-auto lg:overflow-hidden lg:rounded-none lg:rounded-e-3xl lg:bg-background lg:will-change-auto',
        )}
      >
        {notice ? (
          <div className="pointer-events-none absolute inset-x-4 bottom-full mb-3 flex justify-center lg:hidden">{notice}</div>
        ) : null}
        <button
          type="button"
          data-sheet-handle
          aria-expanded={sheet !== 'hidden'}
          aria-label={sheetLabel}
          onClick={() => setSheet(sheet === 'peek' ? 'full' : 'peek')}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setSheet(neighbour(sheet, event.key === 'ArrowDown' ? -1 : 1))
            }
          }}
          className="flex min-h-11 w-full shrink-0 touch-none items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent lg:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </button>

        <div
          ref={scrollRef}
          className={cn(
            'panel-scroll flex min-h-0 flex-1 flex-col overscroll-y-contain px-4 lg:overflow-y-auto lg:px-7 lg:pt-6',
            sheet === 'full' ? 'overflow-y-auto' : 'overflow-hidden',
          )}
        >
          {result ? (
            <div ref={peekRef} inert={offscreen.result} className="pb-5 lg:hidden">
              {result}
            </div>
          ) : null}
          {heading ? (
            <div ref={hasResult ? undefined : peekRef} inert={offscreen.heading} className="flex flex-col gap-1.5 pb-5">
              {heading}
            </div>
          ) : null}
          <div inert={offscreen.form} className="flex flex-1 flex-col">
            {form}
          </div>
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
