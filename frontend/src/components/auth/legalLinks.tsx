import type { SyntheticEvent } from 'react'

import { useLangPath } from '@/lib/paths'

const link = 'font-medium text-foreground underline decoration-muted underline-offset-4 hover:decoration-foreground'
const stop = (event: SyntheticEvent) => event.stopPropagation()
const skipCheckbox = { onPointerDown: stop, onClick: stop, onKeyDown: stop }

export function useLegalLinks() {
  const to = useLangPath()
  return {
    terms: <a href={to('/terms')} target="_blank" rel="noreferrer" className={link} {...skipCheckbox} />,
    privacy: <a href={to('/privacy')} target="_blank" rel="noreferrer" className={link} {...skipCheckbox} />,
  }
}
