import { AGENDA_TYPES } from '../agendaTypes.ts'
import type { ItemType } from '../types.ts'
import { WEEKDAY_LABELS, addMonths, formatMonthYear, getMonthGrid, isSameDay, toDateKey } from '../utils/date.ts'
import './Calendar.css'

/** Repositorio del proyecto: el enlace de la cabecera del calendario. */
const SOURCE_URL = 'https://github.com/JorgeMartinezPizarro/calendar42'

// Logo de GitHub (octicon mark-github, 16×16).
const GITHUB_PATH =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z'

/** De dónde viene la elección de un día: 'today' = botón "Hoy". */
export type SelectSource = 'today' | undefined

/** Resultado de la última exportación, bajo la cabecera. */
export interface ExportNote {
  kind: 'ok' | 'reason' | 'error'
  text: string
}

interface CalendarProps {
  /** Primer día del mes mostrado (lo controla el padre). */
  viewDate: Date
  onViewDateChange: (date: Date) => void
  selectedDate: Date | null
  onSelectDate: (date: Date, source?: SelectSource) => void
  /**
   * 'YYYY-MM-DD' -> tipos con algo del usuario ese día. Se pinta una barra por
   * tipo debajo del número.
   */
  dayTypes: Map<string, Set<ItemType>>
  /** Botón "Exportar": descarga la agenda del usuario en .ics. */
  onExport?: () => void
  exporting?: boolean
  exportNote?: ExportNote | null
}

/** Vista mensual. */
function Calendar({
  viewDate,
  onViewDateChange,
  selectedDate,
  onSelectDate,
  dayTypes,
  onExport,
  exporting = false,
  exportNote = null,
}: CalendarProps) {
  const today = new Date()
  const cells = getMonthGrid(viewDate.getFullYear(), viewDate.getMonth())

  const goToPrev = () => onViewDateChange(addMonths(viewDate, -1))
  const goToNext = () => onViewDateChange(addMonths(viewDate, 1))
  const goToToday = () => {
    onViewDateChange(new Date(today.getFullYear(), today.getMonth(), 1))
    onSelectDate(today, 'today')
  }

  return (
    <section className="calendar" aria-label="Calendario mensual">
      <header className="calendar__header">
        <button type="button" onClick={goToPrev} aria-label="Mes anterior">
          ‹
        </button>
        <h2 className="calendar__title">{formatMonthYear(viewDate)}</h2>
        <button type="button" onClick={goToNext} aria-label="Mes siguiente">
          ›
        </button>
        <button type="button" className="calendar__today" onClick={goToToday}>
          Hoy
        </button>
        {onExport && (
          <button
            type="button"
            className="calendar__export"
            onClick={onExport}
            disabled={exporting}
            title="Descarga tu agenda en .ics para importarla en Google Calendar, Outlook o Apple Calendar"
            aria-label="Exportar la agenda en formato iCalendar (.ics)"
          >
            <span aria-hidden="true">⤓</span>
            <span className="calendar__export-label">{exporting ? 'Exportando…' : 'Exportar'}</span>
          </button>
        )}
        <a
          className="calendar__source"
          href={SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Código fuente en GitHub"
          aria-label="Código fuente en GitHub"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d={GITHUB_PATH} />
          </svg>
        </a>
      </header>

      {exportNote && (
        <p
          className={`calendar__note calendar__note--${exportNote.kind}`}
          role={exportNote.kind === 'error' ? 'alert' : 'status'}
        >
          {exportNote.text}
        </p>
      )}

      <div className="calendar__weekdays" role="row">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="calendar__weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="calendar__grid">
        {cells.map(({ date, inMonth }) => {
          const isToday = isSameDay(date, today)
          const isSelected = Boolean(selectedDate && isSameDay(date, selectedDate))
          const types = dayTypes.get(toDateKey(date))
          const present = types ? AGENDA_TYPES.filter((t) => types.has(t.type)) : []
          const hasItems = present.length > 0
          const className = [
            'calendar__day',
            !inMonth && 'calendar__day--outside',
            // Días ya pasados: atenuados como los de otros meses, su información ya no cuenta.
            inMonth && !isToday && date < today && 'calendar__day--past',
            isToday && 'calendar__day--today',
            isSelected && 'calendar__day--selected',
            hasItems && 'calendar__day--has-items',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={date.toISOString()}
              type="button"
              className={className}
              onClick={() => onSelectDate(date)}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={
                hasItems ? `${date.getDate()}, ${present.map((t) => t.label.toLowerCase()).join(', ')}` : undefined
              }
            >
              <span className="calendar__day-number">{date.getDate()}</span>
              {hasItems && (
                <span className="calendar__marks" aria-hidden="true">
                  {present.map((t) => (
                    <span key={t.type} className="calendar__mark" style={{ background: t.color }} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default Calendar
