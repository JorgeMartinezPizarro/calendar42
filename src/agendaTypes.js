/** Tipos de elemento de la agenda, con etiqueta y color. */
export const AGENDA_TYPES = [
  { type: 'event', label: 'Eventos', color: '#4f8cff' },
  { type: 'exam', label: 'Exámenes', color: '#ff5c5c' },
  { type: 'slot', label: 'Slots abiertos', color: '#20bf6b' },
  { type: 'correction', label: 'Correcciones', color: '#a55eea' },
]

export const TYPE_COLORS = Object.fromEntries(AGENDA_TYPES.map((t) => [t.type, t.color]))

/**
 * Categorías del filtro "Mostrar". Todas son del usuario: los eventos y
 * exámenes en los que está inscrito, sus slots abiertos y sus correcciones.
 * Los eventos y exámenes sin inscripción no pasan por el filtro: van a la
 * lista "Disponibles" (ver isAvailable).
 */
export const FILTERS = [
  { key: 'event', type: 'event', label: 'Mis eventos', countKey: 'myEvents' },
  { key: 'exam', type: 'exam', label: 'Mis exámenes', countKey: 'myExams' },
  { key: 'slot', type: 'slot', label: 'Mis slots', countKey: 'slot' },
  { key: 'correction', type: 'correction', label: 'Mis correcciones', countKey: 'correction' },
]

export const DEFAULT_FILTERS = Object.fromEntries(FILTERS.map((f) => [f.key, true]))

/** Evento o examen al que el usuario no está inscrito. */
export function isAvailable(item) {
  return (item.type === 'event' || item.type === 'exam') && !item.subscribed
}

/** Algo del usuario: una inscripción suya, un slot suyo o una corrección suya. */
export function isMine(item) {
  return !isAvailable(item)
}

/** Lo que se pinta en el calendario: solo lo del usuario, según el filtro. */
export function isItemVisible(item, enabled) {
  return isMine(item) && Boolean(enabled[item.type])
}

/** Recuento por categoría del filtro a partir de los elementos de un mes. */
export function countByFilter(items) {
  const counts = { myEvents: 0, myExams: 0, slot: 0, correction: 0 }
  for (const it of items) {
    if (it.type === 'event') counts.myEvents += Number(Boolean(it.subscribed))
    else if (it.type === 'exam') counts.myExams += Number(Boolean(it.subscribed))
    else if (it.type in counts) counts[it.type] += 1
  }
  return counts
}
