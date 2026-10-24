import type { Coverage, CoverageRequestBody, CoverageRequestResult } from '@/types/api'
import { request } from './client'

export function getCoverage(): Promise<Coverage> {
  return request<Coverage>('/coverage')
}

export function requestCoverage(body: CoverageRequestBody, signedIn: boolean): Promise<CoverageRequestResult> {
  return request<CoverageRequestResult>('/coverage/requests', { method: 'POST', body, auth: signedIn })
}
