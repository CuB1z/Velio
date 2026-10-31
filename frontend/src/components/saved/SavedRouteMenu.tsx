import { Button, useOverlayState } from '@heroui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import * as savedRoutesApi from '@/api/savedRoutes'
import { ActionMenu } from '@/components/common/ActionMenu'
import { TextInput } from '@/components/common/Field'
import { DownloadIcon, PencilIcon, RefreshIcon, SelectIcon, TrashIcon } from '@/components/common/Icons'
import { ResponsiveDialog } from '@/components/common/ResponsiveDialog'
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage'
import { downloadBlob, slugify } from '@/lib/download'
import { toGeoJson, toGpx } from '@/lib/exportLocal'
import { formatDistance } from '@/lib/format'
import { readSavedResult, savedRouteKind } from '@/lib/savedRoute'
import type { SavedRoute } from '@/types/api'

export type SavedRouteAction = 'rename' | 'recompute' | 'gpx' | 'geojson' | 'select' | 'delete'

const EXPORTS: SavedRouteAction[] = ['gpx', 'geojson']

type Props = {
  route: SavedRoute
  actions: SavedRouteAction[]
  state: ReturnType<typeof useOverlayState>
  onSelect?: () => void
  onRecompute?: () => void
  onDeleted?: () => void
  className?: string
}

/** The "⋯" menu of one saved route, with the rename and delete dialogs it opens. */
export function SavedRouteMenu({ route, actions, state, onSelect, onRecompute, onDeleted, className }: Props) {
  const { t } = useTranslation()
  const describe = useApiErrorMessage()
  const client = useQueryClient()
  const renameDialog = useOverlayState()
  const deleteDialog = useOverlayState()
  const [name, setName] = useState(route.name)
  const [error, setError] = useState<string | null>(null)
  const result = readSavedResult(route)
  const filename = slugify(route.name)

  const rename = useMutation({
    mutationFn: (next: string) => savedRoutesApi.rename(route.id, next),
    onSuccess: async () => {
      renameDialog.close()
      await Promise.all([
        client.invalidateQueries({ queryKey: ['savedRoute', route.id] }),
        client.invalidateQueries({ queryKey: ['savedRoutes'] }),
      ])
    },
    onError: (cause) => setError(describe(cause)),
  })

  const remove = useMutation({
    mutationFn: () => savedRoutesApi.remove(route.id),
    onSuccess: async () => {
      deleteDialog.close()
      await client.invalidateQueries({ queryKey: ['savedRoutes'] })
      onDeleted?.()
    },
    onError: (cause) => setError(describe(cause)),
  })

  const catalogue: Record<SavedRouteAction, { label: string; icon: ReactNode; danger?: boolean; run: () => void }> = {
    rename: {
      label: t('common.rename'),
      icon: <PencilIcon />,
      run: () => {
        setName(route.name)
        renameDialog.open()
      },
    },
    recompute: { label: t('saved.recompute'), icon: <RefreshIcon />, run: () => onRecompute?.() },
    gpx: {
      label: t('saved.exportGpx'),
      icon: <DownloadIcon />,
      run: () => result && downloadBlob(toGpx(result, route.name), `${filename}.gpx`),
    },
    geojson: {
      label: t('saved.exportGeojson'),
      icon: <DownloadIcon />,
      run: () => result && downloadBlob(toGeoJson(result, route.name), `${filename}.geojson`),
    },
    select: { label: t('saved.select'), icon: <SelectIcon />, run: () => onSelect?.() },
    delete: { label: t('common.delete'), icon: <TrashIcon />, danger: true, run: deleteDialog.open },
  }

  const available = actions.filter((id) => result || !EXPORTS.includes(id))
  const kind = savedRouteKind(route) === 'loop' ? t('saved.kindLoop') : t('saved.kindRoute')

  return (
    <>
      <ActionMenu
        label={t('saved.actions', { name: route.name })}
        title={route.name}
        subtitle={result ? `${kind} · ${formatDistance(result.distance_km)}` : kind}
        actions={available.map((id) => ({ id, ...catalogue[id] }))}
        onAction={(id) => {
          setError(null)
          catalogue[id as SavedRouteAction].run()
        }}
        state={state}
        className={className}
      />

      <ResponsiveDialog state={renameDialog}>
        <ResponsiveDialog.Header>
          <ResponsiveDialog.Heading>{t('saved.renameTitle')}</ResponsiveDialog.Heading>
        </ResponsiveDialog.Header>
        <ResponsiveDialog.Body>
          <TextInput
            label={t('result.saveDialogName')}
            value={name}
            onChange={setName}
            errorMessage={error ?? undefined}
            autoFocus
            isRequired
          />
        </ResponsiveDialog.Body>
        <ResponsiveDialog.Footer>
          <Button variant="ghost" className="min-h-11" onPress={renameDialog.close}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            className="min-h-11"
            isDisabled={!name.trim() || rename.isPending}
            onPress={() => rename.mutate(name.trim())}
          >
            {t('common.save')}
          </Button>
        </ResponsiveDialog.Footer>
      </ResponsiveDialog>

      <ResponsiveDialog state={deleteDialog}>
        <ResponsiveDialog.Header>
          <ResponsiveDialog.Heading>{t('saved.deleteConfirmTitle')}</ResponsiveDialog.Heading>
        </ResponsiveDialog.Header>
        <ResponsiveDialog.Body className="flex flex-col gap-2">
          <p className="text-sm text-muted">{t('saved.deleteConfirmBody')}</p>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </ResponsiveDialog.Body>
        <ResponsiveDialog.Footer>
          <Button variant="ghost" className="min-h-11" onPress={deleteDialog.close}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" className="min-h-11" isDisabled={remove.isPending} onPress={() => remove.mutate()}>
            {t('common.delete')}
          </Button>
        </ResponsiveDialog.Footer>
      </ResponsiveDialog>
    </>
  )
}
