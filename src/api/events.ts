import type { AgendaItem, SubscriptionResult } from '../../shared/types.ts'
import type { Item } from '../types.ts'
import { request, toItem } from './http.ts'

/**
 * Todos los eventos del campus desde hoy (hasta un año vista), con
 * `subscribed` según las inscripciones del usuario y fechas ya convertidas.
 */
export async function fetchUpcomingEvents({ signal }: { signal?: AbortSignal } = {}): Promise<Item[]> {
  const body = await request<{ items?: AgendaItem[] }>('/api/events/upcoming', {
    signal,
    fallback: 'Error al cargar los eventos',
  })
  return (body.items ?? []).map(toItem)
}

export interface Subscription {
  subscribed: boolean
  /** Inscritos tras la operación; null si el backend no pudo releerlo. */
  subscribers: number | null
}

async function setSubscription(url: string, subscribed: boolean): Promise<Subscription> {
  const body = await request<SubscriptionResult>(url, {
    method: subscribed ? 'POST' : 'DELETE',
    fallback: 'Error',
  })
  return { subscribed: Boolean(body.subscribed), subscribers: body.subscribers ?? null }
}

/**
 * Apunta (subscribed = true) o borra (false) al usuario de un examen. Solo
 * funciona en el modo demo (ver server/index.ts).
 */
export function setExamSubscription(examId: number, subscribed: boolean): Promise<Subscription> {
  return setSubscription(`/api/exams/${examId}/subscription`, subscribed)
}

/** Apunta (subscribed = true) o borra (false) al usuario de un evento. */
export function setEventSubscription(eventId: number, subscribed: boolean): Promise<Subscription> {
  return setSubscription(`/api/events/${eventId}/subscription`, subscribed)
}
