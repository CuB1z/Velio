import { Dropdown } from '@heroui/react'

import { dropdownTriggerClass } from '@/components/common/dropdownTrigger'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { exportRouting } from '@/api/routing'
import { downloadBlob, slugify } from '@/lib/download'
import type { LoopRequest, RouteRequest } from '@/types/api'
import { useApiErrorMessage } from '../common/apiErrorMessage'

type Props = {
  endpoint: 'loops' | 'routes'
  /** Export recomputes the route: resend the same request that produced the result. */
  request: LoopRequest | RouteRequest
  name: string
  isDisabled?: boolean
  onError?: (message: string) => void
}

export function ExportMenu({ endpoint, request, name, isDisabled, onError }: Props) {
  const { t } = useTranslation()
  const describe = useApiErrorMessage()
  const [busy, setBusy] = useState(false)

  async function run(format: 'gpx' | 'geojson') {
    setBusy(true)
    try {
      const { blob } = await exportRouting(endpoint, request, format)
      downloadBlob(blob, `${slugify(name)}.${format}`)
    } catch (error) {
      onError?.(describe(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dropdown>
      <Dropdown.Trigger
        isDisabled={isDisabled || busy}
        className={dropdownTriggerClass({ variant: 'secondary' }, 'min-h-11 gap-2')}
      >
        <DownloadIcon />
        {busy ? t('result.exporting') : t('result.export')}
      </Dropdown.Trigger>
      <Dropdown.Popover>
        <Dropdown.Menu
          onAction={(key) => {
            if (key === 'gpx' || key === 'geojson') void run(key)
          }}
        >
          <Dropdown.Item id="gpx">{t('result.exportGpx')}</Dropdown.Item>
          <Dropdown.Item id="geojson">{t('result.exportGeojson')}</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2.4v8.2M4.9 7.5 8 10.6l3.1-3.1M3 13.4h10" />
    </svg>
  )
}
