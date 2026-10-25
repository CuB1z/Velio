import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/hooks/useTheme'
import { categorical } from '@/lib/chartPalette'
import { formatElevation } from '@/lib/format'
import type { LandingExample } from './landingExamples'

const VIEW = { width: 1000, height: 120, top: 8, bottom: 8 }

/** A real elevation profile drawn full width as a skyline, its peak marked. */
export function Ridge({ example }: { example: LandingExample }) {
  const { t } = useTranslation()
  const { resolved } = useTheme()
  const color = categorical(resolved, 0)
  const { profile } = example

  const ridge = useMemo(() => {
    const maxDistance = profile[profile.length - 1].distance_m || 1
    let low = Infinity
    let high = -Infinity
    let peak = profile[0]
    for (const point of profile) {
      if (point.elevation_m < low) low = point.elevation_m
      if (point.elevation_m > high) {
        high = point.elevation_m
        peak = point
      }
    }
    const span = Math.max(1, high - low)
    const plotHeight = VIEW.height - VIEW.top - VIEW.bottom
    const toX = (metres: number) => (metres / maxDistance) * VIEW.width
    const toY = (metres: number) => VIEW.top + (1 - (metres - low) / span) * plotHeight
    const line = profile
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${toX(point.distance_m).toFixed(1)} ${toY(point.elevation_m).toFixed(1)}`)
      .join('')
    return {
      line,
      area: `${line}L${VIEW.width} ${VIEW.height}L0 ${VIEW.height}Z`,
      low,
      high,
      peak: {
        left: (toX(peak.distance_m) / VIEW.width) * 100,
        top: (toY(peak.elevation_m) / VIEW.height) * 100,
      },
    }
  }, [profile])

  return (
    <figure>
      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
          preserveAspectRatio="none"
          className="block h-[160px] w-full sm:h-[240px]"
          role="img"
          aria-label={`${t('metric.elevationProfile')}: ${formatElevation(ridge.low)} – ${formatElevation(ridge.high)}`}
        >
          <defs>
            <linearGradient id={`velio-ridge-${resolved}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.28" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={ridge.area} fill={`url(#velio-ridge-${resolved})`} />
          <path d={ridge.line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
        <span
          aria-hidden="true"
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[6px] ring-accent-soft"
          style={{ left: `${ridge.peak.left}%`, top: `${ridge.peak.top}%`, background: color }}
        />
        <span
          className="tnum absolute -translate-y-1/2 translate-x-4 whitespace-nowrap text-xs"
          style={{ left: `${ridge.peak.left}%`, top: `${ridge.peak.top}%` }}
        >
          {formatElevation(ridge.high)}
        </span>
      </div>

    </figure>
  )
}
