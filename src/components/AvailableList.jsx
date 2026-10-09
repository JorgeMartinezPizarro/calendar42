import { TYPE_COLORS } from '../agendaTypes.js'
import { formatRange } from '../utils/date.js'
import './AvailableList.css'

/**
 * Eventos y exámenes del mes visible a los que el usuario no está inscrito y
 * que aún no han terminado. No pasan por el filtro "Mostrar": siempre se ven.
 * Cada línea lleva el nombre y la franja horaria; al pulsarla se abre la ficha
 * completa del elemento en la vista del día.
 * - openItemId: id del elemento cuya ficha está abierta, para resaltarlo.
 */
function AvailableList({ items, status, openItemId = null, onOpenItem }) {
  return (
    <section className="available" aria-label="Eventos y exámenes disponibles">
      <h2 className="available__title">
        Disponibles
        <span className="available__count">{items.length}</span>
      </h2>

      {items.length === 0 ? (
        <p className="available__empty">
          {status === 'loading' ? 'Cargando…' : 'Nada disponible este mes'}
        </p>
      ) : (
        <ul className="available__list">
          {items.map((item) => {
            const isOpen = item.id === openItemId
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`available__item available__item--${item.type}${isOpen ? ' available__item--open' : ''}`}
                  style={{ '--av-color': TYPE_COLORS[item.type] }}
                  aria-pressed={isOpen}
                  onClick={() => onOpenItem(item)}
                >
                  <span className="available__swatch" aria-hidden="true" />
                  <span className="available__text">
                    <span className="available__name">{item.name}</span>
                    <span className="available__when">{formatRange(item.beginAt, item.endAt)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default AvailableList
