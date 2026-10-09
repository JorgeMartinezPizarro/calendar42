import { TYPE_COLORS } from '../agendaTypes.js'
import './ModeBar.css'

// Cada modo lleva el color de su categoría en la agenda.
const MODES = [
  { key: 'corrections', label: 'Correcciones', color: TYPE_COLORS.correction },
  { key: 'exams', label: 'Exámenes', color: TYPE_COLORS.exam },
  { key: 'events', label: 'Eventos', color: TYPE_COLORS.event },
  { key: 'slots', label: 'Crear slots', color: TYPE_COLORS.slot },
]

/**
 * Los cuatro modos bajo el calendario. `notes[key]` = { kind, text } se pinta
 * junto al botón: kind 'reason' (naranja) para lo que la API no permite y
 * 'error' (rojo) para el último fallo de la intra en ese modo.
 */
function ModeBar({ mode, onChange, notes = {} }) {
  return (
    <nav className="modebar" aria-label="Modo">
      {MODES.map((m) => {
        const active = mode === m.key
        const note = notes[m.key]
        return (
          <div key={m.key} className="modebar__item" style={{ '--mb-color': m.color }}>
            <button
              type="button"
              className={`modebar__button${active ? ' modebar__button--active' : ''}`}
              aria-pressed={active}
              onClick={() => onChange(m.key)}
            >
              {m.label}
            </button>
            {note && (
              <span
                className={`modebar__note modebar__note--${note.kind}`}
                role={note.kind === 'error' ? 'alert' : undefined}
              >
                {note.text}
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}

export default ModeBar
