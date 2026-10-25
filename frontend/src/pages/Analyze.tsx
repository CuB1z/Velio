import { Button, TextArea } from '@heroui/react'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { analyze, elevation } from '@/api/routing'
import { ErrorState } from '@/components/common/ErrorState'
import { SegmentedControl } from '@/components/common/SegmentedControl'
import { PlannerLayout } from '@/components/layout/PlannerLayout'
import { endpointMarkers } from '@/components/map/endpointMarkers'
import { LazyMap } from '@/components/map/LazyMap'
import type { MapMarker, RouteLayer } from '@/components/map/MapView'
import { SliderField } from '@/components/planner/SliderField'
import { ElevationProfile } from '@/components/route/ElevationProfile'
import { SaveRouteDialog } from '@/components/route/SaveRouteDialog'
import { ScoreCard } from '@/components/route/ScoreCard'
import { SurfaceBar } from '@/components/route/SurfaceBar'
import { useProfileFocus } from '@/hooks/useProfileFocus'
import { cn } from '@/lib/cn'
import { formatBytes, formatDistance, formatPercent, formatRatio, formatSigned } from '@/lib/format'
import { parseGpx } from '@/lib/gpx'
import { mapFitPadding, type MapStyleId } from '@/lib/mapStyles'
import { decodePolyline } from '@/lib/polyline'
import type { AnalyzeResult, ElevationResult } from '@/types/api'

export function AnalyzePage() {
  const { t } = useTranslation()
  const { focusPoint, onProfileHover } = useProfileFocus()
  const [tab, setTab] = useState<'file' | 'polyline'>('file')
  const [encoded, setEncoded] = useState('')
  const [fileInfo, setFileInfo] = useState<{ name: string; points: number; size: number } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [targetKm, setTargetKm] = useState(0)
  const [targetGain, setTargetGain] = useState(0)
  const [styleId, setStyleId] = useState<MapStyleId>('map')
  const [resultCollapsed, setResultCollapsed] = useState(false)
  const [fitKey, setFitKey] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const mutation = useMutation({
    mutationFn: async (): Promise<{ metrics: AnalyzeResult; profile: ElevationResult }> => {
      const [metrics, profile] = await Promise.all([
        analyze({
          polyline: encoded,
          target_km: targetKm > 0 ? targetKm : undefined,
          target_gain_m: targetGain > 0 ? targetGain : undefined,
        }),
        elevation(encoded),
      ])
      return { metrics, profile }
    },
    onSuccess: () => setFitKey((current) => current + 1),
  })

  const coordinates = useMemo(() => decodePolyline(encoded), [encoded])

  const routes: RouteLayer[] = useMemo(
    () =>
      coordinates.length > 1
        ? [{ id: 'analyzed', coordinates, colorIndex: 0, selected: true }]
        : [],
    [coordinates],
  )

  const markers: MapMarker[] = useMemo(() => endpointMarkers(coordinates), [coordinates])

  async function readFile(file: File) {
    setFileError(null)
    const text = await file.text()
    const track = parseGpx(text)
    if (!track) {
      setFileError(t('analyze.dropInvalid'))
      setFileInfo(null)
      return
    }
    setEncoded(track.encoded)
    setFileInfo({ name: track.name ?? file.name, points: track.pointCount, size: file.size })
    setFitKey((current) => current + 1)
  }

  const canSubmit = encoded.trim().length > 0 && coordinates.length > 1
  const result = mutation.data

  return (
    <PlannerLayout
      resultCollapsed={resultCollapsed}
      onResultCollapsedChange={setResultCollapsed}
      form={
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t('analyze.title')}</h1>
            <p className="mt-1.5 text-sm text-muted">{t('analyze.subtitle')}</p>
          </div>

          {/* Same segmented control as bike and elevation. */}
          <div className="flex flex-col gap-4">
            <SegmentedControl
              label={t('analyze.title')}
              value={tab}
              onChange={setTab}
              options={[
                { id: 'file', label: t('analyze.tabFile') },
                { id: 'polyline', label: t('analyze.tabPolyline') },
              ]}
            />

            <div hidden={tab !== 'file'} className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const file = event.dataTransfer.files[0]
                  if (file) void readFile(file)
                }}
                className={cn(
                  'flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors',
                  'hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                )}
              >
                <UploadIcon />
                <span className="text-sm font-semibold pointer-coarse:hidden">{t('analyze.drop')}</span>
                <span className="text-xs text-muted pointer-coarse:hidden">{t('analyze.dropBrowse')}</span>
                <span className="hidden text-sm font-semibold pointer-coarse:inline">{t('analyze.dropTouch')}</span>
                <span className="hidden text-xs text-muted pointer-coarse:inline">{t('analyze.dropTouchHint')}</span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".gpx,application/gpx+xml,application/xml,text/xml"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void readFile(file)
                }}
              />
              {fileInfo ? (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                  <FileIcon />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{fileInfo.name}</p>
                    <p className="tnum text-xs text-muted">
                      {t('analyze.points', { count: fileInfo.points })} ·{' '}
                      {formatBytes(fileInfo.size)}
                    </p>
                  </div>
                </div>
              ) : null}
              {fileError ? (
                <p className="text-sm text-danger" role="alert">
                  {fileError}
                </p>
              ) : null}
            </div>

            <div hidden={tab !== 'polyline'} className="flex flex-col gap-2">
              <TextArea
                value={encoded}
                onChange={(value) => setEncoded(typeof value === 'string' ? value : '')}
                placeholder={t('analyze.polylinePlaceholder')}
                aria-label={t('analyze.polylineLabel')}
                rows={4}
                className="w-full text-xs"
              />
              <p className="text-[11px] text-muted">{t('analyze.polylinePrecision')}</p>
              {encoded.trim().length > 0 && coordinates.length < 2 ? (
                <p className="text-sm text-danger" role="alert">
                  {t('analyze.polylineInvalid')}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <div>
              <span className="text-[13px] text-muted">
                {t('analyze.targets')}
              </span>
              <p className="mt-1 text-xs text-muted">{t('analyze.targetsHint')}</p>
            </div>
            <SliderField
              label={t('planner.distanceTarget')}
              value={targetKm}
              onChange={setTargetKm}
              min={0}
              max={300}
              display={targetKm > 0 ? formatDistance(targetKm) : t('analyze.targetOff')}
            />
            <SliderField
              label={t('planner.gainTarget')}
              value={targetGain}
              onChange={setTargetGain}
              min={0}
              max={3000}
              step={50}
              display={targetGain > 0 ? formatSigned(targetGain) : t('analyze.targetOff')}
            />
          </div>

          <Button
            variant="primary"
            fullWidth
            className="min-h-12"
            isDisabled={!canSubmit || mutation.isPending}
            onPress={() => mutation.mutate()}
          >
            {mutation.isPending ? t('planner.generating') : t('analyze.submit')}
          </Button>

          {mutation.error ? <ErrorState error={mutation.error} /> : null}
        </div>
      }
      map={
        <LazyMap
          className="h-full w-full"
          styleId={styleId}
          onStyleChange={setStyleId}
          routes={routes}
          markers={markers}
          focusPoint={focusPoint}
          fitKey={fitKey}
          // The result panel floats over the map; without this padding the route is fitted behind it.
          fitPadding={mapFitPadding(Boolean(result), resultCollapsed)}
        />
      }
      result={
        result ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Metric label={t('metric.distance')} value={formatDistance(result.metrics.distance_km)} />
              <Metric label={t('metric.gain')} value={formatSigned(result.metrics.gain_m)} />
              <Metric label={t('metric.loss')} value={formatSigned(-Math.abs(result.metrics.loss_m))} />
              <Metric
                label={t('metric.maxUphill')}
                value={formatPercent(result.profile.max_uphill_grade_pct)}
              />
              <Metric
                label={t('metric.maxDownhill')}
                value={formatPercent(result.profile.max_downhill_grade_pct)}
              />
              {result.metrics.overlap_ratio !== null ? (
                <Metric
                  label={t('metric.overlap')}
                  value={formatRatio(result.metrics.overlap_ratio)}
                />
              ) : null}
              <div className="ms-auto">
                <SaveRouteDialog
                  payload={{ ...result.metrics, polyline: encoded } as Record<string, unknown>}
                  defaultName={fileInfo?.name ?? t('analyze.title')}
                />
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <ScoreCard score={result.metrics.cycling_score} />
              <SurfaceBar score={result.metrics.score} distanceKm={result.metrics.distance_km} />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] text-muted">
                {t('metric.elevationProfile')}
              </span>
              <ElevationProfile
                profile={result.profile.profile}
                distanceKm={result.profile.distance_km}
                onHover={onProfileHover}
              />
            </div>
          </div>
        ) : undefined
      }
    />
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[13px] text-muted">{label}</div>
      <div className="tnum mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21V6M10.5 11.5 16 6l5.5 5.5" />
      <path d="M5 21v4.5h22V21" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 2.5h6.5L15.5 6.5V17.5H5V2.5Z" />
      <path d="M11.5 2.5V6.5h4" />
    </svg>
  )
}
