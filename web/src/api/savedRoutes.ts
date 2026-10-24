import type { CreateSavedRoute, Paginated, SavedRoute } from '@/types/api'
import { request } from './client'

/** The backend accepts up to 200 per page; 50 is its default. */
export const MAX_PAGE_SIZE = 200

/** Bulk delete accepts at most 50 ids per call. */
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

/** Idempotent: foreign or unknown ids are silently ignored. */
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
