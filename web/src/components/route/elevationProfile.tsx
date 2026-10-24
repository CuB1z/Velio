import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useElementSize } from '@/hooks/useElementSize'
import { useTheme } from '@/hooks/useTheme'
import { categorical, ink } from '@/lib/chartPalette'
import { formatDistance, formatElevation, formatPercent } from '@/lib/format'
import type { ElevationPoint } from '@/types/api'

const PAD = { top: 10, right: 10, bottom: 20, left: 46 }

/** A 70 km profile has ~7000 points; drawing them all adds nothing visible. */
const MAX_POINTS = 600

type Props = {
  profile: ElevationPoint[]
  height?: number
  /** Total distance in km, to label the axis even when sampling trims the profile. */
  distanceKm: number
  onHover?: (point: ElevationPoint | null) => void
}

type Sample = { x: number; y: number; point: ElevationPoint }

function downsample(profile: ElevationPoint[]): ElevationPoint[] {
  if (profile.length <= MAX_POINTS) return profile
  const step = profile.length / MAX_POINTS
  const out: ElevationPoint[] = []
  for (let i = 0; i < MAX_POINTS; i += 1) {
    const from = Math.floor(i * step)
    const to = Math.min(profile.length, Math.floor((i + 1) * step))
    // Keep the highest point of each bucket so downsampling does not drop the climbs.
    let peak = profile[from]
    for (let j = from + 1; j < to; j += 1) {
      if (profile[j].elevation_m > peak.elevation_m) peak = profile[j]
    }
    if (peak) out.push(peak)
  }
  const last = profile[profile.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

/** "Nice" steps for the altitude axis. */
function niceTicks(min: number, max: number, count = 3): number[] {
  const span = Math.max(1, max - min)
  const raw = span / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let value = start; value <= max; value += step) ticks.push(value)
  return ticks
}

export function ElevationProfile({ profile, height = 148, distanceKm, onHover }: Props) {
  const { t } = useTranslation()
  const { resolved } = useTheme()
  const { ref, width } = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<Sample | null>(null)
  const hovered = useRef<Sample | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const color = categorical(resolved, 0)
  const palette = ink(resolved)
  const gradientId = `velio-elev-${resolved}`

  const points = useMemo(() => downsample(profile), [profile])

  const chart = useMemo(() => {
    if (points.length < 2 || width <= 0) return null

    const plotWidth = Math.max(1, width - PAD.left - PAD.right)
    const plotHeight = Math.max(1, height - PAD.top - PAD.bottom)

    const maxDistance = points[points.length - 1].distance_m || 1
    let minElevation = Infinity
    let maxElevation = -Infinity
    for (const point of points) {
      if (point.elevation_m < minElevation) minElevation = point.elevation_m
      if (point.elevation_m > maxElevation) maxElevation = point.elevation_m
    }
    // An 8 % margin keeps the crest off the top edge.
    const span = Math.max(20, maxElevation - minElevation)
    const low = minElevation - span * 0.08
    const high = maxElevation + span * 0.08

    const toX = (metres: number) => PAD.left + (metres / maxDistance) * plotWidth
    const toY = (metres: number) =>
      PAD.top + plotHeight - ((metres - low) / (high - low)) * plotHeight

    const samples: Sample[] = points.map((point) => ({
      x: toX(point.distance_m),
      y: toY(point.elevation_m),
      point,
    }))

    const line = samples
      .map((sample, index) => `${index === 0 ? 'M' : 'L'}${sample.x.toFixed(1)} ${sample.y.toFixed(1)}`)
      .join(' ')
    const baseline = PAD.top + plotHeight
    const area = `${line} L${samples[samples.length - 1].x.toFixed(1)} ${baseline} L${samples[0].x.toFixed(1)} ${baseline} Z`

    return {
      samples,
      line,
      area,
      baseline,
      plotWidth,
      ticks: niceTicks(low, high).map((value) => ({ value, y: toY(value) })),
    }
  }, [points, width, height])

  const handleMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!chart) return
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = event.clientX - rect.left
      // Binary search: scanning 600 points on every pointer move shows on low-end phones.
      let lo = 0
      let hi = chart.samples.length - 1
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (chart.samples[mid].x < x) lo = mid
        else hi = mid
      }
      const nearest =
        Math.abs(chart.samples[lo].x - x) <= Math.abs(chart.samples[hi].x - x)
          ? chart.samples[lo]
          : chart.samples[hi]
      if (nearest === hovered.current) return
      hovered.current = nearest
      setHover(nearest)
      onHover?.(nearest.point)
    },
    [chart, onHover],
  )

  const handleLeave = useCallback(() => {
    hovered.current = null
    setHover(null)
    onHover?.(null)
  }, [onHover])

  const summary = useMemo(() => {
    if (points.length === 0) return ''
    const elevations = points.map((point) => point.elevation_m)
    return `${t('metric.elevationProfile')}: ${formatDistance(distanceKm)}, ${formatElevation(
      Math.min(...elevations),
    )} – ${formatElevation(Math.max(...elevations))}`
  }, [points, distanceKm, t])

  if (profile.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted"
        style={{ height }}
      >
        {t('result.emptyHint')}
      </div>
    )
  }

  // Near the right edge the tooltip flips to the other side of the cursor.
  const tooltipFlips = hover ? hover.x > (width || 0) - 190 : false

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {chart ? (
        <>
          <svg
            ref={svgRef}
            width={width}
            height={height}
            role="img"
            aria-label={summary}
            className="block touch-none"
            onPointerMove={handleMove}
            onPointerLeave={handleLeave}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {chart.ticks.map((tick) => (
              <g key={tick.value}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={tick.y}
                  y2={tick.y}
                  stroke={palette.grid}
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={tick.y + 3}
                  textAnchor="end"
                  className="tnum"
                  fontSize={10}
                  fill={palette.muted}
                >
                  {Math.round(tick.value)}
                </text>
              </g>
            ))}

            <path d={chart.area} fill={`url(#${gradientId})`} />
            <path
              d={chart.line}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={chart.baseline}
              y2={chart.baseline}
              stroke={palette.axis}
              strokeWidth={1}
            />

            <text x={PAD.left} y={height - 6} fontSize={10} fill={palette.muted} className="tnum">
              0
            </text>
            <text
              x={width - PAD.right}
              y={height - 6}
              textAnchor="end"
              fontSize={10}
              fill={palette.muted}
              className="tnum"
            >
              {formatDistance(distanceKm)}
            </text>

            {hover ? (
              <g pointerEvents="none">
                <line
                  x1={hover.x}
                  x2={hover.x}
                  y1={PAD.top}
                  y2={chart.baseline}
                  stroke={palette.muted}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                {/* Surface-colored ring so the dot reads against the line. */}
                <circle cx={hover.x} cy={hover.y} r={5} fill={color} stroke={palette.surface} strokeWidth={2} />
              </g>
            ) : null}
          </svg>

          {hover ? (
            <div
              className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-border bg-overlay px-2.5 py-1.5 text-[11px] tnum"
              style={{
                left: tooltipFlips ? undefined : hover.x + 12,
                right: tooltipFlips ? Math.max(0, (width || 0) - hover.x + 12) : undefined,
                top: Math.max(0, hover.y - 34),
              }}
            >
              {formatDistance(hover.point.distance_m / 1000)}
              <span className="text-muted"> · </span>
              {formatElevation(hover.point.elevation_m)}
              {hover.point.grade_pct !== null ? (
                <>
                  <span className="text-muted"> · </span>
                  <span style={{ color }}>{formatPercent(hover.point.grade_pct)}</span>
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
