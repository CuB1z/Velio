/** Icons shared across sections. Single-use icons live in their own file. */

export function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 6.5 8 10.5l4-4" />
    </svg>
  )
}

export function LoopIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <ellipse cx="10" cy="10" rx="7" ry="7.5" />
      <circle cx="10" cy="17.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function RouteIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="4.5" cy="15.5" r="2.2" />
      <circle cx="15.5" cy="4.5" r="2.2" />
      <path d="M6.4 14C9 12.4 8.4 9 11 7.2" />
    </svg>
  )
}

export function AnalyzeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 14.5 6.5 8l3 4 2-3.2 4 5.7" />
      <path d="M2.5 17h15" />
    </svg>
  )
}

export function BookmarkIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 2.8h10v14.4l-5-3.6-5 3.6V2.8Z" />
    </svg>
  )
}
