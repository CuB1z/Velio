import { ProgressBar } from '@heroui/react'
import { useTranslation } from 'react-i18next'

import type { LoopProgress as Progress } from '@/types/api'

type Props = {
  progress: Progress | null
  found: number
  requested: number
}

export function LoopProgress({ progress, found, requested }: Props) {
  const { t } = useTranslation()
  const attempt = { seed: progress?.seed ?? 1, seeds: progress?.seeds ?? 1 }
  const label =
    found === 0
      ? t('planner.progressSearching', attempt)
      : found < requested
        ? t('planner.progressFound', { ...attempt, found, requested })
        : t('planner.progressFinishing')

  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <ProgressBar
        aria-label={label}
        isIndeterminate={found === 0}
        value={found}
        maxValue={requested}
        size="sm"
      >
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <p className="text-[13px] text-muted">{label}</p>
    </div>
  )
}
