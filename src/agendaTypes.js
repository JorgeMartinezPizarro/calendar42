/** Tipos de elemento de la agenda, con etiqueta y color. */
export const AGENDA_TYPES = [
  { type: 'event', label: 'Eventos', color: '#4f8cff' },
  { type: 'exam', label: 'Exámenes', color: '#ff5c5c' },
  { type: 'slot', label: 'Slots abiertos', color: '#20bf6b' },
  { type: 'correction', label: 'Correcciones', color: '#a55eea' },
]

export const TYPE_COLORS = Object.fromEntries(AGENDA_TYPES.map((t) => [t.type, t.color]))

/**
 * Categorías de la leyenda. Eventos y exámenes se desdoblan en "todos" y
 * "míos" (inscrito). Un elemento se muestra si su categoría "todos" está
 * activa, o si está inscrito y la categoría "míos" está activa.
 */
export const FILTERS = [
  { key: 'event:all', type: 'event', mine: false, label: 'Todos los eventos', countKey: 'event' },
  { key: 'event:mine', type: 'event', mine: true, label: 'Mis eventos', countKey: 'myEvents' },
  { key: 'exam:all', type: 'exam', mine: false, label: 'Todos los exámenes', countKey: 'exam' },
  { key: 'exam:mine', type: 'exam', mine: true, label: 'Mis exámenes', countKey: 'myExams' },
  { key: 'slot', type: 'slot', mine: false, label: 'Slots abiertos', countKey: 'slot' },
  { key: 'correction', type: 'correction', mine: false, label: 'Correcciones', countKey: 'correction' },
]

export const DEFAULT_FILTERS = Object.fromEntries(FILTERS.map((f) => [f.key, true]))

export function isItemVisible(item, enabled) {
  if (item.type === 'event' || item.type === 'exam') {
    return Boolean(enabled[`${item.type}:all`] || (item.subscribed && enabled[`${item.type}:mine`]))
  }
  return Boolean(enabled[item.type])
}
