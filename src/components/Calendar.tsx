import { AGENDA_TYPES } from '../agendaTypes.ts'
import type { ItemType } from '../types.ts'
import { WEEKDAY_LABELS, addMonths, formatMonthYear, getMonthGrid, isSameDay, toDateKey } from '../utils/date.ts'
import './Calendar.css'

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
