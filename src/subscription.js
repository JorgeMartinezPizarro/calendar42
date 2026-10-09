import { isMine } from './agendaTypes.js'

const EXAM_REASON =
  'La API de la intra no deja apuntarse ni borrarse de un examen con la cuenta de un estudiante: hazlo desde la intra.'
const SCOPE_REASON =
  'La sesión no tiene el scope "profile", necesario para apuntarse. Actívalo en la app OAuth de la intra, cierra sesión y vuelve a entrar.'

/** Duración mínima de un slot propio: dos bloques de 15 min. */
export const MIN_SLOT_MINUTES = 30

/**
 * Qué puede hacer el usuario con un evento o examen ahora mismo, según lo que
 * sabemos antes de preguntar a la intra (ella tiene la última palabra).
 * Devuelve null si el elemento no es un evento ni un examen; si no:
 * { action: 'subscribe' | 'unsubscribe', enabled, reason }. El botón se pinta
 * siempre; si `enabled` es false, desactivado y con `reason` al lado.
 * - scopeOk: false si el token de la sesión no tiene el scope "profile".
 */
export function subscriptionState(item, now = new Date(), { scopeOk = true } = {}) {
  if (item.type !== 'event' && item.type !== 'exam') return null
  const action = item.subscribed ? 'unsubscribe' : 'subscribe'
  const blocked = (reason) => ({ action, enabled: false, reason })

  if (item.type === 'exam') return blocked(EXAM_REASON)
  if (!scopeOk) return blocked(SCOPE_REASON)
  if (item.endAt <= now) return blocked('El evento ya ha terminado')
  if (item.beginAt <= now) return blocked('El evento ya ha empezado')

  if (item.subscribed) {
    const limit = item.cancellationLimitHours || 0
    if (limit > 0 && item.beginAt - now < limit * 3_600_000) {
      return blocked(`La intra no permite borrarse a menos de ${limit} h del inicio`)
    }
  } else if (item.maxPeople > 0 && item.subscribers >= item.maxPeople) {
    return blocked('Aforo completo')
  }

  return { action, enabled: true, reason: null }
}

/**
 * Reservar una corrección en una franja libre de otro estudiante (type 'free')
 * para el proyecto elegido en "Correcciones" (un projects_user, o null).
 * Devuelve null si el elemento no es una franja libre; si no { enabled, reason }.
 */
export function bookingState(item, project, now = new Date()) {
  if (item.type !== 'free') return null
  const blocked = (reason) => ({ enabled: false, reason })
  if (item.endAt <= now) return blocked('La franja ya ha pasado')
  if (!project) return blocked('Elige un proyecto cerrado en "Correcciones" para agendar su corrección')
  if (!project.closed) return blocked(`${project.name} aún no está cerrado: no se puede agendar su corrección`)
  if (!project.teamId) return blocked('La intra no indica el equipo del proyecto')
  return { enabled: true, reason: null }
}

/** Borrar un slot propio (type 'slot'): solo si aún no ha empezado. */
export function slotDeleteState(item, now = new Date()) {
  if (item.type !== 'slot') return null
  if (item.beginAt <= now) return { enabled: false, reason: 'El slot ya ha empezado' }
  return { enabled: true, reason: null }
}

/** Crear un slot propio en una franja { beginAt, endAt } marcada en las horas. */
export function slotCreateState(range, now = new Date()) {
  const blocked = (reason) => ({ enabled: false, reason })
  if (range.beginAt <= now) return blocked('El slot debe empezar en el futuro')
  if (range.endAt - range.beginAt < MIN_SLOT_MINUTES * 60_000) {
    return blocked(`El slot debe durar al menos ${MIN_SLOT_MINUTES} minutos`)
  }
  return { enabled: true, reason: null }
}

/**
 * Lo del usuario (inscripciones, slots abiertos, correcciones) que se solapa en
 * el tiempo con `item`, por orden de inicio. Vacío significa "slot libre".
 */
export function overlappingItems(item, items) {
  return items
    .filter(
      (other) =>
        other.id !== item.id &&
        isMine(other) &&
        other.beginAt < item.endAt &&
        other.endAt > item.beginAt,
    )
    .sort((a, b) => a.beginAt - b.beginAt)
}
