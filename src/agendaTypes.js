/** Tipos de elemento de la agenda, con etiqueta y color. */
export const AGENDA_TYPES = [
  { type: 'event', label: 'Eventos', color: '#4f8cff' },
  { type: 'exam', label: 'Exámenes', color: '#ff5c5c' },
  { type: 'slot', label: 'Slots abiertos', color: '#20bf6b' },
  { type: 'correction', label: 'Correcciones', color: '#a55eea' },
  // Franjas libres de otros estudiantes para corregir el proyecto elegido.
  { type: 'free', label: 'Slots libres', color: '#0fb9b1' },
]

export const TYPE_COLORS = Object.fromEntries(AGENDA_TYPES.map((t) => [t.type, t.color]))

/**
 * Eventos externos (ver externalEvents.js): un azul más claro que el de los
 * eventos de 42, para que se lean como eventos pero se distingan.
 */
export const EXTERNAL_COLOR = '#8ab4ff'

/** Color con el que se pinta un elemento: el de su tipo, o el de externo. */
export function itemColor(item) {
  if (item.external) return EXTERNAL_COLOR
  return TYPE_COLORS[item.type] ?? TYPE_COLORS.event
}

/**
 * Evento o examen al que el usuario no está inscrito. No va al calendario:
 * va a las listas de los modos "Eventos" y "Exámenes".
 */
export function isAvailable(item) {
  return (item.type === 'event' || item.type === 'exam') && !item.subscribed
}

/**
 * Algo del usuario: una inscripción suya, un slot suyo o una corrección suya.
 * Es lo que se pinta siempre en el calendario y en la vista del día.
 */
export function isMine(item) {
  return item.type !== 'free' && !isAvailable(item)
}
