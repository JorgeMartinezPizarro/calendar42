export const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date, delta) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta)
}

/** Clave local 'YYYY-MM-DD', útil para agrupar eventos por día. */
export function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatMonthYear(date) {
  return capitalize(date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }))
}

export function formatLongDate(date) {
  return capitalize(
    date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  )
}

export function formatTime(date) {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

/** "mié, 15 oct" */
export function formatShortDay(date) {
  return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Franja horaria: "mié, 15 oct · 18:00–20:00"; si cruza días, con ambas fechas. */
export function formatRange(begin, end) {
  if (isSameDay(begin, end)) {
    return `${formatShortDay(begin)} · ${formatTime(begin)}–${formatTime(end)}`
  }
  return `${formatShortDay(begin)} ${formatTime(begin)} – ${formatShortDay(end)} ${formatTime(end)}`
}

/**
 * Builds the grid of days for a month view.
 * Weeks start on Monday. Returns a flat array of 42 cells (6 weeks),
 * each with the date and whether it belongs to the displayed month.
 */
export function getMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  // getDay(): 0 = Sunday ... 6 = Saturday. Shift so Monday = 0.
  const offset = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - offset)

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    return { date, inMonth: date.getMonth() === month }
  })
}

/** Rango [start, end) que cubre todas las celdas visibles de la rejilla del mes. */
export function getMonthGridRange(year, month) {
  const cells = getMonthGrid(year, month)
  const start = cells[0].date
  const end = addDays(cells[cells.length - 1].date, 1)
  return { start, end }
}
