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

/** Circuito cerrado desde un origen, ajustado a distancia y desnivel objetivo. */
export function createLoop(payload: LoopRequest, signal?: AbortSignal): Promise<LoopResult> {
  return request<LoopResult>('/loops', { method: 'POST', body: payload, auth: true, signal })
}

/** Ruta punto a punto por los waypoints en orden (de 2 a 20). */
export function createRoute(payload: RouteRequest, signal?: AbortSignal): Promise<RouteResult> {
  return request<RouteResult>('/routes', { method: 'POST', body: payload, auth: true, signal })
}

/** Puntúa una polilínea existente sin recalcular la ruta. */
export function analyze(payload: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeResult> {
  return request<AnalyzeResult>('/routes/analyze', {
    method: 'POST',
    body: payload,
    auth: true,
    signal,
  })
}

/** Perfil de elevación desde las teselas DEM. No pasa por Valhalla. */
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

/**
 * Los endpoints de export exigen Bearer, así que no vale un <a href>: hay que
 * pedir el blob y provocar la descarga desde el cliente.
 */
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
