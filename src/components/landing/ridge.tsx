import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/hooks/useTheme'
import { accent } from '@/lib/chartPalette'
import { formatDistance, formatDuration, formatElevation, formatScore, formatSigned } from '@/lib/format'
import type { LandingExample } from '@/pages/landingExamples'

const VIEW = { width: 1000, height: 120, top: 8, bottom: 8 }

/** A real elevation profile drawn full width as a skyline, with its facts in mono. */
export function Ridge({ example }: { example: LandingExample }) {
  const { t, i18n } = useTranslation()
  const { resolved } = useTheme()
  const color = accent(resolved)
  const { profile, result } = example

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

  const origin = profile[0]
  const degrees = (value: number) =>
    Math.abs(value).toLocaleString(i18n.language, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const coordinates = `${degrees(origin.lat)}° ${t(origin.lat >= 0 ? 'landing.north' : 'landing.south')} · ${degrees(origin.lon)}° ${t(origin.lon >= 0 ? 'landing.east' : 'landing.west')}`
  const facts = [
    formatDistance(result.distance_km),
    formatSigned(result.gain_m),
    t(`bike.${example.bike}`),
    formatDuration(result.duration_min),
  ].join(' · ')

  const proof = [
    { value: formatScore(result.cycling_score?.total ?? 0), label: `/ 10 ${t('landing.proofScore')}` },
    { value: formatScore(result.score?.comfort ?? 0, 0), label: `/ 100 ${t('landing.proofSurface')}` },
    { value: '0,62 m', label: t('landing.proofError') },
    { value: '30 m', label: t('landing.proofDem') },
    { value: t('landing.proofFreeValue'), label: t('landing.proofFree') },
  ]

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 px-2 sm:px-6">
        <div className="flex flex-col gap-1">
          <span className="eyebrow text-foreground">{example.place}</span>
          <span className="eyebrow">{facts}</span>
        </div>
        <div className="flex flex-col gap-1 sm:text-right">
          <span className="eyebrow text-foreground">{coordinates}</span>
          <span className="eyebrow">{t('landing.ridgeCaption')}</span>
        </div>
      </div>

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
          className="code absolute -translate-y-1/2 translate-x-4 whitespace-nowrap text-xs"
          style={{ left: `${ridge.peak.left}%`, top: `${ridge.peak.top}%` }}
        >
          {formatElevation(ridge.high)}
        </span>
      </div>

      <figcaption className="flex flex-wrap justify-between gap-x-6 gap-y-3 border-t border-border px-2 py-5 sm:px-6">
        {proof.map((item) => (
          <span key={item.label} className="eyebrow">
            <span className="text-foreground">{item.value}</span> {item.label}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
