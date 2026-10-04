export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
