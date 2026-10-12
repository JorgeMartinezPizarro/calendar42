import { t } from './i18n/index.ts'
import type { Item, ItemType } from './types.ts'

export interface AgendaTypeInfo {
  type: ItemType
  color: string
}

/** Tipos de elemento de la agenda, con su color (la etiqueta, en t.types). */
export const AGENDA_TYPES: AgendaTypeInfo[] = [
  { type: 'event', color: '#4f8cff' },
  { type: 'exam', color: '#ff5c5c' },
  { type: 'slot', color: '#20bf6b' },
  { type: 'correction', color: '#a55eea' },
  // Franjas libres de otros estudiantes para corregir el proyecto elegido.
  { type: 'free', color: '#0fb9b1' },
]

/** Etiqueta en plural de un tipo, en el idioma activo. */
export function typeLabel(type: ItemType): string {
  return t.types[type]
}

export const TYPE_COLORS = Object.fromEntries(AGENDA_TYPES.map((t) => [t.type, t.color])) as Record<
  ItemType,
  string
>

/**
 * Eventos externos (ver externalEvents.ts): un azul más claro que el de los
 * eventos de 42, para que se lean como eventos pero se distingan.
 */
export const EXTERNAL_COLOR = '#8ab4ff'

/** Color con el que se pinta un elemento: el de su tipo, o el de externo. */
export function itemColor(item: Pick<Item, 'type' | 'external'>): string {
  if (item.external) return EXTERNAL_COLOR
  return TYPE_COLORS[item.type] ?? TYPE_COLORS.event
}

/**
 * Evento o examen al que el usuario no está inscrito. No va al calendario:
 * va a las listas de los modos "Eventos" y "Exámenes".
 */
export function isAvailable(item: Pick<Item, 'type' | 'subscribed'>): boolean {
  return (item.type === 'event' || item.type === 'exam') && !item.subscribed
}

/**
 * Algo del usuario: una inscripción suya, un slot suyo o una corrección suya.
 * Es lo que se pinta siempre en el calendario y en la vista del día.
 */
export function isMine(item: Pick<Item, 'type' | 'subscribed'>): boolean {
  return item.type !== 'free' && !isAvailable(item)
}
