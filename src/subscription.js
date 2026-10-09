import { isMine } from './agendaTypes.js'

const EXAM_REASON =
  'La API de la intra no deja apuntarse ni borrarse de un examen con la cuenta de un estudiante: hazlo desde la intra.'
const SCOPE_REASON =
  'La sesión no tiene el scope "profile", necesario para apuntarse. Actívalo en la app OAuth de la intra, cierra sesión y vuelve a entrar.'

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
