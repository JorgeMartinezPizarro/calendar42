import { FILTERS, TYPE_COLORS } from '../agendaTypes.js'
import './TypeFilter.css'

/**
 * Leyenda con interruptores por categoría.
 * - enabled: { 'event:all': true, 'event:mine': true, ... }
 * - counts:  { event, myEvents, exam, myExams, slot, correction } del mes visible
 * - notes:   { [key]: texto } aviso opcional por categoría (p. ej. sin datos en la API)
 */
function TypeFilter({ enabled, counts = {}, notes = {}, onToggle }) {
  return (
    <fieldset className="typefilter">
      <legend className="typefilter__legend">Mostrar</legend>
      {FILTERS.map(({ key, type, mine, label, countKey }) => (
        <label
          key={key}
          className={`typefilter__item${mine ? ' typefilter__item--mine' : ''}`}
          style={{ '--tf-color': TYPE_COLORS[type] }}
          title={notes[key]}
        >
          <input type="checkbox" checked={Boolean(enabled[key])} onChange={() => onToggle(key)} />
          <span className="typefilter__swatch" aria-hidden="true">
            {mine && '✓'}
          </span>
          <span className="typefilter__label">
            {label}
            {notes[key] && <span className="typefilter__note" aria-hidden="true"> ?</span>}
          </span>
          <span className="typefilter__count">{counts[countKey] ?? 0}</span>
        </label>
      ))}
    </fieldset>
  )
}

export default TypeFilter
