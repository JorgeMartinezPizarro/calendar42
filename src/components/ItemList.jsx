import { itemColor } from '../agendaTypes.js'
import { formatRange } from '../utils/date.js'
import './ItemList.css'

/**
 * Lista de eventos o exámenes pendientes, con nombre y franja horaria. Al
 * pulsar uno se abre su ficha en el sitio de la vista del día.
 * - items: ya filtrados (solo futuros) y ordenados por el padre
 * - openItemId: id del elemento cuya ficha está abierta, para resaltarlo
 */
function ItemList({ title, items, status, emptyText, openItemId = null, onOpenItem }) {
  return (
    <section className="itemlist" aria-label={title}>
      <h2 className="itemlist__title">
        {title}
        <span className="itemlist__count">{items.length}</span>
      </h2>

      {items.length === 0 ? (
        <p className="itemlist__empty">{status === 'loading' ? 'Cargando…' : emptyText}</p>
      ) : (
        <ul className="itemlist__list">
          {items.map((item) => {
            const isOpen = item.id === openItemId
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`itemlist__item itemlist__item--${item.type}${isOpen ? ' itemlist__item--open' : ''}`}
                  style={{ '--il-color': itemColor(item) }}
                  aria-pressed={isOpen}
                  onClick={() => onOpenItem(item)}
                >
                  <span className="itemlist__swatch" aria-hidden="true">
                    {item.subscribed ? '✓' : ''}
                  </span>
                  <span className="itemlist__text">
                    <span className="itemlist__name">{item.name}</span>
                    <span className="itemlist__when">
                      {formatRange(item.beginAt, item.endAt)}
                      {item.subscribed ? ' · inscrito' : ''}
                      {item.external ? ' · externo' : ''}
                    </span>
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

export default ItemList
