import { useMemo } from 'react'

import { useTheme } from '@/hooks/useTheme'
import { accent, ink, status } from '@/lib/chartPalette'
import { cn } from '@/lib/cn'
import { boundsOf, decodePolyline } from '@/lib/polyline'

type Props = {
  polyline: string
  kind?: 'loop' | 'route'
  className?: string
  width?: number
  height?: number
}

/** Route silhouette without a map: in a card grid the shape is enough. */
export function RouteThumbnail({ polyline, kind = 'loop', className, width = 320, height = 160 }: Props) {
  const { resolved } = useTheme()
  const palette = ink(resolved)

  const path = useMemo(() => {
    const coordinates = decodePolyline(polyline)
    const bounds = boundsOf(coordinates)
    if (!bounds || coordinates.length < 2) return null

    const [[minLng, minLat], [maxLng, maxLat]] = bounds
    const spanLng = Math.max(maxLng - minLng, 1e-6)
    const spanLat = Math.max(maxLat - minLat, 1e-6)

    // Correct for meridian convergence to keep the real aspect ratio, so a loop
    // is not squashed depending on latitude.
    const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
    const dataWidth = spanLng * cosLat
    const dataHeight = spanLat
    const pad = 20
    const scale = Math.min((width - pad * 2) / dataWidth, (height - pad * 2) / dataHeight)
    const offsetX = (width - dataWidth * scale) / 2
    const offsetY = (height - dataHeight * scale) / 2

    const points = coordinates.map(([lng, lat]) => {
      const x = offsetX + (lng - minLng) * cosLat * scale
      // SVG's Y axis grows downwards; latitude grows upwards.
      const y = height - offsetY - (lat - minLat) * scale
      return `${x.toFixed(1)} ${y.toFixed(1)}`
    })

    return {
      d: `M${points.join(' L')}`,
      start: coordinates[0],
      startPoint: points[0].split(' ').map(Number) as [number, number],
      endPoint: points[points.length - 1].split(' ').map(Number) as [number, number],
    }
  }, [polyline, width, height])

  if (!path) {
    return <div className={cn('bg-surface-secondary', className)} aria-hidden="true" />
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn('block h-full w-full', className)}
      role="img"
      aria-hidden="true"
    >
      <path
        d={path.d}
        fill="none"
        stroke={accent(resolved)}
        strokeOpacity={0.16}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={path.d}
        fill="none"
        stroke={accent(resolved)}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {kind === 'route' ? (
        <circle
          cx={path.endPoint[0]}
          cy={path.endPoint[1]}
          r={4.5}
          fill={accent(resolved)}
          stroke={palette.surface}
          strokeWidth={2}
        />
      ) : null}
      <circle
        cx={path.startPoint[0]}
        cy={path.startPoint[1]}
        r={4.5}
        fill={status(resolved, 'good')}
        stroke={palette.surface}
        strokeWidth={2}
      />
    </svg>
  )
}
