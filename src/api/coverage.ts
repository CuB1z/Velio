import type { Coverage } from '@/types/api'
import { request } from './client'

export function getCoverage(): Promise<Coverage> {
  return request<Coverage>('/coverage')
}
