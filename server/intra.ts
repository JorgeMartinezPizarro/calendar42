// Cliente mínimo de la API de la intra de 42 (https://api.intra.42.fr).
// Flujo OAuth "authorization code": el usuario inicia sesión en la intra y el
// backend intercambia el código por un token que nunca sale del servidor.

import type {
  AgendaItem,
  AgendaPayload,
  AgendaWarning,
  Coalition,
  Project,
  SessionUser,
} from '../shared/types.ts'
import { asHttpError, httpError, type HttpError, type Tokens } from './types.ts'

const INTRA_BASE = 'https://api.intra.42.fr'
const PAGE_SIZE = 100

// ---------------------------------------------------------------------------
// Lo que la app lee de las respuestas de la intra (solo esos campos).
// ---------------------------------------------------------------------------

interface RawUserRef {
  id: number
  login?: string
}

interface RawCursusUser {
  cursus_id?: number
  begin_at?: string | null
  end_at?: string | null
  cursus?: { id?: number; name?: string; slug?: string }
}

interface RawMe {
  id: number
  login: string
  displayname?: string
  image?: { link?: string; versions?: { small?: string } }
  campus_users?: { campus_id: number; is_primary: boolean }[]
  campus?: { id: number }[]
  cursus_users?: RawCursusUser[]
}

interface RawCoalition {
  id: number
  name: string
  slug?: string
  color?: string
  image_url?: string
  cover_url?: string
}

interface RawEvent {
  id: number
  name: string
  kind?: string
  description?: string
  location?: string
  begin_at: string
  end_at: string
  max_people?: number | null
  nbr_subscribers?: number
  prohibition_of_cancellation?: number | string | null
}

interface RawExam {
  id: number
  name: string
  location?: string
  begin_at: string
  end_at: string
  max_people?: number | null
  nbr_subscribers?: number
  ip_range?: string
  projects?: { name?: string }[]
  cursus?: { name?: string }[]
}

interface RawSlot {
  id: number
  begin_at: string
  end_at: string
  scale_team: unknown
  user?: RawUserRef | null
}

interface RawScaleTeam {
  id: number
  begin_at: string
  filled_at?: string | null
  final_mark?: number | null
  /** La intra lo oculta ("invisible") a veces: puede no ser un objeto. */
  corrector?: RawUserRef | string | null
  correcteds?: (RawUserRef | string)[] | string
  scale?: { duration?: number }
  team?: { name?: string; project_id?: number; project_gitlab_path?: string }
}

interface RawProjectUser {
  id: number
  status?: string
  final_mark?: number | null
  'validated?'?: boolean | null
  marked_at?: string | null
  updated_at?: string | null
  current_team_id?: number | null
  occurrence?: number
  cursus_ids?: number[]
  project?: { id: number; name?: string; slug?: string }
}

interface RawTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}

// Scopes: `public` para eventos/exámenes del campus, `projects` para slots y
// correcciones del usuario, `profile` para apuntarse y borrarse de eventos
// (la intra lo exige para crear y borrar datos del usuario). La app registrada
// en la intra debe tenerlos activados; si le falta alguno, el login falla.
export const OAUTH_SCOPES = 'public projects profile'

export function hasAppCredentials(): boolean {
  return Boolean(process.env.FT_CLIENT_ID && process.env.FT_CLIENT_SECRET)
}

export function redirectUri(): string {
  return process.env.FT_REDIRECT_URI || 'http://localhost:5173/api/auth/callback'
}

export function authorizeUrl(state: string): string {
  const url = new URL(`${INTRA_BASE}/oauth/authorize`)
  url.searchParams.set('client_id', process.env.FT_CLIENT_ID ?? '')
  url.searchParams.set('redirect_uri', redirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', OAUTH_SCOPES)
  url.searchParams.set('state', state)
  return url.toString()
}

async function tokenRequest(params: Record<string, string>): Promise<Tokens> {
  recordCall()
  const res = await fetch(`${INTRA_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.FT_CLIENT_ID ?? '',
      client_secret: process.env.FT_CLIENT_SECRET ?? '',
      ...params,
    }),
  })
  if (!res.ok) {
    throw httpError(`La intra rechazó la petición de token (${res.status})`, {
      status: res.status,
      transient: res.status === 429 || res.status >= 500,
    })
  }
  const data = (await res.json()) as RawTokenResponse
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope ?? '',
  }
}

export function exchangeCode(code: string): Promise<Tokens> {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() })
}

export function refreshTokens(refreshToken: string): Promise<Tokens> {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

// Token de la aplicación (client_credentials), sin usuario. Sirve para recursos
// que la intra no deja leer a los estudiantes con su propio token.
let appToken: Tokens | null = null

export async function getAppToken(): Promise<string> {
  if (appToken && appToken.expiresAt > Date.now() + 30_000) return appToken.accessToken
  appToken = await tokenRequest({ grant_type: 'client_credentials' })
  return appToken.accessToken
}

// ---------------------------------------------------------------------------
// Limitador: la intra permite 2 peticiones por segundo por aplicación.
// Encadenamos todas las llamadas con un mínimo de 600 ms entre inicios.
// ---------------------------------------------------------------------------

const MIN_GAP_MS = 600
const RETRY_DELAYS_MS = [1500, 3000] // reintentos ante 429
let lastStart = 0
let queue: Promise<unknown> = Promise.resolve()

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Presupuesto horario: la intra admite 1200 llamadas por hora por aplicación,
// compartidas por todos los usuarios. Se anotan todas las peticiones (también
// reintentos y tokens) y, cuando queda poco margen, la caché deja de renovar
// y sirve lo que tiene (ver cache.ts).
export const INTRA_HOURLY_LIMIT = Number(process.env.FT_HOURLY_LIMIT) || 1200
const HOURLY_RESERVE = 120 // margen para lo imprescindible: logins y acciones
const callLog: number[] = [] // instantes de las llamadas de la última hora

function pruneCalls(now: number): void {
  const limit = now - 3_600_000
  while (callLog.length && callLog[0] < limit) callLog.shift()
}

function recordCall(): void {
  const now = Date.now()
  callLog.push(now)
  pruneCalls(now)
}

export function intraCallsLastHour(): number {
  pruneCalls(Date.now())
  return callLog.length
}

export function intraBudgetLow(): boolean {
  return intraCallsLastHour() >= INTRA_HOURLY_LIMIT - HOURLY_RESERVE
}

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastStart + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastStart = Date.now()
    recordCall()
    return fn()
  })
  // La cola nunca se rompe aunque una petición falle.
  queue = run.catch(() => {})
  return run
}

async function fetchWithRetry(url: URL, options: RequestInit): Promise<Response> {
  let res = await throttled(() => fetch(url, options))
  for (const delay of RETRY_DELAYS_MS) {
    if (res.status !== 429) break
    await sleep(delay)
    res = await throttled(() => fetch(url, options))
  }
  return res
}

type QueryParams = Record<string, string | number>

export function intraGet<T>(accessToken: string, path: string, params: QueryParams = {}): Promise<T> {
  return intraRequest<T>(accessToken, path, { params })
}

/** Errores de validación de la intra ({ campo: ['mensaje'] }) en una línea. */
function describeErrors(errors: unknown): string | null {
  if (!errors || typeof errors !== 'object') return null
  return Object.entries(errors as Record<string, unknown>)
    .map(([field, msgs]) => `${field}: ${([] as unknown[]).concat(msgs).join(', ')}`)
    .join('; ')
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  params?: QueryParams
  /** Se envía como JSON. */
  body?: unknown
  /** Se envía como formulario clásico (claves estilo `recurso[campo]`). */
  form?: QueryParams
}

/**
 * Petición genérica a la intra. Las respuestas sin cuerpo (204, p. ej. al
 * borrar) devuelven null. T es la forma que se espera de la respuesta: la
 * intra no la garantiza, así que quien llama la trata con prudencia.
 */
export async function intraRequest<T>(
  accessToken: string,
  path: string,
  { method = 'GET', params = {}, body, form }: RequestOptions = {},
): Promise<T> {
  const url = new URL(`${INTRA_BASE}/v2${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` }
  const options: RequestInit = { method, headers }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  } else if (form !== undefined) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    options.body = new URLSearchParams(
      Object.fromEntries(Object.entries(form).map(([k, v]) => [k, String(v)])),
    ).toString()
  }
  const label = method === 'GET' ? path : `${method} ${path}`
  let res: Response
  try {
    res = await fetchWithRetry(url, options)
  } catch (netErr) {
    // Conexión cortada, DNS, etc.: la intra no ha respondido.
    const e = netErr as Error & { cause?: { code?: string } }
    throw httpError(`La intra no respondió en ${label} (${e.cause?.code ?? e.message})`, {
      status: 503,
      path,
      transient: true,
    })
  }
  if (res.status >= 520 && res.status <= 530) {
    // Códigos de Cloudflare: el origen de la intra está caído o saturado.
    throw httpError(`La intra no está disponible ahora mismo (${res.status})`, {
      status: res.status,
      path,
      transient: true,
    })
  }
  if (!res.ok) {
    // La intra explica el motivo en el cuerpo (p. ej. "insufficient_scope").
    let reason = ''
    let rawBody = ''
    try {
      const text = (await res.text()).trim()
      rawBody = text.slice(0, 500)
      if (text.startsWith('<')) {
        reason = res.status === 404 ? 'ruta inexistente' : 'respuesta HTML'
      } else if (text) {
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>
          const found =
            parsed.message ?? parsed.error_description ?? parsed.error ?? describeErrors(parsed.errors) ?? text
          reason = String(found)
        } catch {
          reason = text
        }
      }
    } catch {
      // sin cuerpo legible
    }
    const detail = reason ? `: ${reason.slice(0, 200)}` : ''
    throw httpError(`Error de la intra en ${label} (${res.status}${detail})`, {
      status: res.status,
      path,
      reason,
      body: rawBody,
      transient: res.status === 429 || res.status >= 500,
    })
  }
  if (res.status === 204) return null as T
  return (await res.json()) as T
}

/** Recorre todas las páginas de un listado. */
async function fetchAllPages<T>(accessToken: string, path: string, params: QueryParams = {}): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page += 1) {
    const batch = await intraGet<T[]>(accessToken, path, {
      ...params,
      'page[size]': PAGE_SIZE,
      'page[number]': page,
    })
    items.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  return items
}

interface Range {
  from: Date
  to: Date
}

/** Recorre todas las páginas de un listado filtrado por begin_at. */
function fetchAllInRange<T>(accessToken: string, path: string, { from, to }: Range, extraParams: QueryParams = {}) {
  return fetchAllPages<T>(accessToken, path, {
    'range[begin_at]': `${from.toISOString()},${to.toISOString()}`,
    sort: 'begin_at',
    ...extraParams,
  })
}

// ---------------------------------------------------------------------------
// Usuario
// ---------------------------------------------------------------------------

export async function fetchMe(accessToken: string): Promise<SessionUser> {
  const me = await intraGet<RawMe>(accessToken, '/me')
  const primary = me.campus_users?.find((c) => c.is_primary)
  const campusId = primary?.campus_id ?? me.campus?.[0]?.id ?? null
  const cursus = pickCurrentCursus(me.cursus_users)
  return {
    id: me.id,
    login: me.login,
    displayName: me.displayname ?? me.login,
    image: me.image?.versions?.small ?? me.image?.link ?? null,
    campusId,
    cursusId: cursus?.id ?? null,
    cursusName: cursus?.name ?? null,
    coalition: await fetchMyCoalition(accessToken, me.id, { campusId, cursusId: cursus?.id ?? null }),
  }
}

// Cursus principal de 42. Si el usuario está en él, manda sobre cualquier
// piscina o discovery, aunque estas sean más recientes.
const MAIN_CURSUS_SLUG = '42cursus'

export interface CurrentCursus {
  id: number
  name: string | null
  slug: string | null
}

/**
 * Cursus "actual" del usuario a partir de `cursus_users` de `/me`: el 42cursus
 * si lo tiene; si no (p. ej. un pisciner), el más reciente, dando prioridad a
 * los que siguen abiertos (sin `end_at` o con `end_at` en el futuro).
 */
export function pickCurrentCursus(cursusUsers: RawCursusUser[] | undefined): CurrentCursus | null {
  if (!Array.isArray(cursusUsers) || cursusUsers.length === 0) return null
  const now = Date.now()
  const isOpen = (cu: RawCursusUser) => !cu.end_at || (Date.parse(cu.end_at) || 0) > now
  const beginAt = (cu: RawCursusUser) => Date.parse(cu.begin_at ?? '') || 0
  const chosen =
    cursusUsers.find((cu) => cu.cursus?.slug === MAIN_CURSUS_SLUG) ??
    [...cursusUsers].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || beginAt(b) - beginAt(a))[0]
  const id = chosen.cursus_id ?? chosen.cursus?.id ?? null
  if (id == null) return null
  return { id, name: chosen.cursus?.name ?? null, slug: chosen.cursus?.slug ?? null }
}

/** Normaliza una coalición de la intra. */
export function normalizeCoalition(raw: RawCoalition | null | undefined): Coalition | null {
  if (!raw) return null
  const color =
    typeof raw.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(raw.color.trim()) ? raw.color.trim() : null
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug ?? null,
    color,
    image: raw.image_url ?? null,
    cover: raw.cover_url ?? null,
  }
}

/**
 * Coalición del usuario. `/users/:id/coalitions` devuelve todas las coaliciones
 * a las que ha pertenecido (una por bloc: piscina, discovery, cursus...) sin
 * decir a qué cursus corresponde cada una, así que un alumno que hizo la piscina
 * tiene dos o más. Para quedarnos con la del cursus actual consultamos los blocs
 * de ese cursus en su campus (`/blocs`), que sí listan sus coaliciones.
 * Es un dato decorativo: si algo falla, devolvemos lo mejor que tengamos y seguimos.
 */
export async function fetchMyCoalition(
  accessToken: string,
  userId: number,
  { campusId = null, cursusId = null }: { campusId?: number | null; cursusId?: number | null } = {},
): Promise<Coalition | null> {
  try {
    const raw = await intraGet<RawCoalition[]>(accessToken, `/users/${userId}/coalitions`)
    const list = Array.isArray(raw)
      ? raw.map(normalizeCoalition).filter((c): c is Coalition => c !== null)
      : []
    if (list.length === 0) return null
    const fallback = () => list.find((c) => c.color) ?? list[0]
    if (list.length === 1 || cursusId == null) return fallback()

    const ofCursus = await fetchCoalitionIdsOfCursus(accessToken, { campusId, cursusId })
    return list.find((c) => ofCursus.has(c.id)) ?? fallback()
  } catch (err) {
    console.warn('[coalition] no se pudo obtener la coalición:', asHttpError(err).message)
    return null
  }
}

/**
 * Ids de las coaliciones de los blocs de un cursus (y de un campus, si se conoce).
 * Un bloc agrupa las coaliciones de un cursus en un campus.
 */
async function fetchCoalitionIdsOfCursus(
  accessToken: string,
  { campusId, cursusId }: { campusId: number | null; cursusId: number },
): Promise<Set<number>> {
  const params: QueryParams = { 'filter[cursus_id]': cursusId, 'page[size]': PAGE_SIZE }
  if (campusId != null) params['filter[campus_id]'] = campusId
  const ids = new Set<number>()
  try {
    const blocs = await intraGet<{ coalitions?: { id: number }[] }[]>(accessToken, '/blocs', params)
    for (const bloc of Array.isArray(blocs) ? blocs : []) {
      for (const c of bloc.coalitions ?? []) ids.add(c.id)
    }
  } catch (err) {
    console.warn('[coalition] no se pudieron consultar los blocs del cursus:', asHttpError(err).message)
  }
  return ids
}

// ---------------------------------------------------------------------------
// Normalización a un formato común de "elemento de agenda" (AgendaItem).
// ---------------------------------------------------------------------------

export function normalizeEvent(raw: RawEvent): AgendaItem {
  return {
    id: `event-${raw.id}`,
    eventId: raw.id,
    type: 'event',
    kind: raw.kind || 'event',
    name: raw.name,
    description: raw.description ?? '',
    location: raw.location ?? '',
    beginAt: raw.begin_at,
    endAt: raw.end_at,
    maxPeople: raw.max_people && raw.max_people > 0 ? raw.max_people : null, // 0 o null: sin límite
    subscribers: raw.nbr_subscribers ?? 0,
    // Horas antes del inicio a partir de las cuales la intra no deja borrarse.
    cancellationLimitHours: Number(raw.prohibition_of_cancellation) || 0,
  }
}

const uniqueNames = (list: { name?: string }[] | undefined) =>
  [...new Set((list ?? []).map((x) => x.name).filter((n): n is string => Boolean(n)))]

export function normalizeExam(raw: RawExam): AgendaItem {
  const projects = uniqueNames(raw.projects)
  const cursus = uniqueNames(raw.cursus)
  const details: string[] = []
  if (projects.length) details.push(`Proyectos: ${projects.join(', ')}`)
  if (cursus.length) details.push(`Cursus: ${cursus.join(', ')}`)
  if (raw.ip_range) details.push(`IP: ${raw.ip_range}`)

  return {
    id: `exam-${raw.id}`,
    examId: raw.id,
    type: 'exam',
    kind: 'exam',
    name: raw.name,
    description: details.join('\n'),
    location: raw.location ?? '',
    beginAt: raw.begin_at,
    endAt: raw.end_at,
    maxPeople: raw.max_people && raw.max_people > 0 ? raw.max_people : null, // 0 o null: sin límite
    subscribers: raw.nbr_subscribers ?? 0,
  }
}

interface MergedBlock {
  begin_at: string
  end_at: string
  ids: number[]
  user: RawUserRef | null
}

/** Fusiona bloques de 15 min contiguos (ya ordenados) de una misma persona. */
function mergeBlocks(slots: RawSlot[]): MergedBlock[] {
  const merged: MergedBlock[] = []
  for (const s of slots) {
    const last = merged[merged.length - 1]
    if (last && last.end_at === s.begin_at) {
      last.end_at = s.end_at
      last.ids.push(s.id)
    } else {
      merged.push({ begin_at: s.begin_at, end_at: s.end_at, ids: [s.id], user: s.user ?? null })
    }
  }
  return merged
}

/**
 * La intra devuelve los slots troceados en bloques de 15 minutos. Fusionamos
 * los libres contiguos (scale_team == null) en un único bloque.
 */
export function normalizeOpenSlots(rawSlots: RawSlot[]): AgendaItem[] {
  const free = rawSlots
    .filter((s) => s.scale_team == null)
    .sort((a, b) => a.begin_at.localeCompare(b.begin_at))

  return mergeBlocks(free).map((s) => ({
    id: `slot-${s.ids[0]}`,
    type: 'slot',
    kind: 'slot',
    name: 'Slot de corrección abierto',
    description: `Disponible para corregir (${s.ids.length} × 15 min)`,
    location: '',
    beginAt: s.begin_at,
    endAt: s.end_at,
    slotIds: s.ids,
  }))
}

function userLogin(u: RawUserRef | string | null | undefined): string | null {
  return u && typeof u === 'object' ? (u.login ?? null) : null
}

function projectNameFromGitlabPath(path: string | undefined): string | null {
  if (!path) return null
  const last = path.split('/').filter(Boolean).pop()
  return last ? last.replace(/[-_]/g, ' ') : null
}

export function normalizeScaleTeam(raw: RawScaleTeam, myId: number, projectName: string | null): AgendaItem {
  const correctorLogin = userLogin(raw.corrector)
  const correctedLogins = Array.isArray(raw.correcteds)
    ? raw.correcteds.map(userLogin).filter((l): l is string => Boolean(l))
    : []
  const amCorrector = typeof raw.corrector === 'object' && raw.corrector?.id === myId
  const role = amCorrector ? 'corrector' : 'corrected'

  const durationSec = raw.scale?.duration ?? 1800
  const begin = new Date(raw.begin_at)
  const end = new Date(begin.getTime() + durationSec * 1000)

  const details: string[] = []
  details.push(role === 'corrector' ? 'Tú corriges' : 'Te corrigen')
  if (correctorLogin) details.push(`Corrector: ${correctorLogin}`)
  if (correctedLogins.length) details.push(`Corregidos: ${correctedLogins.join(', ')}`)
  if (raw.team?.name) details.push(`Equipo: ${raw.team.name}`)
  if (raw.filled_at) details.push(`Evaluación entregada${raw.final_mark != null ? ` · nota ${raw.final_mark}` : ''}`)

  const project =
    projectName ?? projectNameFromGitlabPath(raw.team?.project_gitlab_path) ?? raw.team?.name ?? 'Proyecto'

  return {
    id: `correction-${raw.id}`,
    type: 'correction',
    kind: 'correction',
    name: `Corrección: ${project}`,
    description: details.join('\n'),
    location: '',
    beginAt: begin.toISOString(),
    endAt: end.toISOString(),
    role,
    done: Boolean(raw.filled_at),
    projectId: raw.team?.project_id ?? null,
  }
}

// ---------------------------------------------------------------------------
// Fuentes de datos
// ---------------------------------------------------------------------------

/** Eventos del campus cuyo inicio cae en [from, to). */
export async function fetchCampusEvents(
  accessToken: string,
  { campusId, from, to }: Range & { campusId: number },
): Promise<AgendaItem[]> {
  const raw = await fetchAllInRange<RawEvent>(accessToken, `/campus/${campusId}/events`, { from, to })
  return raw.map(normalizeEvent)
}

/**
 * Exámenes del campus cuyo inicio cae en [from, to).
 * La intra responde 403 a los estudiantes con su propio token en todos los
 * endpoints de exámenes, pero el token de la aplicación (client_credentials)
 * sí puede leerlos, así que usamos ese.
 */
export async function fetchCampusExams({ campusId, from, to }: Range & { campusId: number }): Promise<AgendaItem[]> {
  const token = await getAppToken()
  const raw = await fetchAllInRange<RawExam>(token, `/campus/${campusId}/exams`, { from, to })
  return raw.map(normalizeExam)
}

/**
 * Ids de los eventos a los que el usuario está inscrito, con inicio en [from, to).
 * `/users/:id/events` devuelve directamente los eventos del usuario.
 */
export async function fetchMyEventIds(
  accessToken: string,
  { userId, from, to }: Range & { userId: number },
): Promise<Set<number>> {
  const raw = await fetchAllInRange<{ id: number }>(accessToken, `/users/${userId}/events`, { from, to })
  return new Set(raw.map((e) => e.id))
}

/**
 * Ids de los exámenes en los que el usuario está inscrito, con inicio en [from, to).
 * Como el resto de rutas de exámenes, `/users/:id/exams` devuelve 403 con el token
 * del estudiante pero funciona con el de la aplicación.
 */
export async function fetchMyExamIds({ userId, from, to }: Range & { userId: number }): Promise<Set<number>> {
  const token = await getAppToken()
  const raw = await fetchAllInRange<{ id: number }>(token, `/users/${userId}/exams`, { from, to })
  return new Set(raw.map((e) => e.id))
}

// ---------------------------------------------------------------------------
// Inscripción a eventos
// ---------------------------------------------------------------------------

/** Un evento concreto ya normalizado, o null si no se puede releer. */
async function fetchEventOrNull(accessToken: string, eventId: number): Promise<AgendaItem | null> {
  try {
    return normalizeEvent(await intraGet<RawEvent>(accessToken, `/events/${eventId}`))
  } catch (err) {
    console.warn('[events] no se pudo releer el evento:', asHttpError(err).message)
    return null
  }
}

interface EventAndUser {
  eventId: number
  userId: number
}

/**
 * Inscribe al usuario en un evento (`POST /events_users`). La intra valida
 * aforo y fechas: si rechaza la inscripción, el error lleva su motivo en
 * `reason`. Devuelve el evento actualizado (o null si no se pudo releer).
 */
export async function subscribeToEvent(
  accessToken: string,
  { eventId, userId }: EventAndUser,
): Promise<AgendaItem | null> {
  try {
    await intraRequest(accessToken, '/events_users', {
      method: 'POST',
      body: { events_user: { event_id: eventId, user_id: userId } },
    })
  } catch (err) {
    const e = asHttpError(err)
    if (!isNotAuthorized(e)) throw e
    // La intra comprueba permisos sobre el recurso que construye con los
    // parámetros: si no hubiera leído el cuerpo JSON, denegaría igual. Antes de
    // darlo por imposible, misma petición como formulario clásico.
    console.warn(`[events] POST /events_users denegado (${e.status}): ${e.body}. Reintento como formulario.`)
    await intraRequest(accessToken, '/events_users', {
      method: 'POST',
      form: { 'events_user[event_id]': eventId, 'events_user[user_id]': userId },
    })
  }
  return fetchEventOrNull(accessToken, eventId)
}

/** "You are not authorized to access this page": la intra deniega la acción a esta cuenta. */
export function isNotAuthorized(err: HttpError): boolean {
  return (err.status === 403 || err.status === 401) && /not authorized/i.test(String(err.reason))
}

/**
 * Borra la inscripción del usuario a un evento. Hace falta el id de la
 * inscripción (`events_user`), que buscamos en `/users/:id/events_users`.
 */
export async function unsubscribeFromEvent(
  accessToken: string,
  { eventId, userId }: EventAndUser,
): Promise<AgendaItem | null> {
  const list = await intraGet<{ id: number; event_id?: number; event?: { id: number } }[]>(
    accessToken,
    `/users/${userId}/events_users`,
    { 'filter[event_id]': eventId, 'page[size]': PAGE_SIZE },
  )
  const subscription = (Array.isArray(list) ? list : []).find(
    (eu) => eu.event_id === eventId || eu.event?.id === eventId,
  )
  if (!subscription) throw httpError('No estás inscrito en este evento', { status: 404 })
  await intraRequest(accessToken, `/events_users/${subscription.id}`, { method: 'DELETE' })
  return fetchEventOrNull(accessToken, eventId)
}

// ---------------------------------------------------------------------------
// Proyectos del usuario
// ---------------------------------------------------------------------------

// Id del 42cursus en la intra, para sesiones anteriores a guardar el cursus.
const MAIN_CURSUS_ID = 21

/**
 * Los exámenes también son proyectos en la intra, pero no se corrigen: no
 * pintan nada en "Correcciones". El proyecto embebido en `projects_users` no
 * trae la marca `exam` del proyecto completo, así que se reconocen por el
 * slug o el nombre, que la intra forma siempre con "exam" (`exam-rank-02`,
 * `c-piscine-exam-00`).
 */
export function isExamProject(project: { slug?: string; name?: string } | null | undefined): boolean {
  const text = `${project?.slug ?? ''} ${project?.name ?? ''}`.toLowerCase()
  return /\bexam\b/.test(text)
}

/**
 * Normaliza un `projects_user`. `closed` es true cuando el equipo ha cerrado el
 * proyecto y espera corrección (status `waiting_for_correction`): es el único
 * estado en el que se puede agendar una corrección.
 */
export function normalizeProjectUser(raw: RawProjectUser): Project {
  return {
    id: raw.id,
    projectId: raw.project?.id ?? null,
    name: raw.project?.name ?? 'Proyecto',
    slug: raw.project?.slug ?? null,
    status: raw.status ?? 'unknown',
    closed: raw.status === 'waiting_for_correction',
    exam: isExamProject(raw.project),
    finalMark: raw.final_mark ?? null,
    validated: raw['validated?'] ?? null,
    markedAt: raw.marked_at ?? null,
    updatedAt: raw.updated_at ?? null,
    teamId: raw.current_team_id ?? null,
    occurrence: raw.occurrence ?? 0,
  }
}

/**
 * Proyectos del usuario en su cursus (`/users/:id/projects_users`), sin los
 * "padre" (contenedores de módulos) ni los exámenes, ordenados por nombre.
 */
export async function fetchMyProjects(
  accessToken: string,
  { userId, cursusId }: { userId: number; cursusId: number | null },
): Promise<Project[]> {
  const raw = await fetchAllPages<RawProjectUser>(accessToken, `/users/${userId}/projects_users`)
  const wanted =
    cursusId ?? (raw.some((pu) => pu.cursus_ids?.includes(MAIN_CURSUS_ID)) ? MAIN_CURSUS_ID : null)
  return raw
    .filter((pu) => pu.project && pu.status !== 'parent' && !isExamProject(pu.project))
    .filter((pu) => wanted == null || (pu.cursus_ids ?? []).includes(wanted))
    .map(normalizeProjectUser)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Slots de corrección abiertos del usuario en [from, to). Requiere scope `projects`. */
export async function fetchMyOpenSlots(accessToken: string, { from, to }: Range): Promise<AgendaItem[]> {
  const raw = await fetchAllInRange<RawSlot>(accessToken, '/me/slots', { from, to })
  return normalizeOpenSlots(raw)
}

// ---------------------------------------------------------------------------
// Slots propios: crear y borrar
// ---------------------------------------------------------------------------

/**
 * Abre un slot de corrección del usuario entre dos instantes (ISO). La intra
 * lo trocea en bloques de 15 min y devuelve esos bloques; los fusionamos como
 * en la agenda. Requiere scope `projects`.
 */
export async function createSlot(
  accessToken: string,
  { userId, beginAt, endAt }: { userId: number; beginAt: string; endAt: string },
): Promise<AgendaItem[]> {
  const raw = await intraRequest<RawSlot[] | RawSlot | null>(accessToken, '/slots', {
    method: 'POST',
    body: { slot: { user_id: userId, begin_at: beginAt, end_at: endAt } },
  })
  return normalizeOpenSlots(Array.isArray(raw) ? raw : raw ? [raw] : [])
}

/** Borra bloques de slot propios, uno a uno (la intra no admite borrado múltiple). */
export async function deleteSlots(accessToken: string, ids: number[]): Promise<void> {
  for (const id of ids) {
    await intraRequest(accessToken, `/slots/${id}`, { method: 'DELETE' })
  }
}

// ---------------------------------------------------------------------------
// Correcciones: slots libres de un proyecto y reserva
// ---------------------------------------------------------------------------

/**
 * Fusiona los bloques libres de 15 min de otros estudiantes en franjas por
 * corrector (elementos de tipo 'free').
 */
export function normalizeFreeSlots(
  rawSlots: RawSlot[],
  { excludeUserId = null }: { excludeUserId?: number | null } = {},
): AgendaItem[] {
  const free = rawSlots
    .filter((s) => s.scale_team == null)
    // Los slots propios no sirven para que a uno le corrijan.
    .filter((s) => excludeUserId == null || s.user?.id !== excludeUserId)
    .sort((a, b) => a.begin_at.localeCompare(b.begin_at))

  const byUser = new Map<number | 'anon', RawSlot[]>()
  for (const s of free) {
    const key = s.user?.id ?? 'anon'
    const list = byUser.get(key) ?? []
    list.push(s)
    byUser.set(key, list)
  }

  return [...byUser.values()]
    .flatMap(mergeBlocks)
    .sort((a, b) => a.begin_at.localeCompare(b.begin_at))
    .map((b) => ({
      id: `free-${b.ids[0]}`,
      type: 'free',
      kind: 'free',
      name: b.user?.login ? `Slot libre · ${b.user.login}` : 'Slot libre para corrección',
      description: `Un estudiante puede corregirte en esta franja (${b.ids.length} × 15 min).`,
      location: '',
      beginAt: b.begin_at,
      endAt: b.end_at,
      slotIds: b.ids,
      corrector: b.user ? { id: b.user.id, login: b.user.login ?? null } : null,
    }))
}

/** Slots libres para corregir un proyecto en [from, to). Requiere scope `projects`. */
export async function fetchProjectSlots(
  accessToken: string,
  { projectId, userId = null, from, to }: Range & { projectId: number; userId?: number | null },
): Promise<AgendaItem[]> {
  const raw = await fetchAllInRange<RawSlot>(accessToken, `/projects/${projectId}/slots`, { from, to })
  return normalizeFreeSlots(raw, { excludeUserId: userId })
}

/**
 * Reserva una corrección: crea un `scale_team` con la escala principal del
 * proyecto, el equipo del usuario y, si se conoce, el corrector dueño del
 * slot. La intra valida disponibilidad y permisos; sus motivos llegan en
 * `reason` (y, si no autoriza a los estudiantes, en "not authorized").
 */
export async function bookCorrection(
  accessToken: string,
  {
    projectId,
    teamId,
    beginAt,
    correctorId,
  }: { projectId: number; teamId: number; beginAt: string; correctorId: number | null },
): Promise<unknown> {
  const scales = await intraGet<{ id: number; is_primary?: boolean }[]>(accessToken, `/projects/${projectId}/scales`)
  const list = Array.isArray(scales) ? scales : []
  const scale = list.find((s) => s.is_primary) ?? list[0]
  if (!scale) throw httpError('El proyecto no tiene escala de evaluación en la intra', { status: 404 })
  const scaleTeam: Record<string, string | number> = { begin_at: beginAt, team_id: teamId, scale_id: scale.id }
  if (correctorId) scaleTeam.user_id = correctorId
  return intraRequest(accessToken, '/scale_teams', { method: 'POST', body: { scale_team: scaleTeam } })
}

// Nombres de proyecto cacheados en memoria (cambian muy poco).
const projectNames = new Map<number, string>()

async function resolveProjectName(accessToken: string, projectId: number): Promise<string | null> {
  const known = projectNames.get(projectId)
  if (known) return known
  try {
    const project = await intraGet<{ name: string }>(accessToken, `/projects/${projectId}`)
    projectNames.set(projectId, project.name)
    return project.name
  } catch {
    return null
  }
}

/** Correcciones (como corrector o corregido) del usuario en [from, to). Requiere scope `projects`. */
export async function fetchMyCorrections(
  accessToken: string,
  { userId, from, to }: Range & { userId: number },
): Promise<AgendaItem[]> {
  const raw = await fetchAllInRange<RawScaleTeam>(accessToken, '/me/scale_teams', { from, to })

  // Resolvemos nombres de proyecto solo cuando el team no trae gitlab path.
  const missing = new Set<number>()
  for (const st of raw) {
    if (!st.team?.project_gitlab_path && st.team?.project_id) missing.add(st.team.project_id)
  }
  for (const id of missing) await resolveProjectName(accessToken, id)

  return raw.map((st) => {
    const projectId = st.team?.project_id
    return normalizeScaleTeam(st, userId, projectId != null ? (projectNames.get(projectId) ?? null) : null)
  })
}

/**
 * Recoge varias fuentes a la vez. Si una falla (p. ej. falta el scope),
 * devuelve el resto y un aviso en `warnings`; una sesión caducada (401) se
 * propaga para que la gestione el llamador.
 */
async function collectSources<S extends Record<string, () => Promise<unknown>>>(
  sources: S,
): Promise<{ values: Partial<{ [K in keyof S]: Awaited<ReturnType<S[K]>> }>; warnings: AgendaWarning[] }> {
  const keys = Object.keys(sources) as (keyof S & string)[]
  const results = await Promise.allSettled(keys.map((k) => sources[k]()))
  const values: Partial<{ [K in keyof S]: Awaited<ReturnType<S[K]>> }> = {}
  const warnings: AgendaWarning[] = []

  results.forEach((result, i) => {
    const type = keys[i]
    if (result.status === 'fulfilled') {
      values[type] = result.value as Awaited<ReturnType<S[typeof type]>>
      return
    }
    const err = asHttpError(result.reason)
    if (err.status === 401) throw err
    if (err.status === 403 && (type === 'slot' || type === 'correction')) {
      warnings.push({
        type,
        code: 'missing_scope',
        message: 'La sesión no tiene el scope "projects". Cierra sesión y vuelve a entrar.',
      })
    } else {
      warnings.push({ type, code: err.transient ? 'transient_error' : 'source_error', message: err.message })
    }
  })

  return { values, warnings }
}

/** Parte compartida de la agenda: eventos y exámenes del campus. */
export interface CampusAgenda {
  events: AgendaItem[]
  exams: AgendaItem[]
  warnings: AgendaWarning[]
}

/** Parte personal de la agenda. Ids en arrays (no Sets) para poder cachearla. */
export interface PersonalAgenda {
  slots: AgendaItem[]
  corrections: AgendaItem[]
  myEventIds: number[]
  myExamIds: number[]
  warnings: AgendaWarning[]
}

/**
 * Parte compartida de la agenda: eventos y exámenes del campus en [from, to).
 * Es igual para todos los alumnos del campus, así que se cachea por campus.
 */
export async function fetchCampusAgenda(
  accessToken: string,
  { campusId, from, to }: Range & { campusId: number },
): Promise<CampusAgenda> {
  const { values, warnings } = await collectSources({
    event: () => fetchCampusEvents(accessToken, { campusId, from, to }),
    exam: () => fetchCampusExams({ campusId, from, to }),
  })
  return { events: values.event ?? [], exams: values.exam ?? [], warnings }
}

/**
 * Parte personal de la agenda en [from, to): slots abiertos, correcciones e
 * inscripciones (ids de eventos y exámenes) del usuario. Se cachea por usuario
 * y se invalida con cada acción suya.
 */
export async function fetchPersonalAgenda(
  accessToken: string,
  { userId, from, to }: Range & { userId: number },
): Promise<PersonalAgenda> {
  const { values, warnings } = await collectSources({
    slot: () => fetchMyOpenSlots(accessToken, { from, to }),
    correction: () => fetchMyCorrections(accessToken, { userId, from, to }),
    myEvents: () => fetchMyEventIds(accessToken, { userId, from, to }),
    myExams: () => fetchMyExamIds({ userId, from, to }),
  })
  return {
    slots: values.slot ?? [],
    corrections: values.correction ?? [],
    myEventIds: [...(values.myEvents ?? [])],
    myExamIds: [...(values.myExams ?? [])],
    warnings,
  }
}

/**
 * Une la parte del campus y la personal en la agenda que ve el frontend. Lo del
 * campus vive en una caché compartida, así que se copia antes de marcar las
 * inscripciones del usuario.
 */
export function mergeAgenda(campus: CampusAgenda, personal: PersonalAgenda): AgendaPayload {
  const myEventIds = new Set(personal.myEventIds)
  const myExamIds = new Set(personal.myExamIds)
  const events = campus.events.map((it) => ({ ...it, subscribed: myEventIds.has(it.eventId ?? -1) }))
  const exams = campus.exams.map((it) => ({ ...it, subscribed: myExamIds.has(it.examId ?? -1) }))

  const items = [...events, ...exams, ...personal.slots, ...personal.corrections].sort((a, b) =>
    a.beginAt.localeCompare(b.beginAt),
  )
  const counts = {
    event: events.length,
    exam: exams.length,
    slot: personal.slots.length,
    correction: personal.corrections.length,
    myEvents: events.filter((it) => it.subscribed).length,
    myExams: exams.filter((it) => it.subscribed).length,
  }
  return { items, counts, warnings: [...campus.warnings, ...personal.warnings] }
}

/** Agenda completa de una vez, sin caché. */
export async function fetchAgenda(
  accessToken: string,
  { campusId, userId, from, to }: Range & { campusId: number; userId: number },
): Promise<AgendaPayload> {
  const [campus, personal] = await Promise.all([
    fetchCampusAgenda(accessToken, { campusId, from, to }),
    fetchPersonalAgenda(accessToken, { userId, from, to }),
  ])
  return mergeAgenda(campus, personal)
}
