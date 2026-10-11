import { Button, EmptyState, Modal, SearchField, useOverlayState } from '@heroui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import * as savedRoutesApi from '@/api/savedRoutes'
import { useApiErrorMessage } from '@/components/common/apiErrorMessage'
import { ErrorState } from '@/components/common/errorState'
import { Pager } from '@/components/common/pager'
import { PageHeader } from '@/components/common/pageHeader'
import { SegmentedControl } from '@/components/common/segmentedControl'
import { RouteThumbnail } from '@/components/route/routeThumbnail'
import { cn } from '@/lib/cn'
import { formatDistance, formatDuration, formatRelative, formatScore, formatSigned } from '@/lib/format'
import { readSavedResult, savedRouteKind } from '@/lib/savedRoute'
import type { SavedRoute } from '@/types/api'

const PAGE_SIZES = ['12', '24', '48'] as const
type PageSize = (typeof PAGE_SIZES)[number]

export function SavedRoutesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const client = useQueryClient()
  const describe = useApiErrorMessage()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZES[0])
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  const confirm = useOverlayState()

  const query = useQuery({
    queryKey: ['savedRoutes', page, pageSize],
    queryFn: () => savedRoutesApi.list(page, Number(pageSize)),
  })

  const remove = useMutation({
    mutationFn: (ids: string[]) => savedRoutesApi.removeMany(ids),
    onSuccess: async (_, ids) => {
      setSelection(new Set())
      confirm.close()
      if (page > 1 && ids.length >= (query.data?.data.length ?? 0)) setPage(page - 1)
      await client.invalidateQueries({ queryKey: ['savedRoutes'] })
    },
    onError: (error) => setActionError(describe(error)),
  })

  // The API has no search: this filters the loaded page, not the full set.
  const visible = useMemo(() => {
    const rows = query.data?.data ?? []
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((route) => route.name.toLowerCase().includes(needle))
  }, [query.data, search])

  const totalDistance = useMemo(
    () =>
      (query.data?.data ?? []).reduce(
        (sum, route) => sum + (readSavedResult(route)?.distance_km ?? 0),
        0,
      ),
    [query.data],
  )

  function toggle(id: string) {
    setSelection((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    )
  }

  const isEmpty = !query.isLoading && (query.data?.meta.total ?? 0) === 0

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title={t('saved.title')}
        subtitle={
          query.data
            ? t('saved.summary', {
                count: query.data.meta.total,
                distance: formatDistance(totalDistance),
              })
            : undefined
        }
        actions={
          <>
            <SearchField
              value={search}
              onChange={setSearch}
              aria-label={t('saved.searchPlaceholder')}
              className="w-full sm:w-64"
            >
              <SearchField.Group className="min-h-11 rounded-full ps-1.5">
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-soft-foreground"
                >
                  <SearchField.SearchIcon className="m-0 text-current" />
                </span>
                <SearchField.Input placeholder={t('saved.searchPlaceholder')} />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <Button variant="primary" className="min-h-11" onPress={() => void navigate('/loops')}>
              {t('saved.newRoute')}
            </Button>
          </>
        }
      />

      {actionError ? (
        <p className="text-sm text-danger" role="alert">
          {actionError}
        </p>
      ) : null}

      {isEmpty ? (
        <EmptyState className="py-20 text-center">
          <p className="text-base font-semibold">{t('saved.empty')}</p>
          <p className="mt-1 text-sm text-muted">{t('saved.emptyHint')}</p>
          <Button variant="primary" className="mt-5 min-h-11" onPress={() => void navigate('/loops')}>
            {t('saved.emptyAction')}
          </Button>
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {query.isLoading
            ? Array.from({ length: 6 }, (_, index) => (
                <li
                  key={index}
                  className="h-64 animate-pulse rounded-2xl border border-border bg-surface-secondary"
                />
              ))
            : visible.map((route) => (
                <SavedCard
                  key={route.id}
                  route={route}
                  isSelected={selection.has(route.id)}
                  onToggle={() => toggle(route.id)}
                />
              ))}
        </ul>
      )}

      {query.data && query.data.meta.total > Number(PAGE_SIZES[0]) ? (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <Pager page={page} totalPages={query.data.meta.total_pages} onChange={setPage} />
          <div className="flex items-center gap-3 sm:ms-auto">
            <span className="text-sm text-muted">{t('saved.perPage')}</span>
            <div className="w-44">
              <SegmentedControl
                label={t('saved.perPage')}
                options={PAGE_SIZES.map((size) => ({ id: size, label: size }))}
                value={pageSize}
                onChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {selection.size > 0 ? (
        <div className="sticky bottom-4 z-20 mx-auto flex items-center gap-4 rounded-2xl border border-border bg-overlay/95 px-4 py-2.5 backdrop-blur">
          <span className="text-sm font-semibold">
            {selection.size === 1
              ? t('saved.selectedOne')
              : t('saved.selected', { count: selection.size })}
          </span>
          <Button variant="ghost" className="min-h-11" onPress={() => setSelection(new Set())}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" className="min-h-11" onPress={confirm.open}>
            {t('common.delete')}
          </Button>
        </div>
      ) : null}

      <Modal state={confirm}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{t('saved.deleteConfirmTitle')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  {selection.size === 1
                    ? t('saved.deleteConfirmBody')
                    : t('saved.deleteManyConfirmBody', { count: selection.size })}
                </p>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button variant="ghost" className="min-h-11" onPress={confirm.close}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="danger"
                  className="min-h-11"
                  isDisabled={remove.isPending}
                  onPress={() => remove.mutate([...selection])}
                >
                  {t('common.delete')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  )
}

function SavedCard({
  route,
  isSelected,
  onToggle,
}: {
  route: SavedRoute
  isSelected: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const result = readSavedResult(route)
  const kind = savedRouteKind(route)

  return (
    <li
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-surface transition-colors',
        isSelected ? 'border-accent ring-2 ring-accent/30' : 'border-border',
      )}
    >
      <div className="relative h-36 border-b border-border">
        {result ? (
          <RouteThumbnail polyline={result.polyline} />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted">
            {t('saved.unreadable')}
          </div>
        )}
        <label className="absolute left-2 top-2 flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            className="size-5 accent-[var(--accent)]"
            aria-label={route.name}
          />
        </label>
        <span className="absolute right-2 top-2 rounded-full border border-border bg-overlay/90 px-2.5 py-1 text-[10px] font-medium text-muted backdrop-blur">
          {kind === 'loop' ? t('saved.kindLoop') : t('saved.kindRoute')}
        </span>
      </div>

      <div className="flex flex-col gap-2 p-3.5">
        <div className="flex items-baseline gap-2">
          <Link
            to={`/saved/${route.id}`}
            className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-accent after:absolute after:inset-0 after:content-['']"
          >
            {route.name}
          </Link>
          {result?.cycling_score ? (
            <span className="tnum shrink-0 text-sm font-semibold text-accent">
              {formatScore(result.cycling_score.total)}
            </span>
          ) : null}
        </div>
        {result ? (
          <p className="tnum truncate text-xs text-muted">
            {formatDistance(result.distance_km)} · {formatSigned(result.gain_m)}
            {result.duration_min > 0 ? ` · ${formatDuration(result.duration_min)}` : ''}
          </p>
        ) : null}
        <p className="text-[11px] text-muted">{formatRelative(route.created_at)}</p>
      </div>
    </li>
  )
}
