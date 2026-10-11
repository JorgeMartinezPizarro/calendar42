import { TYPE_COLORS } from '../agendaTypes.ts'
import './ModeBar.css'

export type Mode = 'events' | 'corrections' | 'exams' | 'slots'

/** Aviso junto al botón de un modo. */
export interface ModeNote {
  /** 'reason': lo que la API no permite (naranja); 'error': fallo de la intra (rojo). */
  kind: 'reason' | 'error'
  text: string
}

export type ModeNotes = Partial<Record<Mode, ModeNote>>

// Cada modo lleva el color de su categoría en la agenda.
const MODES: { key: Mode; label: string; color: string }[] = [
  { key: 'events', label: 'Eventos', color: TYPE_COLORS.event },
  { key: 'corrections', label: 'Correcciones', color: TYPE_COLORS.correction },
  { key: 'exams', label: 'Exámenes', color: TYPE_COLORS.exam },
  { key: 'slots', label: 'Crear slots', color: TYPE_COLORS.slot },
]

interface ModeBarProps {
  mode: Mode
  onChange: (mode: Mode) => void
  notes?: ModeNotes
}

/** Los cuatro modos bajo el calendario, cada uno con su aviso si lo tiene. */
function ModeBar({ mode, onChange, notes = {} }: ModeBarProps) {
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
