// Cliente HTTP común de la API propia: JSON, errores con su estado y fechas.

import type { AgendaItem } from '../../shared/types.ts'
import { withEventExtras } from '../externalEvents.ts'
import type { Item } from '../types.ts'

/** Error de la API propia, con el estado HTTP (401 = sesión caducada). */
export class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

/** Estado HTTP de un error, si lo tiene (para distinguir 401, 403...). */
export function statusOf(err: unknown): number | null {
  return err instanceof ApiRequestError ? err.status : null
}

/** Mensaje legible de cualquier error capturado. */
export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** true si el error es una petición cancelada (AbortController). */
export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** Cuerpo JSON de una respuesta, o {} si no lo tiene. */
export async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await res.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * Petición a la API propia. Si responde con error, lanza ApiRequestError con
 * el mensaje del servidor (o `fallback`). T es la forma de la respuesta según
 * shared/types.ts.
 */
export async function request<T>(
  url: string,
  { fallback, ...init }: RequestInit & { fallback: string },
): Promise<T> {
  const res = await fetch(url, init)
  const body = await readJson(res)
  if (!res.ok) {
    const message = typeof body.error === 'string' ? body.error : `${fallback} (${res.status})`
    throw new ApiRequestError(message, res.status)
  }
  return body as T
}

/** Opciones de envío de un cuerpo JSON. */
export function jsonBody(method: 'POST' | 'DELETE', body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

/** Elemento de la API con fechas como Date y los extras de los eventos. */
export function toItem(raw: AgendaItem): Item {
  return withEventExtras({ ...raw, beginAt: new Date(raw.beginAt), endAt: new Date(raw.endAt) })
}
