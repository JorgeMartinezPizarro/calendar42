// Tipos internos del servidor (no salen en la API). Los de la API, en
// shared/types.ts.

import type { SessionUser } from '../shared/types.ts'
import type { DemoState } from './mock.ts'

/** Tokens OAuth de la intra de una sesión real. */
export interface Tokens {
  accessToken: string
  refreshToken: string | null
  /** Instante (ms) en que caduca el access token. */
  expiresAt: number
  scope: string
}

/** Sesión guardada en el almacén (ver sessions.ts). */
export interface Session {
  user: SessionUser
  /** null en el modo demo. */
  tokens: Tokens | null
  demo: boolean
  /** Lo que el visitante cambia en el demo (solo en sesiones demo). */
  demoState?: DemoState
  expiresAt: number
}

/**
 * Error con los datos de la respuesta de la intra (o de la API propia) que
 * hacen falta para decidir qué responder.
 */
export interface HttpError extends Error {
  status?: number
  /** Ruta de la intra que falló. */
  path?: string
  /** Motivo que da la intra en el cuerpo de la respuesta. */
  reason?: string
  /** Cuerpo crudo de la respuesta (recortado), para el log. */
  body?: string
  /** Fallo pasajero (intra caída, 429...): se puede reintentar. */
  transient?: boolean
}

/** Crea un HttpError con los datos que se pasen. */
export function httpError(message: string, props: Omit<HttpError, 'name' | 'message'> = {}): HttpError {
  return Object.assign(new Error(message), props)
}

/** Lo que sea que se capture en un catch, como HttpError. */
export function asHttpError(err: unknown): HttpError {
  return err instanceof Error ? (err as HttpError) : new Error(String(err))
}
