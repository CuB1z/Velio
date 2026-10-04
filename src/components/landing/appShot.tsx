import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/cn'

/**
 * Real planner screenshot, one per theme, served as WebP with explicit
 * dimensions to avoid layout shift while it loads.
 */
export function AppShot({ className, priority = false }: { className?: string; priority?: boolean }) {
  const { resolved } = useTheme()
  return (
    <img
      src={`/shots/planner-${resolved}.webp`}
      width={1760}
      height={1147}
      alt=""
      aria-hidden="true"
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('block h-auto w-full', className)}
    />
  )
}
