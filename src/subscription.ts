// Reglas de los botones de acción: qué se puede hacer con un elemento ahora
// mismo y, si no, por qué. Las usa la ficha (ItemPopover) y Crear slots.

import { isMine } from './agendaTypes.ts'
import type { Item, Project, TimeRange } from './types.ts'
import { formatTime } from './utils/date.ts'

const EXAM_REASON =
  'Inscripción a exámenes desactivada: el rol de estudiante no alcanza, se requieren permisos del staff.'
const SCOPE_REASON =
  'La sesión no tiene el scope "profile", necesario para apuntarse. Actívalo en la app OAuth de la intra, cierra sesión y vuelve a entrar.'

/** Duración mínima de un slot propio: dos bloques de 15 min. */
export const MIN_SLOT_MINUTES = 30

/**
 * Duración con la que se comprueba si una corrección que se va a agendar choca
 * con la agenda. La de cada proyecto la fija su escala en la intra; media hora
 * es la habitual.
 */
export const CORRECTION_MINUTES = 30

/** Estado de un botón: activo, o desactivado con su motivo. */
export interface ButtonState {
  enabled: boolean
  reason: string | null
}

export interface SubscriptionState extends ButtonState {
  action: 'subscribe' | 'unsubscribe'
}

export interface BookingState extends ButtonState {
  /** El motivo es que choca con la agenda (para marcar la hora como "choca"). */
  overlap: boolean
}

/** "Se solapa con X (10:00–11:00)" con lo primero que choca, y cuántos más. */
function overlapReason(conflicts: Item[]): string {
  const [first, ...rest] = conflicts
  const what = `${first.name} (${formatTime(first.beginAt)}–${formatTime(first.endAt)})`
  return `Se solapa con ${what}${rest.length ? ` y ${rest.length} más` : ''}`
}

export interface SubscriptionOptions {
  /** false si el token de la sesión no tiene el scope "profile". */
  scopeOk?: boolean
  /**
   * En el modo demo los exámenes sí admiten inscripción, para enseñar cómo
   * sería cuando el staff autorice la aplicación.
   */
  demo?: boolean
  /**
   * Lo del usuario que se solapa con el elemento (overlappingItems). Apuntarse
   * a algo que choca no se permite; borrarse, sí.
   */
  conflicts?: Item[]
}

/**
 * Qué puede hacer el usuario con un evento o examen ahora mismo, según lo que
 * sabemos antes de preguntar a la intra (ella tiene la última palabra). null si
 * el elemento no es un evento ni un examen. El botón se pinta siempre; si no
 * está activo, desactivado y con el motivo al lado.
 */
export function subscriptionState(
  item: Item,
  now: Date = new Date(),
  { scopeOk = true, demo = false, conflicts = [] }: SubscriptionOptions = {},
): SubscriptionState | null {
  if (item.type !== 'event' && item.type !== 'exam') return null
  const action = item.subscribed ? 'unsubscribe' : 'subscribe'
  const blocked = (reason: string): SubscriptionState => ({ action, enabled: false, reason })

  const noun = item.type === 'exam' ? 'El examen' : 'El evento'

  if (item.type === 'exam' && !demo) return blocked(EXAM_REASON)
  if (item.externalKind) {
    return blocked(
      item.signupUrl
        ? 'Evento externo: la inscripción se hace en su web, no en la intra'
        : 'Evento externo: la intra no gestiona su inscripción; busca el enlace en la descripción',
    )
  }
  if (!scopeOk && item.type === 'event') return blocked(SCOPE_REASON)
  if (item.endAt <= now) return blocked(`${noun} ya ha terminado`)
  if (item.beginAt <= now) return blocked(`${noun} ya ha empezado`)

  if (item.subscribed) {
    const limit = item.cancellationLimitHours || 0
    if (limit > 0 && item.beginAt.getTime() - now.getTime() < limit * 3_600_000) {
      return blocked(`La intra no permite borrarse a menos de ${limit} h del inicio`)
    }
  } else if (conflicts.length) {
    // El detalle de con qué choca ya va en la ficha, bajo los botones.
    return blocked('No puedes apuntarte: se solapa con tu agenda')
  } else if (item.maxPeople && item.maxPeople > 0 && (item.subscribers ?? 0) >= item.maxPeople) {
    return blocked('Aforo completo')
  }

  return { action, enabled: true, reason: null }
}

/**
 * Reservar una corrección en una franja libre de otro estudiante (type 'free')
 * para el proyecto elegido en "Correcciones" (o null), empezando a `startAt`.
 * null si el elemento no es una franja libre.
 * - items: la agenda; la corrección (CORRECTION_MINUTES desde startAt) no
 *   puede pisar nada del usuario.
 */
export function bookingState(
  item: Item,
  project: Project | null,
  now: Date = new Date(),
  { startAt = item.beginAt, items = [] }: { startAt?: Date; items?: Item[] } = {},
): BookingState | null {
  if (item.type !== 'free') return null
  const blocked = (reason: string, overlap = false): BookingState => ({ enabled: false, reason, overlap })
  if (item.endAt <= now) return blocked('La franja ya ha pasado')
  if (!project) return blocked('Elige un proyecto cerrado en "Correcciones" para agendar su corrección')
  if (!project.closed) return blocked(`${project.name} aún no está cerrado: no se puede agendar su corrección`)
  if (!project.teamId) return blocked('La intra no indica el equipo del proyecto')
  if (startAt <= now) return blocked('Esa hora ya ha pasado')
  const range = {
    id: item.id,
    beginAt: startAt,
    endAt: new Date(startAt.getTime() + CORRECTION_MINUTES * 60_000),
  }
  const conflicts = overlappingItems(range, items)
  if (conflicts.length) return blocked(overlapReason(conflicts), true)
  return { enabled: true, reason: null, overlap: false }
}

/** Borrar un slot propio (type 'slot'): solo si aún no ha empezado. */
export function slotDeleteState(item: Item, now: Date = new Date()): ButtonState | null {
  if (item.type !== 'slot') return null
  if (item.beginAt <= now) return { enabled: false, reason: 'El slot ya ha empezado' }
  return { enabled: true, reason: null }
}

/**
 * Crear un slot propio en una franja marcada en las horas.
 * - items: la agenda; el slot no puede pisar otro slot propio, una corrección
 *   ni nada a lo que el usuario esté apuntado.
 */
export function slotCreateState(range: TimeRange, now: Date = new Date(), items: Item[] = []): ButtonState {
  const blocked = (reason: string): ButtonState => ({ enabled: false, reason })
  if (range.beginAt <= now) return blocked('El slot debe empezar en el futuro')
  if (range.endAt.getTime() - range.beginAt.getTime() < MIN_SLOT_MINUTES * 60_000) {
    return blocked(`El slot debe durar al menos ${MIN_SLOT_MINUTES} minutos`)
  }
  const conflicts = overlappingItems({ id: 'nuevo-slot', ...range }, items)
  if (conflicts.length) return blocked(overlapReason(conflicts))
  return { enabled: true, reason: null }
}

/**
 * Lo del usuario (inscripciones, slots abiertos, correcciones) que se solapa en
 * el tiempo con `item`, por orden de inicio. Vacío significa "slot libre".
 */
export function overlappingItems(item: TimeRange & { id: string }, items: Item[]): Item[] {
  return items
    .filter(
      (other) =>
        other.id !== item.id && isMine(other) && other.beginAt < item.endAt && other.endAt > item.beginAt,
    )
    .sort((a, b) => a.beginAt.getTime() - b.beginAt.getTime())
}
