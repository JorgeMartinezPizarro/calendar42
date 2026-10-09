import { MIN_SLOT_MINUTES, slotCreateState } from '../subscription.js'
import { formatRange } from '../utils/date.js'
import './SlotCreator.css'

/**
 * Modo "Crear slots": instrucciones, la franja marcada arrastrando sobre las
 * horas del día (pending: { beginAt, endAt } o null) y el botón para crearla.
 * - action: { busy, error, created } del último envío; el error se pinta en
 *   rojo junto al botón, y lo que no procede (motivo) en naranja.
 */
function SlotCreator({ pending, action, now, onCreate, onCancel }) {
  const state = pending ? slotCreateState(pending, now) : null

  return (
    <section className="slotcreator" aria-label="Crear slot de corrección">
      <h2 className="slotcreator__title">Crear slot</h2>
      <p className="slotcreator__hint">
        Arrastra sobre las horas del día para marcar cuándo puedes corregir. Los slots van en
        bloques de 15 minutos y duran al menos {MIN_SLOT_MINUTES}.
      </p>

      {pending ? (
        <div className="slotcreator__pending">
          <p className="slotcreator__range">Nuevo slot · {formatRange(pending.beginAt, pending.endAt)}</p>
          <div className="slotcreator__actions">
            <button
              type="button"
              className="slotcreator__button"
              disabled={!state.enabled || action.busy}
              onClick={onCreate}
            >
              {action.busy ? 'Creando…' : 'Crear slot'}
            </button>
            <button
              type="button"
              className="slotcreator__button slotcreator__button--secondary"
              disabled={action.busy}
              onClick={onCancel}
            >
              Cancelar
            </button>
            {state.reason && !action.error && (
              <span className="slotcreator__reason">{state.reason}</span>
            )}
            {action.error && (
              <span className="slotcreator__error" role="alert">
                {action.error}
              </span>
            )}
          </div>
        </div>
      ) : action.created ? (
        <p className="slotcreator__ok">
          Slot creado: {formatRange(action.created.beginAt, action.created.endAt)}. Puedes borrarlo
          desde su ficha.
        </p>
      ) : null}
    </section>
  )
}

export default SlotCreator
