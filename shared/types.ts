// Tipos compartidos entre el servidor (server/) y el frontend (src/): el
// contrato de la API propia. Solo tipos, sin código: Node los descarta al
// ejecutar el servidor y Vite al compilar el frontend.

/** Tipos de elemento de la agenda. 'free' = franja libre de otro estudiante. */
export type ItemType = 'event' | 'exam' | 'slot' | 'correction' | 'free'

/**
 * Elemento de la agenda tal como lo sirve la API. `D` es el tipo de las fechas:
 * cadenas ISO en el JSON, `Date` una vez en el frontend (ver src/types.ts).
 *
 * Es una sola forma con campos opcionales según el tipo, en vez de una unión
 * por `type`: el frontend trata muchos elementos a la vez (pintarlos,
 * solapes...) y así se puede leer cualquier campo sin comprobar antes el tipo.
 */
export interface AgendaItem<D = string> {
  id: string
  type: ItemType
  /** Subtipo de la intra (conference, rush, extern...) o el propio tipo. */
  kind: string
  name: string
  /** Markdown (con algo de HTML a veces) en eventos; texto plano en el resto. */
  description: string
  location: string
  beginAt: D
  endAt: D

  // ---- eventos y exámenes ----
  eventId?: number
  examId?: number
  /** El usuario está inscrito. */
  subscribed?: boolean
  /** Plazas; null = sin límite. */
  maxPeople?: number | null
  subscribers?: number
  /** Horas antes del inicio a partir de las cuales la intra no deja borrarse. */
  cancellationLimitHours?: number

  // ---- slots propios y franjas libres ----
  /** Ids de los bloques de 15 min de la intra que forman la franja. */
  slotIds?: number[]
  /** Dueño de una franja libre: quien corregiría. */
  corrector?: { id: number; login: string | null } | null

  // ---- correcciones ----
  role?: 'corrector' | 'corrected'
  done?: boolean
  projectId?: number | null
}

/** Aviso de una fuente de la agenda que no se pudo cargar. */
export interface AgendaWarning {
  type: string
  code: 'missing_scope' | 'transient_error' | 'source_error'
  message: string
}

export interface AgendaCounts {
  event: number
  exam: number
  slot: number
  correction: number
  myEvents: number
  myExams: number
}

/** Respuesta de GET /api/agenda. */
export interface AgendaPayload<D = string> {
  items: AgendaItem<D>[]
  counts: AgendaCounts
  warnings: AgendaWarning[]
}

export type CacheState = 'fresh' | 'stale' | 'loaded'

export interface Coalition {
  id: number
  name: string
  slug: string | null
  /** Color en #rgb o #rrggbb; null si la intra no lo da. */
  color: string | null
  image: string | null
  cover: string | null
}

/** Usuario de la sesión, tal como lo ve el frontend. */
export interface SessionUser {
  id: number
  login: string
  displayName: string
  image: string | null
  campusId: number | null
  cursusId?: number | null
  cursusName?: string | null
  coalition: Coalition | null
}

/** Estado de un proyecto del usuario en la intra. */
export type ProjectStatus =
  | 'waiting_for_correction'
  | 'in_progress'
  | 'searching_a_group'
  | 'creating_group'
  | 'finished'
  | 'parent'
  | (string & {})

/** Un `projects_user` normalizado (GET /api/projects). */
export interface Project {
  /** Id del projects_user. */
  id: number
  projectId: number | null
  name: string
  slug: string | null
  status: ProjectStatus
  /** Cerrado y pendiente de corrección: el único estado en el que se agenda. */
  closed: boolean
  exam: boolean
  finalMark: number | null
  validated: boolean | null
  markedAt: string | null
  updatedAt: string | null
  teamId: number | null
  occurrence: number
}

/** Cuerpo de error de la API propia. */
export interface ApiError {
  error: string
}

/** Respuesta de POST/DELETE /api/events/:id/subscription y /api/exams/:id/subscription. */
export interface SubscriptionResult {
  ok: true
  subscribed: boolean
  /** Inscritos tras la operación; null si no se pudo releer. */
  subscribers: number | null
}
