import type { AgendaItem } from '../../shared/types.ts'
import type { Item, TimeRange } from '../types.ts'
import { jsonBody, request, toItem } from './http.ts'

/** Abre un slot de corrección propio. Devuelve los bloques creados, fusionados. */
export async function createSlot({ beginAt, endAt }: TimeRange): Promise<Item[]> {
  const body = await request<{ items?: AgendaItem[] }>('/api/slots', {
    ...jsonBody('POST', { beginAt: beginAt.toISOString(), endAt: endAt.toISOString() }),
    fallback: 'No se pudo crear el slot',
  })
  return (body.items ?? []).map(toItem)
}

/** Borra los bloques (ids de la intra) de un slot propio. */
export async function deleteSlots(ids: number[]): Promise<void> {
  await request('/api/slots', { ...jsonBody('DELETE', { ids }), fallback: 'No se pudo borrar el slot' })
}

/**
 * Franjas libres de otros estudiantes para corregir un proyecto, con inicio
 * en [from, to). Elementos de tipo 'free' con fechas ya convertidas.
 */
export async function fetchProjectSlots(
  projectId: number,
  from: Date,
  to: Date,
  { signal }: { signal?: AbortSignal } = {},
): Promise<Item[]> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
  const body = await request<{ items?: AgendaItem[] }>(`/api/projects/${projectId}/slots?${params}`, {
    signal,
    fallback: 'No se pudieron cargar los slots libres',
  })
  return (body.items ?? []).map(toItem)
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
    fallback: 'No se pudo reservar la corrección',
  })
  return body.item ? toItem(body.item) : null
}
