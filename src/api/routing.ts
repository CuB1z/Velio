import type {
  AnalyzeRequest,
  AnalyzeResult,
  ElevationResult,
  ExportFormat,
  LoopRequest,
  LoopResult,
  RouteRequest,
  RouteResult,
} from '@/types/api'
import { request } from './client'

/** Closed loop from an origin, fitted to the target distance and elevation gain. */
export function createLoop(payload: LoopRequest, signal?: AbortSignal): Promise<LoopResult> {
  return request<LoopResult>('/loops', { method: 'POST', body: payload, auth: true, signal })
}

/** Point-to-point route through the waypoints in order (2 to 20). */
export function createRoute(payload: RouteRequest, signal?: AbortSignal): Promise<RouteResult> {
  return request<RouteResult>('/routes', { method: 'POST', body: payload, auth: true, signal })
}

/** Scores an existing polyline without re-routing. */
export function analyze(payload: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeResult> {
  return request<AnalyzeResult>('/routes/analyze', {
    method: 'POST',
    body: payload,
    auth: true,
    signal,
  })
}

/** Elevation profile from the DEM tiles, bypassing Valhalla. */
export function elevation(polyline: string, signal?: AbortSignal): Promise<ElevationResult> {
  return request<ElevationResult>('/routes/elevation', {
    method: 'POST',
    body: { polyline },
    auth: true,
    signal,
  })
}

const MIME: Record<Exclude<ExportFormat, 'json'>, string> = {
  gpx: 'application/gpx+xml',
  geojson: 'application/geo+json',
}

/** Export endpoints require a Bearer token, so fetch the blob and trigger the download client-side. */
export async function exportRouting(
  endpoint: 'loops' | 'routes',
  payload: LoopRequest | RouteRequest,
  format: Exclude<ExportFormat, 'json'>,
): Promise<{ blob: Blob; mime: string }> {
  const blob = await request<Blob>(`/${endpoint}`, {
    method: 'POST',
    body: payload,
    query: { format },
    auth: true,
    blob: true,
  })
  return { blob, mime: MIME[format] }
}
