// Reglas de los botones de acción: qué se puede hacer con un elemento ahora
// mismo y, si no, por qué. Las usa la ficha (ItemPopover) y Crear slots.

import { isMine } from './agendaTypes.ts'
import { t } from './i18n/index.ts'
import { itemName } from './itemText.ts'
import type { Item, Project, TimeRange } from './types.ts'
import { formatTime } from './utils/date.ts'

/** Duración mínima de un slot propio: dos bloques de 15 min. */
export const MIN_SLOT_MINUTES = 30

/**
 * Margen libre que la intra exige antes y después de un slot: dos slots
 * propios no pueden ir pegados.
 */
export const SLOT_GAP_MINUTES = 15

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
  return t.rules.overlaps(describe(first), rest.length)
}

/** "Nombre (10:00–11:00)". */
function describe(item: Item): string {
  return `${itemName(item)} (${formatTime(item.beginAt)}–${formatTime(item.endAt)})`
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

  const exam = item.type === 'exam'

  if (exam && !demo) return blocked(t.rules.examDisabled)
  if (item.externalKind) return blocked(item.signupUrl ? t.rules.externalWithLink : t.rules.externalNoLink)
  if (!scopeOk && item.type === 'event') return blocked(t.rules.missingProfileScope)
  if (item.endAt <= now) return blocked(t.rules.ended(exam))
  if (item.beginAt <= now) return blocked(t.rules.started(exam))

  if (item.subscribed) {
    const limit = item.cancellationLimitHours || 0
    if (limit > 0 && item.beginAt.getTime() - now.getTime() < limit * 3_600_000) {
      return blocked(t.rules.cancellationLimit(limit))
    }
  } else if (conflicts.length) {
    // El detalle de con qué choca ya va en la ficha, bajo los botones.
    return blocked(t.rules.overlapsAgenda)
  } else if (item.maxPeople && item.maxPeople > 0 && (item.subscribers ?? 0) >= item.maxPeople) {
    return blocked(t.rules.full)
  }

  return { action, enabled: true, reason: null }
}

/** Minutos que dura la corrección de una franja libre (la de su proyecto, o la habitual). */
export function evaluationMinutesOf(item: Item): number {
  return item.evaluationMinutes ?? CORRECTION_MINUTES
}

/**
 * Reservar una corrección en una franja libre de otro estudiante (type 'free')
 * para el proyecto elegido en "Correcciones" (o null), empezando a `startAt`.
 * null si el elemento no es una franja libre.
 * - La corrección entera (lo que dura la del proyecto) tiene que caber en la
 *   franja y no puede pisar nada de la agenda (`items`).
 */
export function bookingState(
  item: Item,
  project: Project | null,
  now: Date = new Date(),
  { startAt = item.beginAt, items = [] }: { startAt?: Date; items?: Item[] } = {},
): BookingState | null {
  if (item.type !== 'free') return null
  const blocked = (reason: string, overlap = false): BookingState => ({ enabled: false, reason, overlap })
  if (item.endAt <= now) return blocked(t.rules.slotPassed)
  if (!project) return blocked(t.rules.pickProject)
  if (!project.closed) return blocked(t.rules.projectNotClosed(project.name))
  if (!project.teamId) return blocked(t.rules.noTeam)
  if (startAt <= now) return blocked(t.rules.timePassed)
  const minutes = evaluationMinutesOf(item)
  const range = {
    id: item.id,
    beginAt: startAt,
    endAt: new Date(startAt.getTime() + minutes * 60_000),
  }
  if (range.endAt > item.endAt) return blocked(t.rules.doesNotFit(minutes))
  const conflicts = overlappingItems(range, items)
  if (conflicts.length) return blocked(overlapReason(conflicts), true)
  return { enabled: true, reason: null, overlap: false }
}

/** Borrar un slot propio (type 'slot'): solo si aún no ha empezado. */
export function slotDeleteState(item: Item, now: Date = new Date()): ButtonState | null {
  if (item.type !== 'slot') return null
  if (item.beginAt <= now) return { enabled: false, reason: t.rules.slotStarted }
  return { enabled: true, reason: null }
}

/**
 * Crear un slot propio en una franja marcada en las horas.
 * - items: la agenda; el slot no puede pisar otro slot propio, una corrección
 *   ni nada a lo que el usuario esté apuntado, ni quedar a menos de
 *   SLOT_GAP_MINUTES de otro slot propio.
 */
export function slotCreateState(range: TimeRange, now: Date = new Date(), items: Item[] = []): ButtonState {
  const blocked = (reason: string): ButtonState => ({ enabled: false, reason })
  if (range.beginAt <= now) return blocked(t.rules.slotInPast)
  if (range.endAt.getTime() - range.beginAt.getTime() < MIN_SLOT_MINUTES * 60_000) {
    return blocked(t.rules.slotTooShort(MIN_SLOT_MINUTES))
  }
  const conflicts = overlappingItems({ id: 'nuevo-slot', ...range }, items)
  if (conflicts.length) return blocked(overlapReason(conflicts))
  const [near] = slotsTooClose(range, items)
  if (near) return blocked(t.rules.slotGap(SLOT_GAP_MINUTES, describe(near)))
  return { enabled: true, reason: null }
}

/**
 * Slots propios a menos de SLOT_GAP_MINUTES de la franja (antes o después),
 * por orden de inicio. También cuentan las correcciones que das: ocupan un
 * slot tuyo que alguien ya ha reservado.
 */
export function slotsTooClose(range: TimeRange, items: Item[]): Item[] {
  const gap = SLOT_GAP_MINUTES * 60_000
  const begin = range.beginAt.getTime() - gap
  const end = range.endAt.getTime() + gap
  return items
    .filter(
      (other) =>
        (other.type === 'slot' || (other.type === 'correction' && other.role === 'corrector')) &&
        other.beginAt.getTime() < end &&
        other.endAt.getTime() > begin,
    )
    .sort((a, b) => a.beginAt.getTime() - b.beginAt.getTime())
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
