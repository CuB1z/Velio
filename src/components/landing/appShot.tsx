import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/cn'

/**
 * Captura real del planificador, no una ilustración: las landings que
 * funcionan enseñan la interfaz del producto. Hay una por tema y se sirve en
 * WebP (≈130 KB) con las dimensiones puestas, para no provocar salto de
 * maquetado mientras carga.
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
