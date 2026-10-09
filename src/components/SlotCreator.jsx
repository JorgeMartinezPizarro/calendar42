import { MIN_SLOT_MINUTES, slotCreateState } from '../subscription.js'
import { formatRange, formatTime } from '../utils/date.js'
import './SlotCreator.css'

/**
 * Modo "Crear slots": instrucciones, la franja marcada en las horas del día
 * (pending: { beginAt, endAt } o null), su ajuste fino y el botón para crearla.
 * - onAdjust(edge, minutos): mueve el inicio ('start') o el fin ('end')
 * - action: { busy, error, created } del último envío; el error se pinta en
 *   rojo junto al botón, y lo que no procede (motivo) en naranja.
 */
function SlotCreator({ pending, action, now, onCreate, onCancel, onAdjust }) {
  const state = pending ? slotCreateState(pending, now) : null

  const stepper = (edge, label, time) => (
    <span className="slotcreator__step">
      <span className="slotcreator__step-label">{label}</span>
      <button
        type="button"
        onClick={() => onAdjust(edge, -15)}
        disabled={action.busy}
        aria-label={`${label} 15 minutos antes`}
      >
        −15
      </button>
      <span className="slotcreator__step-time">{formatTime(time)}</span>
      <button
        type="button"
        onClick={() => onAdjust(edge, 15)}
        disabled={action.busy}
        aria-label={`${label} 15 minutos después`}
      >
        +15
      </button>
    </span>
  )

  return (
    <section className="slotcreator" aria-label="Crear slot de corrección">
      <h2 className="slotcreator__title">Crear slot</h2>

      {!pending && (
        <p className="slotcreator__hint">
          Elige un día y marca cuándo puedes corregir: arrastrando sobre las horas con el ratón o
          tocando una hora con el dedo. Luego ajusta la franja con los tiradores o con los botones
          de 15 minutos. Los slots van en bloques de 15 minutos y duran al menos {MIN_SLOT_MINUTES}.
        </p>
      )}

      {pending ? (
        <div className="slotcreator__pending">
          <p className="slotcreator__range">Nuevo slot · {formatRange(pending.beginAt, pending.endAt)}</p>
          {onAdjust && (
            <div className="slotcreator__steps">
              {stepper('start', 'Inicio', pending.beginAt)}
              {stepper('end', 'Fin', pending.endAt)}
            </div>
          )}
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
