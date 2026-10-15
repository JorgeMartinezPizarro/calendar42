import type { AgendaItem } from '../../shared/types.ts'
import type { Item, TimeRange } from '../types.ts'
import { t } from '../i18n/index.ts'
import { jsonBody, request, toItem } from './http.ts'

/** Abre un slot de corrección propio. Devuelve los bloques creados, fusionados. */
export async function createSlot({ beginAt, endAt }: TimeRange): Promise<Item[]> {
  const body = await request<{ items?: AgendaItem[] }>('/api/slots', {
    ...jsonBody('POST', { beginAt: beginAt.toISOString(), endAt: endAt.toISOString() }),
    fallback: t.api.createSlot,
  })
  return (body.items ?? []).map(toItem)
}

/** Borra los bloques (ids de la intra) de un slot propio. */
export async function deleteSlots(ids: number[]): Promise<void> {
  await request('/api/slots', { ...jsonBody('DELETE', { ids }), fallback: t.api.deleteSlot })
}

/**
 * Franjas libres de otros estudiantes para corregir un proyecto, con inicio
 * en [from, to): solo las que tienen sitio para la corrección entera, y lo que
 * dura (null si la intra no deja saberlo). Elementos 'free' con fechas como Date.
 */
export async function fetchProjectSlots(
  projectId: number,
  from: Date,
  to: Date,
  { signal, refresh = false }: { signal?: AbortSignal; refresh?: boolean } = {},
): Promise<{ items: Item[]; evaluationMinutes: number | null }> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
  // Refrescar: el servidor vuelve a preguntar a la intra en vez de usar su caché.
  if (refresh) params.set('refresh', '1')
  const body = await request<{ items?: AgendaItem[]; evaluationMinutes?: number | null }>(
    `/api/projects/${projectId}/slots?${params}`,
    { signal, fallback: t.api.freeSlots },
  )
  return { items: (body.items ?? []).map(toItem), evaluationMinutes: body.evaluationMinutes ?? null }
}

export interface Booking {
  projectId: number
  teamId: number
  beginAt: Date
  correctorId?: number | null
}

/** Reserva una corrección del proyecto en ese instante. */
export async function bookCorrection({ projectId, teamId, beginAt, correctorId = null }: Booking): Promise<Item | null> {
  const body = await request<{ item?: AgendaItem | null }>('/api/corrections', {
    ...jsonBody('POST', { projectId, teamId, beginAt: beginAt.toISOString(), correctorId }),
    fallback: t.api.book,
  })
  return body.item ? toItem(body.item) : null
}
