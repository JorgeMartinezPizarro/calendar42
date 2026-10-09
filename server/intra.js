// Cliente mínimo de la API de la intra de 42 (https://api.intra.42.fr).
// Flujo OAuth "authorization code": el usuario inicia sesión en la intra y el
// backend intercambia el código por un token que nunca sale del servidor.

const INTRA_BASE = 'https://api.intra.42.fr'
const PAGE_SIZE = 100

// Scopes: `public` para eventos/exámenes del campus, `projects` para slots y
// correcciones del usuario, `profile` para apuntarse y borrarse de eventos
// (la intra lo exige para crear y borrar datos del usuario). La app registrada
// en la intra debe tenerlos activados; si le falta alguno, el login falla.
export const OAUTH_SCOPES = 'public projects profile'

export function hasAppCredentials() {
  return Boolean(process.env.FT_CLIENT_ID && process.env.FT_CLIENT_SECRET)
}

export function redirectUri() {
  return process.env.FT_REDIRECT_URI || 'http://localhost:5173/api/auth/callback'
}

export function authorizeUrl(state) {
  const url = new URL(`${INTRA_BASE}/oauth/authorize`)
  url.searchParams.set('client_id', process.env.FT_CLIENT_ID)
  url.searchParams.set('redirect_uri', redirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', OAUTH_SCOPES)
  url.searchParams.set('state', state)
  return url.toString()
}

async function tokenRequest(params) {
  const res = await fetch(`${INTRA_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.FT_CLIENT_ID,
      client_secret: process.env.FT_CLIENT_SECRET,
      ...params,
    }),
  })
  if (!res.ok) {
    const err = new Error(`La intra rechazó la petición de token (${res.status})`)
    err.status = res.status
    err.transient = res.status === 429 || res.status >= 500
    throw err
  }
  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope ?? '',
  }
}

export function exchangeCode(code) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() })
}

export function refreshTokens(refreshToken) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

// Token de la aplicación (client_credentials), sin usuario. Sirve para recursos
// que la intra no deja leer a los estudiantes con su propio token.
let appToken = null // { accessToken, expiresAt }

export async function getAppToken() {
  if (appToken && appToken.expiresAt > Date.now() + 30_000) return appToken.accessToken
  appToken = await tokenRequest({ grant_type: 'client_credentials' })
  return appToken.accessToken
}

// ---------------------------------------------------------------------------
// Limitador: la intra permite 2 peticiones por segundo por aplicación.
// Encadenamos todas las llamadas con un mínimo de 520 ms entre inicios.
// ---------------------------------------------------------------------------

const MIN_GAP_MS = 600
const RETRY_DELAYS_MS = [1500, 3000] // reintentos ante 429
let lastStart = 0
let queue = Promise.resolve()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function throttled(fn) {
  const run = queue.then(async () => {
    const wait = lastStart + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastStart = Date.now()
    return fn()
  })
  // La cola nunca se rompe aunque una petición falle.
  queue = run.catch(() => {})
  return run
}

async function fetchWithRetry(url, options) {
  let res = await throttled(() => fetch(url, options))
  for (const delay of RETRY_DELAYS_MS) {
    if (res.status !== 429) break
    await sleep(delay)
    res = await throttled(() => fetch(url, options))
  }
  return res
}

export function intraGet(accessToken, path, params = {}) {
  return intraRequest(accessToken, path, { params })
}

/** Errores de validación de la intra ({ campo: ['mensaje'] }) en una línea. */
function describeErrors(errors) {
  if (!errors || typeof errors !== 'object') return null
  return Object.entries(errors)
    .map(([field, msgs]) => `${field}: ${[].concat(msgs).join(', ')}`)
    .join('; ')
}

/**
 * Petición genérica a la intra. `body` (objeto) se envía como JSON. Las
 * respuestas sin cuerpo (204, p. ej. al borrar) devuelven null.
 */
export async function intraRequest(accessToken, path, { method = 'GET', params = {}, body } = {}) {
  const url = new URL(`${INTRA_BASE}/v2${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const options = { method, headers: { Authorization: `Bearer ${accessToken}` } }
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }
  const label = method === 'GET' ? path : `${method} ${path}`
  let res
  try {
    res = await fetchWithRetry(url, options)
  } catch (netErr) {
    // Conexión cortada, DNS, etc.: la intra no ha respondido.
    const err = new Error(`La intra no respondió en ${label} (${netErr.cause?.code ?? netErr.message})`)
    err.status = 503
    err.path = path
    err.transient = true
    throw err
  }
  if (res.status >= 520 && res.status <= 530) {
    // Códigos de Cloudflare: el origen de la intra está caído o saturado.
    const err = new Error(`La intra no está disponible ahora mismo (${res.status})`)
    err.status = res.status
    err.path = path
    err.transient = true
    throw err
  }
  if (!res.ok) {
    // La intra explica el motivo en el cuerpo (p. ej. "insufficient_scope").
    let reason = ''
    try {
      const text = (await res.text()).trim()
      if (text.startsWith('<')) {
        reason = res.status === 404 ? 'ruta inexistente' : 'respuesta HTML'
      } else if (text) {
        try {
          const body = JSON.parse(text)
          reason = body.message ?? body.error_description ?? body.error ?? describeErrors(body.errors) ?? text
        } catch {
          reason = text
        }
      }
    } catch {
      // sin cuerpo legible
    }
    const detail = reason ? `: ${String(reason).slice(0, 200)}` : ''
    const err = new Error(`Error de la intra en ${label} (${res.status}${detail})`)
    err.status = res.status
    err.path = path
    err.reason = reason
    err.transient = res.status === 429 || res.status >= 500
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

/** Recorre todas las páginas de un listado filtrado por begin_at. */
async function fetchAllInRange(accessToken, path, { from, to }, extraParams = {}) {
  const items = []
  let page = 1

  while (true) {
    const batch = await intraGet(accessToken, path, {
      'range[begin_at]': `${from.toISOString()},${to.toISOString()}`,
      'page[size]': PAGE_SIZE,
      'page[number]': page,
      sort: 'begin_at',
      ...extraParams,
    })
    items.push(...batch)
    if (batch.length < PAGE_SIZE) break
    page += 1
  }

  return items
}

// ---------------------------------------------------------------------------
// Usuario
// ---------------------------------------------------------------------------

export async function fetchMe(accessToken) {
  const me = await intraGet(accessToken, '/me')
  const primary = me.campus_users?.find((c) => c.is_primary)
  const campusId = primary?.campus_id ?? me.campus?.[0]?.id ?? null
  const cursus = pickCurrentCursus(me.cursus_users)
  return {
    id: me.id,
    login: me.login,
    displayName: me.displayname ?? me.login,
    image: me.image?.versions?.small ?? me.image?.link ?? null,
    campusId,
    coalition: await fetchMyCoalition(accessToken, me.id, { campusId, cursusId: cursus?.id ?? null }),
  }
}

// Cursus principal de 42. Si el usuario está en él, manda sobre cualquier
// piscina o discovery, aunque estas sean más recientes.
const MAIN_CURSUS_SLUG = '42cursus'

/**
 * Cursus "actual" del usuario a partir de `cursus_users` de `/me`: el 42cursus
 * si lo tiene; si no (p. ej. un pisciner), el más reciente, dando prioridad a
 * los que siguen abiertos (sin `end_at` o con `end_at` en el futuro).
 */
export function pickCurrentCursus(cursusUsers) {
  if (!Array.isArray(cursusUsers) || cursusUsers.length === 0) return null
  const now = Date.now()
  const isOpen = (cu) => !cu.end_at || (Date.parse(cu.end_at) || 0) > now
  const beginAt = (cu) => Date.parse(cu.begin_at) || 0
  const chosen =
    cursusUsers.find((cu) => cu.cursus?.slug === MAIN_CURSUS_SLUG) ??
    [...cursusUsers].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || beginAt(b) - beginAt(a))[0]
  const id = chosen.cursus_id ?? chosen.cursus?.id ?? null
  if (id == null) return null
  return { id, name: chosen.cursus?.name ?? null, slug: chosen.cursus?.slug ?? null }
}

/** Normaliza una coalición de la intra a { id, name, slug, color, image, cover }. */
export function normalizeCoalition(raw) {
  if (!raw) return null
  const color = typeof raw.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(raw.color.trim())
    ? raw.color.trim()
    : null
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
export async function fetchMyCoalition(accessToken, userId, { campusId = null, cursusId = null } = {}) {
  try {
    const raw = await intraGet(accessToken, `/users/${userId}/coalitions`)
    const list = Array.isArray(raw) ? raw.map(normalizeCoalition).filter(Boolean) : []
    if (list.length === 0) return null
    const fallback = () => list.find((c) => c.color) ?? list[0]
    if (list.length === 1 || cursusId == null) return fallback()

    const ofCursus = await fetchCoalitionIdsOfCursus(accessToken, { campusId, cursusId })
    return list.find((c) => ofCursus.has(c.id)) ?? fallback()
  } catch (err) {
    console.warn('[coalition] no se pudo obtener la coalición:', err.message)
    return null
  }
}

/**
 * Ids de las coaliciones de los blocs de un cursus (y de un campus, si se conoce).
 * Un bloc agrupa las coaliciones de un cursus en un campus.
 */
async function fetchCoalitionIdsOfCursus(accessToken, { campusId, cursusId }) {
  const params = { 'filter[cursus_id]': cursusId, 'page[size]': PAGE_SIZE }
  if (campusId != null) params['filter[campus_id]'] = campusId
  const ids = new Set()
  try {
    const blocs = await intraGet(accessToken, '/blocs', params)
    for (const bloc of Array.isArray(blocs) ? blocs : []) {
      for (const c of bloc.coalitions ?? []) ids.add(c.id)
    }
  } catch (err) {
    console.warn('[coalition] no se pudieron consultar los blocs del cursus:', err.message)
  }
  return ids
}

// ---------------------------------------------------------------------------
// Normalización a un formato común de "elemento de agenda":
// { id, type, kind, name, description, location, beginAt, endAt, ... }
// type: 'event' | 'exam' | 'slot' | 'correction'
// ---------------------------------------------------------------------------

export function normalizeEvent(raw) {
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
    maxPeople: raw.max_people > 0 ? raw.max_people : null, // 0 o null: sin límite
    subscribers: raw.nbr_subscribers ?? 0,
    // Horas antes del inicio a partir de las cuales la intra no deja borrarse.
    cancellationLimitHours: Number(raw.prohibition_of_cancellation) || 0,
  }
}

export function normalizeExam(raw) {
  const projects = [...new Set((raw.projects ?? []).map((p) => p.name).filter(Boolean))]
  const cursus = [...new Set((raw.cursus ?? []).map((c) => c.name).filter(Boolean))]
  const details = []
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
    maxPeople: raw.max_people > 0 ? raw.max_people : null, // 0 o null: sin límite
    subscribers: raw.nbr_subscribers ?? 0,
  }
}

/**
 * La intra devuelve los slots troceados en bloques de 15 minutos. Fusionamos
 * los libres contiguos (scale_team == null) en un único bloque.
 */
export function normalizeOpenSlots(rawSlots) {
  const free = rawSlots
    .filter((s) => s.scale_team == null)
    .sort((a, b) => a.begin_at.localeCompare(b.begin_at))

  const merged = []
  for (const s of free) {
    const last = merged[merged.length - 1]
    if (last && last.end_at === s.begin_at) {
      last.end_at = s.end_at
      last.ids.push(s.id)
    } else {
      merged.push({ begin_at: s.begin_at, end_at: s.end_at, ids: [s.id] })
    }
  }

  return merged.map((s) => ({
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

function userLogin(u) {
  return u && typeof u === 'object' ? u.login : null
}

function projectNameFromGitlabPath(path) {
  if (!path) return null
  const last = path.split('/').filter(Boolean).pop()
  return last ? last.replace(/[-_]/g, ' ') : null
}

export function normalizeScaleTeam(raw, myId, projectName) {
  const correctorLogin = userLogin(raw.corrector)
  const correctedLogins = Array.isArray(raw.correcteds)
    ? raw.correcteds.map(userLogin).filter(Boolean)
    : []
  const amCorrector = raw.corrector && typeof raw.corrector === 'object' && raw.corrector.id === myId
  const role = amCorrector ? 'corrector' : 'corrected'

  const durationSec = raw.scale?.duration ?? 1800
  const begin = new Date(raw.begin_at)
  const end = new Date(begin.getTime() + durationSec * 1000)

  const details = []
  details.push(role === 'corrector' ? 'Tú corriges' : 'Te corrigen')
  if (correctorLogin) details.push(`Corrector: ${correctorLogin}`)
  if (correctedLogins.length) details.push(`Corregidos: ${correctedLogins.join(', ')}`)
  if (raw.team?.name) details.push(`Equipo: ${raw.team.name}`)
  if (raw.filled_at) details.push(`Evaluación entregada${raw.final_mark != null ? ` · nota ${raw.final_mark}` : ''}`)

  const project = projectName ?? projectNameFromGitlabPath(raw.team?.project_gitlab_path) ?? raw.team?.name ?? 'Proyecto'

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
export async function fetchCampusEvents(accessToken, { campusId, from, to }) {
  const raw = await fetchAllInRange(accessToken, `/campus/${campusId}/events`, { from, to })
  return raw.map(normalizeEvent)
}

/**
 * Exámenes del campus cuyo inicio cae en [from, to).
 * La intra responde 403 a los estudiantes con su propio token en todos los
 * endpoints de exámenes, pero el token de la aplicación (client_credentials)
 * sí puede leerlos, así que usamos ese.
 */
export async function fetchCampusExams({ campusId, from, to }) {
  const token = await getAppToken()
  const raw = await fetchAllInRange(token, `/campus/${campusId}/exams`, { from, to })
  return raw.map(normalizeExam)
}

/**
 * Ids de los eventos a los que el usuario está inscrito, con inicio en [from, to).
 * `/users/:id/events` devuelve directamente los eventos del usuario.
 */
export async function fetchMyEventIds(accessToken, { userId, from, to }) {
  const raw = await fetchAllInRange(accessToken, `/users/${userId}/events`, { from, to })
  return new Set(raw.map((e) => e.id))
}

/**
 * Ids de los exámenes en los que el usuario está inscrito, con inicio en [from, to).
 * Como el resto de rutas de exámenes, `/users/:id/exams` devuelve 403 con el token
 * del estudiante pero funciona con el de la aplicación.
 */
export async function fetchMyExamIds({ userId, from, to }) {
  const token = await getAppToken()
  const raw = await fetchAllInRange(token, `/users/${userId}/exams`, { from, to })
  return new Set(raw.map((e) => e.id))
}

// ---------------------------------------------------------------------------
// Inscripción a eventos
// ---------------------------------------------------------------------------

/** Un evento concreto ya normalizado, o null si no se puede releer. */
async function fetchEventOrNull(accessToken, eventId) {
  try {
    return normalizeEvent(await intraGet(accessToken, `/events/${eventId}`))
  } catch (err) {
    console.warn('[events] no se pudo releer el evento:', err.message)
    return null
  }
}

/**
 * Inscribe al usuario en un evento (`POST /events_users`). La intra valida
 * aforo y fechas: si rechaza la inscripción, el error lleva su motivo en
 * `reason`. Devuelve el evento actualizado (o null si no se pudo releer).
 */
export async function subscribeToEvent(accessToken, { eventId, userId }) {
  await intraRequest(accessToken, '/events_users', {
    method: 'POST',
    body: { events_user: { event_id: eventId, user_id: userId } },
  })
  return fetchEventOrNull(accessToken, eventId)
}

/**
 * Borra la inscripción del usuario a un evento. Hace falta el id de la
 * inscripción (`events_user`), que buscamos en `/users/:id/events_users`.
 */
export async function unsubscribeFromEvent(accessToken, { eventId, userId }) {
  const list = await intraGet(accessToken, `/users/${userId}/events_users`, {
    'filter[event_id]': eventId,
    'page[size]': PAGE_SIZE,
  })
  const subscription = (Array.isArray(list) ? list : []).find(
    (eu) => eu.event_id === eventId || eu.event?.id === eventId,
  )
  if (!subscription) {
    throw Object.assign(new Error('No estás inscrito en este evento'), { status: 404 })
  }
  await intraRequest(accessToken, `/events_users/${subscription.id}`, { method: 'DELETE' })
  return fetchEventOrNull(accessToken, eventId)
}

/** Slots de corrección abiertos del usuario en [from, to). Requiere scope `projects`. */
export async function fetchMyOpenSlots(accessToken, { from, to }) {
  const raw = await fetchAllInRange(accessToken, '/me/slots', { from, to })
  return normalizeOpenSlots(raw)
}

// Nombres de proyecto cacheados en memoria (cambian muy poco).
const projectNames = new Map()

async function resolveProjectName(accessToken, projectId) {
  if (!projectId) return null
  if (projectNames.has(projectId)) return projectNames.get(projectId)
  try {
    const project = await intraGet(accessToken, `/projects/${projectId}`)
    projectNames.set(projectId, project.name)
    return project.name
  } catch {
    return null
  }
}

/** Correcciones (como corrector o corregido) del usuario en [from, to). Requiere scope `projects`. */
export async function fetchMyCorrections(accessToken, { userId, from, to }) {
  const raw = await fetchAllInRange(accessToken, '/me/scale_teams', { from, to })

  // Resolvemos nombres de proyecto solo cuando el team no trae gitlab path.
  const missing = [...new Set(
    raw
      .filter((st) => !st.team?.project_gitlab_path && st.team?.project_id)
      .map((st) => st.team.project_id),
  )]
  for (const id of missing) await resolveProjectName(accessToken, id)

  return raw.map((st) => normalizeScaleTeam(st, userId, projectNames.get(st.team?.project_id) ?? null))
}

/**
 * Agenda completa: eventos + exámenes del campus, slots abiertos y
 * correcciones del usuario. Si una fuente falla (p. ej. falta el scope),
 * devolvemos el resto y un aviso en `warnings`.
 */
export async function fetchAgenda(accessToken, { campusId, userId, from, to }) {
  const sources = [
    ['event', () => fetchCampusEvents(accessToken, { campusId, from, to })],
    ['exam', () => fetchCampusExams({ campusId, from, to })],
    ['slot', () => fetchMyOpenSlots(accessToken, { from, to })],
    ['correction', () => fetchMyCorrections(accessToken, { userId, from, to })],
    ['myEvents', () => fetchMyEventIds(accessToken, { userId, from, to })],
    ['myExams', () => fetchMyExamIds({ userId, from, to })],
  ]
  const MEMBERSHIP_SOURCES = new Set(['myEvents', 'myExams'])

  const results = await Promise.allSettled(sources.map(([, fn]) => fn()))

  const items = []
  const counts = {}
  const warnings = []
  let myEventIds = new Set()
  let myExamIds = new Set()

  results.forEach((result, i) => {
    const type = sources[i][0]
    if (result.status === 'fulfilled') {
      if (type === 'myEvents') {
        myEventIds = result.value
        return
      }
      if (type === 'myExams') {
        myExamIds = result.value
        return
      }
      counts[type] = result.value.length
      items.push(...result.value)
    } else {
      const err = result.reason
      if (err.status === 401) throw err // sesión caducada: lo gestiona el llamador
      if (!MEMBERSHIP_SOURCES.has(type)) counts[type] = 0
      if (err.status === 403 && (type === 'slot' || type === 'correction')) {
        warnings.push({
          type,
          code: 'missing_scope',
          message: 'La sesión no tiene el scope "projects". Cierra sesión y vuelve a entrar.',
        })
      } else {
        warnings.push({
          type,
          code: err.transient ? 'transient_error' : 'source_error',
          message: err.message,
        })
      }
    }
  })

  // Marcamos las inscripciones del usuario.
  for (const it of items) {
    if (it.type === 'event') it.subscribed = myEventIds.has(Number(it.id.replace('event-', '')))
    else if (it.type === 'exam') it.subscribed = myExamIds.has(Number(it.id.replace('exam-', '')))
  }
  counts.myEvents = items.filter((it) => it.type === 'event' && it.subscribed).length
  counts.myExams = items.filter((it) => it.type === 'exam' && it.subscribed).length

  items.sort((a, b) => a.beginAt.localeCompare(b.beginAt))
  return { items, counts, warnings }
}
