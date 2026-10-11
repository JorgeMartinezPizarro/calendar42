// Tipos del frontend. Los de la API vienen de shared/types.ts; aquí, su forma
// una vez en el navegador (fechas como Date) y lo que añade el frontend.

import type { AgendaItem } from '../shared/types.ts'

export type {
  AgendaCounts,
  AgendaWarning,
  Coalition,
  ItemType,
  Project,
  SessionUser,
} from '../shared/types.ts'

/** Lo que el frontend calcula sobre un evento (ver externalEvents.ts). */
export interface EventExtras {
  /** La intra lo marca como externo: su botón de inscribirse no funciona. */
  externalKind?: boolean
  /** Enlace de inscripción encontrado en la descripción, o null. */
  signupUrl?: string | null
  /** Se pinta y etiqueta como externo. */
  external?: boolean
}

/** Elemento de la agenda en el navegador: fechas como Date. */
export type Item = AgendaItem<Date> & EventExtras

/** Franja de tiempo [beginAt, endAt). */
export interface TimeRange {
  beginAt: Date
  endAt: Date
}

/** Estado de una carga: lista de elementos, si está cargando y su error. */
export interface Loadable<T> {
  status: 'idle' | 'loading' | 'error'
  items: T[]
  error: string | null
}

/** Envío en curso a la intra para un elemento (apuntarse, reservar...). */
export interface ActionState {
  busy: boolean
  error: string | null
}
