/** Icons shared across sections. Single-use icons live in their own file. */

import type { ReactNode } from 'react'

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

function StrokeIcon({ size = 18, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export function MoreIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <circle cx="4.5" cy="10" r="1.6" />
      <circle cx="10" cy="10" r="1.6" />
      <circle cx="15.5" cy="10" r="1.6" />
    </svg>
  )
}

export function PencilIcon({ size }: { size?: number }) {
  return <StrokeIcon size={size}><path d="M12.8 3.6 16.4 7.2 7.2 16.4l-3.8.7.7-3.8 8.7-9.7Z" /></StrokeIcon>
}

export function DownloadIcon({ size }: { size?: number }) {
  return <StrokeIcon size={size}><path d="M10 3.5v9M6 8.8l4 4 4-4M4.5 16.5h11" /></StrokeIcon>
}

export function SelectIcon({ size }: { size?: number }) {
  return <StrokeIcon size={size}><circle cx="10" cy="10" r="7" /><path d="m7.2 10.2 2 2 3.8-4" /></StrokeIcon>
}

export function TrashIcon({ size }: { size?: number }) {
  return <StrokeIcon size={size}><path d="M3.5 5.8h13M8.3 9v5M11.7 9v5M5.2 5.8l.8 10.7h8l.8-10.7M7.6 5.8V3.5h4.8v2.3" /></StrokeIcon>
}

export function RefreshIcon({ size }: { size?: number }) {
  return <StrokeIcon size={size}><path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6M16.5 3.5v4h-4" /></StrokeIcon>
}

export function CloseIcon({ size }: { size?: number }) {
  return <StrokeIcon size={size}><path d="m5 5 10 10M15 5 5 15" /></StrokeIcon>
}

export function PlusIcon({ size }: { size?: number }) {
  return <StrokeIcon size={size}><path d="M10 4v12M4 10h12" /></StrokeIcon>
}
