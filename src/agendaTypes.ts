import type { Item, ItemType } from './types.ts'

export interface AgendaTypeInfo {
  type: ItemType
  label: string
  color: string
}

/** Tipos de elemento de la agenda, con etiqueta y color. */
export const AGENDA_TYPES: AgendaTypeInfo[] = [
  { type: 'event', label: 'Eventos', color: '#4f8cff' },
  { type: 'exam', label: 'Exámenes', color: '#ff5c5c' },
  { type: 'slot', label: 'Slots abiertos', color: '#20bf6b' },
  { type: 'correction', label: 'Correcciones', color: '#a55eea' },
  // Franjas libres de otros estudiantes para corregir el proyecto elegido.
  { type: 'free', label: 'Slots libres', color: '#0fb9b1' },
]

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
