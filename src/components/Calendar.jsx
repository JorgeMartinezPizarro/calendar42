import { AGENDA_TYPES } from '../agendaTypes.js'
import {
  WEEKDAY_LABELS,
  addMonths,
  formatMonthYear,
  getMonthGrid,
  isSameDay,
  toDateKey,
} from '../utils/date.js'
import './Calendar.css'

/**
 * Vista mensual.
 * - viewDate: primer día del mes mostrado (lo controla el padre).
 * - dayTypes: Map 'YYYY-MM-DD' -> Set de tipos con algo del usuario ese día.
 *   Se pinta una barra por tipo debajo del número.
 */
function Calendar({ viewDate, onViewDateChange, selectedDate, onSelectDate, dayTypes }) {
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
      </header>

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
          const isSelected = selectedDate && isSameDay(date, selectedDate)
          const types = dayTypes?.get(toDateKey(date))
          const hasItems = Boolean(types && types.size)
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

          const present = hasItems ? AGENDA_TYPES.filter((t) => types.has(t.type)) : []

          return (
            <button
              key={date.toISOString()}
              type="button"
              className={className}
              onClick={() => onSelectDate(date)}
              aria-pressed={Boolean(isSelected)}
              aria-current={isToday ? 'date' : undefined}
              aria-label={
                hasItems
                  ? `${date.getDate()}, ${present.map((t) => t.label.toLowerCase()).join(', ')}`
                  : undefined
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
