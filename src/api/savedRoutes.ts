import type { CreateSavedRoute, Paginated, SavedRoute } from '@/types/api'
import { request } from './client'

/** El backend acepta hasta 200 por página; 50 es su valor por defecto. */
export const MAX_PAGE_SIZE = 200

/** El borrado en bloque acepta como mucho 50 ids por llamada. */
export const MAX_BULK_DELETE = 50

export function list(page = 1, limit = 12): Promise<Paginated<SavedRoute>> {
  return request<Paginated<SavedRoute>>('/routes/saved', {
    query: { page, limit: Math.min(limit, MAX_PAGE_SIZE) },
    auth: true,
  })
}

export function get(id: string): Promise<SavedRoute> {
  return request<SavedRoute>(`/routes/saved/${id}`, { auth: true })
}

export function save(payload: CreateSavedRoute): Promise<SavedRoute> {
  return request<SavedRoute>('/routes/saved', { method: 'POST', body: payload, auth: true })
}

export function rename(id: string, name: string): Promise<void> {
  return request<void>(`/routes/saved/${id}`, { method: 'PATCH', body: { name }, auth: true })
}

export function remove(id: string): Promise<void> {
  return request<void>(`/routes/saved/${id}`, { method: 'DELETE', auth: true })
}

/** Idempotente: los ids ajenos o inexistentes se ignoran en silencio. */
export async function removeMany(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += MAX_BULK_DELETE) {
    const chunk = ids.slice(i, i + MAX_BULK_DELETE)
    await request<void>('/routes/saved', {
      method: 'DELETE',
      query: { ids: chunk.join(',') },
      auth: true,
    })
  }
}
