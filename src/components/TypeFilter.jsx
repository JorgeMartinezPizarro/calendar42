import { FILTERS, TYPE_COLORS } from '../agendaTypes.js'
import './TypeFilter.css'

/**
 * Leyenda con interruptores por categoría, todas del usuario.
 * - enabled: { event: true, exam: true, slot: true, correction: true }
 * - counts:  { myEvents, myExams, slot, correction } del mes visible
 * - notes:   { [key]: texto } aviso opcional por categoría (p. ej. sin datos en la API)
 */
function TypeFilter({ enabled, counts = {}, notes = {}, onToggle }) {
  return (
    <fieldset className="typefilter">
      <legend className="typefilter__legend">Mostrar</legend>
      {FILTERS.map(({ key, type, label, countKey }) => (
        <label
          key={key}
          className="typefilter__item"
          style={{ '--tf-color': TYPE_COLORS[type] }}
          title={notes[key]}
        >
          <input type="checkbox" checked={Boolean(enabled[key])} onChange={() => onToggle(key)} />
          <span className="typefilter__swatch" aria-hidden="true" />
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
