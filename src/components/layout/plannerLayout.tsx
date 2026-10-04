import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ChevronIcon } from '@/components/common/icons'

type Props = {
  form: ReactNode
  map: ReactNode
  result?: ReactNode
  /** Plegado por el usuario para ver el mapa entero. Solo aplica en escritorio. */
  resultCollapsed?: boolean
  onResultCollapsedChange?: (collapsed: boolean) => void
}

/**
 * Escritorio: panel fijo a la izquierda, mapa a la derecha y el resultado
 * flotando sobre el mapa.
 * Móvil: el mapa ocupa la mitad superior y todo lo demás se apila debajo, en
 * flujo normal. Sin hoja arrastrable: en un scroll de página se comporta mejor
 * y no pelea con el gesto de zoom del mapa.
 */
export function PlannerLayout({
  form,
  map,
  result,
  resultCollapsed: collapsed = false,
  onResultCollapsedChange,
}: Props) {
  // El plegado solo aplica en escritorio: ahí el resultado tapa medio mapa.
  // En móvil va en flujo debajo, así que plegarlo no descubriría nada.
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="order-2 shrink-0 border-border p-4 lg:order-1 lg:w-[380px] lg:overflow-y-auto lg:border-e lg:p-5">
        {form}
      </aside>

      <div className="order-1 flex min-h-0 flex-1 flex-col lg:order-2">
        <div className="relative h-[45vh] shrink-0 lg:h-full lg:flex-1">
          {map}

          {result ? (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 hidden lg:block">
              <div className="pointer-events-auto overflow-hidden rounded-2xl bg-overlay/95 shadow-raised backdrop-blur-xl">
                {/* Asa de hoja: se pliega y despliega desde ella; el texto va
                  * en el aria-label para no ocupar la cabecera. */}
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
