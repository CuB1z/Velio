import { Pagination } from '@heroui/react'
import { useTranslation } from 'react-i18next'

type Props = {
  page: number
  totalPages: number
  onChange: (page: number) => void
  className?: string
}

/** Primera, última y una ventana alrededor de la actual; el resto, elipsis. */
function pageList(page: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const around = [page - 1, page, page + 1].filter((value) => value > 1 && value < total)
  const items: (number | 'gap')[] = [1]
  if (around[0] !== undefined && around[0] > 2) items.push('gap')
  items.push(...around)
  if (around[around.length - 1] !== undefined && around[around.length - 1] < total - 1) {
    items.push('gap')
  }
  items.push(total)
  return items
}

export function Pager({ page, totalPages, onChange, className }: Props) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null

  return (
    <Pagination className={className} aria-label={`${t('common.of')} ${totalPages}`}>
      <Pagination.Content className="flex flex-wrap items-center justify-center gap-1">
        <Pagination.Item>
          <Pagination.Previous
            className="flex size-11 items-center justify-center rounded-lg"
            isDisabled={page <= 1}
            onPress={() => onChange(page - 1)}
          >
            <Pagination.PreviousIcon />
            <span className="sr-only">{t('common.back')}</span>
          </Pagination.Previous>
        </Pagination.Item>

        {pageList(page, totalPages).map((entry, index) =>
          entry === 'gap' ? (
            <Pagination.Item key={`gap-${index}`}>
              <Pagination.Ellipsis className="px-1 text-muted" />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={entry}>
              <Pagination.Link
                className="tnum flex size-11 items-center justify-center rounded-lg text-sm"
                isActive={entry === page}
                onPress={() => onChange(entry)}
              >
                {entry}
              </Pagination.Link>
            </Pagination.Item>
          ),
        )}

        <Pagination.Item>
          <Pagination.Next
            className="flex size-11 items-center justify-center rounded-lg"
            isDisabled={page >= totalPages}
            onPress={() => onChange(page + 1)}
          >
            <Pagination.NextIcon />
            <span className="sr-only">{t('common.continue')}</span>
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  )
}
