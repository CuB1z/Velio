import { Button, Modal, SearchField, useOverlayState } from '@heroui/react'
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
import { SavedCard, SavedCardSkeleton } from '@/components/saved/savedCard'
import { SavedStats } from '@/components/saved/savedStats'
import { useLangPath } from '@/lib/paths'

const PAGE_SIZES = ['12', '24', '48'] as const
type PageSize = (typeof PAGE_SIZES)[number]

export function SavedRoutesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const to = useLangPath()
  const client = useQueryClient()
  const describe = useApiErrorMessage()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZES[0])
  const [search, setSearch] = useState('')
  const [selecting, setSelecting] = useState(false)
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
      setSelecting(false)
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
  const meta = query.data?.meta

  function stopSelecting() {
    setSelecting(false)
    setSelection(new Set())
  }

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        eyebrow={t('nav.saved')}
        title={t('saved.title')}
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
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted"
                >
                  <SearchField.SearchIcon className="m-0 text-current" />
                </span>
                <SearchField.Input placeholder={t('saved.searchPlaceholder')} />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            {meta?.total && !selecting ? (
              <Button variant="outline" className="min-h-11" onPress={() => setSelecting(true)}>
                {t('saved.select')}
              </Button>
            ) : null}
            <Button variant="primary" className="min-h-11" onPress={() => void navigate(to('/loops'))}>
              {t('saved.newRoute')}
            </Button>
          </>
        }
      />

      {meta?.total && query.data ? (
        <SavedStats routes={query.data.data} total={meta.total} pageOnly={meta.total_pages > 1} />
      ) : null}

      {actionError ? (
        <p className="text-sm text-danger" role="alert">
          {actionError}
        </p>
      ) : null}

      {isEmpty ? (
        <div className="flex flex-col items-center rounded-3xl bg-surface px-6 py-16 text-center ring-1 ring-border">
          <EmptyIllustration />
          <h2 className="mt-6 text-xl font-semibold tracking-tight text-balance">{t('saved.empty')}</h2>
          <p className="mt-2 max-w-sm text-muted text-pretty">{t('saved.emptyHint')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button variant="primary" className="min-h-11" onPress={() => void navigate(to('/loops'))}>
              {t('saved.emptyAction')}
            </Button>
            <Button variant="outline" className="min-h-11" onPress={() => void navigate(to('/routes'))}>
              {t('saved.emptyRoute')}
            </Button>
          </div>
        </div>
      ) : (
        <ul aria-busy={query.isLoading} className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {query.isLoading
            ? Array.from({ length: 6 }, (_, index) => <SavedCardSkeleton key={index} />)
            : visible.map((route) => (
                <SavedCard
                  key={route.id}
                  route={route}
                  isSelected={selection.has(route.id)}
                  selecting={selecting}
                  onToggle={() => toggle(route.id)}
                />
              ))}
          {query.isLoading || selecting ? null : (
            <li className="flex">
              <Link
                to={to('/loops')}
                className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-foreground/20 p-6 text-center text-muted transition-colors duration-150 hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <PlusIcon />
                <span className="text-lg font-semibold tracking-tight text-foreground">{t('saved.newTile')}</span>
                <span className="eyebrow">{t('saved.newTileHint')}</span>
              </Link>
            </li>
          )}
        </ul>
      )}

      {!query.isLoading && !isEmpty && visible.length === 0 ? (
        <p className="py-10 text-center text-muted">{t('saved.noMatches')}</p>
      ) : null}

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

      {selecting ? (
        <div className="sticky bottom-4 z-20 mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-full bg-overlay/90 px-5 py-2.5 ring-1 ring-border backdrop-blur-xl">
          <span className="text-sm font-semibold" aria-live="polite">
            {selection.size === 0
              ? t('saved.selectHint')
              : selection.size === 1
                ? t('saved.selectedOne')
                : t('saved.selected', { count: selection.size })}
          </span>
          {selection.size < visible.length ? (
            <Button
              variant="ghost"
              className="min-h-11"
              onPress={() => setSelection(new Set(visible.map((route) => route.id)))}
            >
              {t('saved.selectAll')}
            </Button>
          ) : null}
          <Button variant="ghost" className="min-h-11" onPress={stopSelecting}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" className="min-h-11" isDisabled={selection.size === 0} onPress={confirm.open}>
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

function EmptyIllustration() {
  return (
    <div aria-hidden="true" className="flex size-28 items-center justify-center rounded-full bg-accent-soft text-accent-text">
      <svg width="88" height="68" viewBox="0 0 72 56" fill="none">
        <path
          d="M14 40c-6-10 2-26 16-28 10-2 14 6 22 4 8-2 12 8 6 16-5 7-14 4-20 8-7 5-18 10-24 0Z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5 6"
        />
        <circle cx="14" cy="40" r="4.5" fill="currentColor" />
      </svg>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
