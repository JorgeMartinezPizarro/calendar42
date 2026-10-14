import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AgendaItem, SessionUser } from '../shared/types.ts'
import { createCache } from './cache.ts'
import {
  INTRA_HOURLY_LIMIT,
  OAUTH_SCOPES,
  authorizeUrl,
  bookCorrection,
  createSlot,
  deleteSlots,
  exchangeCode,
  fetchCampusAgenda,
  fetchCampusEvents,
  fetchMe,
  fetchMyEventIds,
  fetchMyProjects,
  fetchPersonalAgenda,
  fetchProjectSlots,
  hasAppCredentials,
  intraBudgetLow,
  intraCallsLastHour,
  isNotAuthorized,
  mergeAgenda,
  refreshTokens,
  revokeToken,
  subscribeToEvent,
  unsubscribeFromEvent,
  type CampusAgenda,
  type PersonalAgenda,
} from './intra.ts'
import {
  mockAgenda,
  mockBookCorrection,
  mockCoalition,
  mockCreateSlot,
  mockDeleteSlots,
  mockOverlaps,
  mockProjectSlots,
  mockProjects,
  mockSetExamSubscription,
  mockSetSubscription,
  mockSlotsTooClose,
  newDemoState,
  SLOT_GAP_MINUTES,
  type DemoState,
} from './mock.ts'
import {
  DEMO_SESSION_TTL_MS,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  STATE_COOKIE,
  clearCookie,
  createSession,
  destroySession,
  flushSessions,
  onSessionDiscarded,
  requireSession,
  saveSession,
  sessionMiddleware,
  sessionOf,
  setCookie,
} from './sessions.ts'
import { msg, render } from './messages.ts'
import { asHttpError, httpError, type HttpError, type Session } from './types.ts'

const app = express()
const PORT = Number(process.env.PORT) || 3112
const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const DEFAULT_CAMPUS_ID = Number(process.env.FT_CAMPUS_ID) || 22 // 42 Madrid
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

// Cabeceras de seguridad: nadie puede cargar la app dentro de un iframe (y
// hacer pulsar "Apuntarme" a alguien sin que lo vea), ni el navegador debe
// adivinar tipos de fichero, ni las URLs internas salen en el Referer.
app.use((_req, res, next) => {
  res.set({
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  })
  next()
})

/**
 * Las peticiones que cambian algo (POST, DELETE...) solo se aceptan desde la
 * propia app. La cookie es SameSite=Lax, que frena a otros dominios pero no a
 * otro subdominio del mismo (otra app de ideniox.com, por ejemplo), y
 * apuntarse a un evento no necesita cuerpo: un formulario ajeno podría
 * hacerlo. Los navegadores mandan Origin en estas peticiones; sin Origin no
 * es un navegador y no lleva la cookie de nadie.
 */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  if (origin === new URL(APP_URL).origin) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' || sameOrigin(req)) {
    next()
    return
  }
  res.status(403).json({ error: msg(req).originNotAllowed })
})

app.use(express.json())
app.use(sessionMiddleware)

// Caché en memoria (ver cache.ts). Lo del campus es igual para todos los
// alumnos y cambia poco; lo personal se invalida además con cada acción del
// usuario. Pasado el tiempo en fresco se sirve caducado y se renueva detrás.
const TTL_MS = {
  campus: 15 * 60_000,
  personal: 5 * 60_000,
  projects: 10 * 60_000,
  freeSlots: 2 * 60_000,
}
const cache = createCache({ isLowBudget: intraBudgetLow })

// Un resultado con fallos pasajeros (intra caída, 429…) no se guarda: así la
// siguiente petición vuelve a intentarlo enseguida.
const withoutTransientFailures = (value: CampusAgenda | PersonalAgenda) =>
  !value.warnings.some((w) => w.code === 'transient_error')

/** Fecha de un parámetro: `fallback` si falta, null si no es una fecha válida. */
function parseDate(value: unknown, fallback: Date | null): Date | null {
  if (!value) return fallback
  if (typeof value !== 'string') return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Cuerpo JSON de la petición como objeto (vacío si no lo es). */
function bodyOf(req: Request): Record<string, unknown> {
  const body: unknown = req.body
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
}

// Refresco del token en curso por sesión. La app pide varias cosas a la vez
// (meses de agenda, eventos, proyectos); si el token acaba de caducar, todas
// esperan al mismo refresco. Si cada una refrescara por su cuenta gastarían el
// mismo refresh token varias veces, la intra rechazaría las siguientes y la
// sesión se cerraría sin motivo.
const refreshing = new WeakMap<Session, Promise<string>>()

/** Devuelve un access token válido para la sesión, refrescándolo si caducó. */
async function validAccessToken(session: Session): Promise<string> {
  const { tokens } = session
  if (!tokens) throw httpError('Sesión sin tokens de la intra', { status: 401 })
  if (tokens.expiresAt > Date.now() + 30_000) return tokens.accessToken
  const { refreshToken } = tokens
  if (!refreshToken) throw httpError('Sesión caducada', { status: 401 })

  let pending = refreshing.get(session)
  if (!pending) {
    pending = refreshTokens(refreshToken)
      .then((fresh) => {
        // Si la intra no manda refresh token nuevo, el anterior sigue valiendo.
        session.tokens = { ...fresh, refreshToken: fresh.refreshToken ?? refreshToken }
        saveSession()
        return fresh.accessToken
      })
      .finally(() => refreshing.delete(session))
    refreshing.set(session, pending)
  }
  return pending
}

/**
 * Estado del demo de esta sesión (ver mock.ts). Se crea al entrar al demo; las
 * sesiones demo anteriores a este cambio lo reciben la primera vez que hace falta.
 */
function demoStateOf(session: Session): DemoState {
  if (!session.demoState) session.demoState = newDemoState()
  return session.demoState
}

// Una sesión que se descarta (salir, nuevo login, caducidad) deja de valer
// también en la intra: se revocan sus tokens. Así una copia vieja del almacén
// de sesiones, o un token que se haya filtrado, no sirve para nada.
onSessionDiscarded(async (session) => {
  if (!session.tokens || !hasAppCredentials()) return
  const { accessToken, refreshToken } = session.tokens
  // Cada token por separado: si uno falla, el otro se intenta igual.
  const pending: [string, 'access_token' | 'refresh_token'][] = [[accessToken, 'access_token']]
  if (refreshToken) pending.unshift([refreshToken, 'refresh_token'])
  for (const [token, hint] of pending) {
    try {
      await revokeToken(token, hint)
    } catch (err) {
      console.warn(`[sessions] no se pudo revocar un token de ${session.user.login}:`, asHttpError(err).message)
    }
  }
})

function sessionExpired(req: Request, res: Response): void {
  void destroySession(req.sessionId)
  clearCookie(res, SESSION_COOKIE)
  res.status(401).json({ error: msg(req).sessionExpired })
}

/** Texto para el usuario de un error, en el idioma de la petición. */
function errorText(req: Request, err: HttpError): string {
  return err.code ? render(msg(req), err.code) : err.message
}

/** 409 si lo que se va a añadir a la agenda demo pisa algo que ya está. */
function rejectDemoOverlap(req: Request, res: Response, session: Session, begin: Date, end: Date): boolean {
  const overlaps = mockOverlaps(demoStateOf(session), begin, end)
  if (!overlaps.length) return false
  const names = overlaps.map((it) => it.name).join(', ')
  res.status(409).json({ error: msg(req).overlaps(names) })
  return true
}

// Estado de la intra -> estado con el que responde la API propia.
const STATUS_FOR: Record<number, number> = { 400: 400, 401: 403, 403: 403, 404: 404, 422: 409 }

/**
 * Responde un fallo de la intra con un mensaje claro y lo deja en el log con
 * la respuesta completa. `hint` se añade cuando la intra no autoriza la acción.
 */
function sendIntraFailure(
  req: Request,
  res: Response,
  error: unknown,
  what: string,
  { hint = '' }: { hint?: string } = {},
): void {
  const err: HttpError = asHttpError(error)
  console.error(`[${what}] ${req.session?.user.login ?? '?'}:`, err.message)
  if (err.body) console.error(`[${what}] respuesta de la intra:`, err.body)
  if (err.status === 401 && !isNotAuthorized(err)) return sessionExpired(req, res)
  const status = (err.status != null ? STATUS_FOR[err.status] : undefined) ?? 502
  // Sin el scope necesario la intra responde 403 "Insufficient scope".
  const missingScope = err.status === 403 && /scope/i.test(String(err.reason))
  const m = msg(req)
  let message: string
  if (missingScope) {
    message = m.missingScope(String(err.reason))
  } else if (isNotAuthorized(err)) {
    message = m.notAuthorized(err.status, String(err.reason), hint)
  } else if (err.reason) {
    message = m.notAccepted(err.reason)
  } else {
    message = errorText(req, err)
  }
  res.status(status).json({ error: message })
}

/** Respuesta genérica a un fallo al leer de la intra (agenda, eventos...). */
function sendReadFailure(req: Request, res: Response, error: unknown, what: string): void {
  const err = asHttpError(error)
  console.error(`[${what}]`, err.message)
  if (err.status === 401) return sessionExpired(req, res)
  res.status(502).json({ error: errorText(req, err) })
}

// ---------------------------------------------------------------------------
// Estado / salud
// ---------------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    authConfigured: hasAppCredentials(),
    demoAvailable: true,
    scopes: OAUTH_SCOPES,
    // Llamadas a la intra en la última hora frente al límite, y estado de la caché.
    intra: { callsLastHour: intraCallsLastHour(), hourlyLimit: INTRA_HOURLY_LIMIT, budgetLow: intraBudgetLow() },
    cache: cache.stats(),
  })
})

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

app.get('/api/auth/me', (req, res) => {
  if (!req.session) {
    res.status(401).json({
      error: msg(req).notLoggedIn,
      authConfigured: hasAppCredentials(),
      demoAvailable: true,
    })
    return
  }
  res.json({
    user: req.session.user,
    demo: Boolean(req.session.demo),
    scope: req.session.tokens?.scope ?? null,
  })
})

// Paso 1: redirigir a la pantalla de autorización de la intra.
app.get('/api/auth/login', (req, res) => {
  if (!hasAppCredentials()) {
    res.status(503).json({ error: msg(req).oauthNotConfigured })
    return
  }
  const state = randomUUID()
  setCookie(res, STATE_COOKIE, state, { maxAgeMs: 10 * 60 * 1000 })
  res.redirect(authorizeUrl(state))
})

// Paso 2: la intra vuelve con ?code&state; lo cambiamos por un token.
app.get('/api/auth/callback', async (req, res) => {
  const { code, state, error } = req.query
  const expectedState = req.cookies[STATE_COOKIE]
  clearCookie(res, STATE_COOKIE)

  if (typeof error === 'string' && error) {
    res.redirect(`${APP_URL}/?auth_error=${encodeURIComponent(error)}`)
    return
  }
  if (typeof code !== 'string' || !code || typeof state !== 'string' || state !== expectedState) {
    res.redirect(`${APP_URL}/?auth_error=state`)
    return
  }

  try {
    const tokens = await exchangeCode(code)
    const user = await fetchMe(tokens.accessToken)
    await destroySession(req.sessionId)
    const id = createSession({ user, tokens, demo: false }, SESSION_TTL_MS)
    setCookie(res, SESSION_COOKIE, id, { maxAgeMs: SESSION_TTL_MS })
    res.redirect(`${APP_URL}/`)
  } catch (err) {
    console.error('[auth/callback]', asHttpError(err).message)
    res.redirect(`${APP_URL}/?auth_error=exchange`)
  }
})

// Modo demo: siempre disponible, también con credenciales, para poder enseñar
// la aplicación aunque la intra esté caída o rechace las peticiones. Cada
// entrada empieza con un estado limpio, propio de la sesión.
app.post('/api/auth/demo', async (req, res) => {
  await destroySession(req.sessionId)
  const user: SessionUser = {
    id: 0,
    login: 'demo',
    displayName: 'Estudiante demo',
    image: null,
    campusId: DEFAULT_CAMPUS_ID,
    // El demo es de 42 Madrid: sus datos de ejemplo son de ese campus.
    campus: { id: DEFAULT_CAMPUS_ID, name: 'Madrid', country: 'Spain' },
    coalition: mockCoalition(),
  }
  const id = createSession({ user, tokens: null, demo: true, demoState: newDemoState() }, DEMO_SESSION_TTL_MS)
  setCookie(res, SESSION_COOKIE, id, { maxAgeMs: DEMO_SESSION_TTL_MS })
  res.json({ user, demo: true })
})

// Responde cuando los tokens ya están revocados en la intra.
app.post('/api/auth/logout', async (req, res) => {
  await destroySession(req.sessionId)
  clearCookie(res, SESSION_COOKIE)
  res.json({ ok: true })
})

// Fotos de usuario: el CDN de la intra solo las sirve con el token del usuario
// (sin él responde 403), así que el navegador no puede pedirlas directamente.
// Se piden aquí con el token de la sesión y se guardan un rato en memoria.
const AVATAR_TTL_MS = 6 * 60 * 60_000
const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_MAX_ENTRIES = 300
const avatars = new Map<number, { url: string; type: string; body: Buffer; expires: number }>()

/** La foto del usuario de la sesión. Solo su propia URL, y solo del CDN de la intra. */
app.get('/api/auth/avatar', requireSession, async (req, res) => {
  const session = sessionOf(req)
  const url = session.user.image
  let host = ''
  try {
    host = url ? new URL(url).host : ''
  } catch {
    // URL inválida
  }
  if (session.demo || !url || !url.startsWith('https://') || host !== 'cdn.intra.42.fr') {
    res.status(404).end()
    return
  }

  const now = Date.now()
  let entry = avatars.get(session.user.id)
  if (!entry || entry.url !== url || entry.expires <= now) {
    try {
      const token = await validAccessToken(session)
      const cdn = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const type = (cdn.headers.get('content-type') ?? '').split(';')[0]
      const body = Buffer.from(await cdn.arrayBuffer())
      if (!cdn.ok || !type.startsWith('image/') || body.length > AVATAR_MAX_BYTES) {
        console.warn(`[avatar] ${session.user.login}: el CDN respondió ${cdn.status} (${type || 'sin tipo'}, ${body.length} bytes)`)
        res.status(404).end()
        return
      }
      entry = { url, type, body, expires: now + AVATAR_TTL_MS }
      avatars.delete(session.user.id)
      avatars.set(session.user.id, entry)
      // Se descartan las más antiguas por encima del límite (el Map guarda el orden de alta).
      for (const key of avatars.keys()) {
        if (avatars.size <= AVATAR_MAX_ENTRIES) break
        avatars.delete(key)
      }
    } catch (err) {
      const e = asHttpError(err)
      if (e.status === 401) return sessionExpired(req, res)
      console.warn(`[avatar] ${session.user.login}:`, e.message)
      res.status(404).end()
      return
    }
  }
  res.set({ 'Content-Type': entry.type, 'Cache-Control': 'private, max-age=3600' }).send(entry.body)
})

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

/**
 * GET /api/agenda?from=ISO&to=ISO
 * Todo lo que cae en [from, to) para el usuario: eventos y exámenes de su
 * campus (caché compartida por campus), sus slots de corrección abiertos, sus
 * correcciones planificadas y sus inscripciones (caché por usuario).
 * Respuesta: { source, campusId, cache, items, counts, warnings }
 */
app.get('/api/agenda', requireSession, async (req, res) => {
  const now = new Date()
  const from = parseDate(req.query.from, new Date(now.getTime() - 7 * 86_400_000))
  const to = parseDate(req.query.to, new Date(now.getTime() + 60 * 86_400_000))

  if (!from || !to) {
    res.status(400).json({ error: msg(req).invalidRange })
    return
  }
  if (to <= from) {
    res.status(400).json({ error: msg(req).toBeforeFrom })
    return
  }

  const session = sessionOf(req)
  const campusId = session.user.campusId ?? DEFAULT_CAMPUS_ID
  if (session.demo) {
    res.json({ source: 'mock', campusId, ...mockAgenda(demoStateOf(session), { from, to }) })
    return
  }

  const range = `${from.toISOString()}:${to.toISOString()}`
  try {
    const token = await validAccessToken(session)
    const [campus, personal] = await Promise.all([
      cache.cached(
        `campus:${campusId}:${range}`,
        { ttlMs: TTL_MS.campus, store: withoutTransientFailures },
        () => fetchCampusAgenda(token, { campusId, from, to }),
      ),
      cache.cached(
        `personal:${session.user.id}:${range}`,
        { ttlMs: TTL_MS.personal, store: withoutTransientFailures },
        () => fetchPersonalAgenda(token, { userId: session.user.id, from, to }),
      ),
    ])
    res.json({
      source: 'intra',
      campusId,
      cache: { campus: campus.state, personal: personal.state },
      ...mergeAgenda(campus.value, personal.value),
    })
  } catch (err) {
    sendReadFailure(req, res, err, 'agenda')
  }
})

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------

/**
 * GET /api/projects
 * Proyectos del usuario en su cursus con su estado. Los cerrados (pendientes
 * de corrección) son los que admiten agendar una corrección.
 * Respuesta: { projects: [...] }
 */
app.get('/api/projects', requireSession, async (req, res) => {
  const session = sessionOf(req)
  if (session.demo) {
    res.json({ projects: mockProjects() })
    return
  }

  try {
    const token = await validAccessToken(session)
    const { value } = await cache.cached(`projects:${session.user.id}`, { ttlMs: TTL_MS.projects }, () =>
      fetchMyProjects(token, { userId: session.user.id, cursusId: session.user.cursusId ?? null }),
    )
    res.json({ projects: value })
  } catch (error) {
    const err = asHttpError(error)
    console.error('[projects]', err.message)
    if (err.status === 401) return sessionExpired(req, res)
    const message = err.status === 403 ? msg(req).projectsForbidden : errorText(req, err)
    res.status(err.status === 403 ? 403 : 502).json({ error: message })
  }
})

// ---------------------------------------------------------------------------
// Inscripción a eventos
// ---------------------------------------------------------------------------

/**
 * Olvida lo personal cacheado de un usuario: su parte de la agenda y los slots
 * libres que consultó (tras apuntarse a algo, crear o borrar un slot, o
 * reservar una corrección). Lo del campus no cambia con esas acciones.
 */
function forgetPersonal(userId: number): void {
  cache.forget((key) => key.startsWith(`personal:${userId}:`) || key.startsWith(`pslots:${userId}:`))
}

/** Id numérico positivo de un parámetro de ruta, o null. */
function idParam(req: Request): number | null {
  const id = Number(req.params.id)
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * POST   /api/events/:id/subscription  → apuntarse al evento
 * DELETE /api/events/:id/subscription  → borrarse del evento
 * Respuesta: { ok, subscribed, subscribers } (subscribers puede ser null si
 * la intra no dejó releer el evento). Si la intra rechaza la operación
 * (aforo completo, plazo de cancelación...), 409 con su motivo.
 */
async function setSubscription(req: Request, res: Response, subscribed: boolean): Promise<void> {
  const eventId = idParam(req)
  if (eventId == null) {
    res.status(400).json({ error: msg(req).invalidEventId })
    return
  }
  const session = sessionOf(req)

  try {
    let event: AgendaItem | null = null
    if (session.demo) {
      mockSetSubscription(demoStateOf(session), eventId, subscribed)
      saveSession()
    } else {
      const token = await validAccessToken(session)
      const args = { eventId, userId: session.user.id }
      event = subscribed ? await subscribeToEvent(token, args) : await unsubscribeFromEvent(token, args)
    }
    forgetPersonal(session.user.id)
    res.json({ ok: true, subscribed, subscribers: event?.subscribers ?? null })
  } catch (err) {
    sendIntraFailure(req, res, err, `events ${subscribed ? 'alta' : 'baja'} ${eventId}`, {
      hint: msg(req).hintEventSignup,
    })
  }
}

// ---------------------------------------------------------------------------
// Slots propios y correcciones
// ---------------------------------------------------------------------------

/**
 * POST /api/slots  { beginAt, endAt }  → abre un slot de corrección propio.
 * Respuesta: { ok, items } con los bloques creados ya fusionados.
 */
app.post('/api/slots', requireSession, async (req, res) => {
  const body = bodyOf(req)
  const begin = parseDate(body.beginAt, null)
  const end = parseDate(body.endAt, null)
  if (!begin || !end || end <= begin) {
    res.status(400).json({ error: msg(req).invalidSlotRange })
    return
  }
  const session = sessionOf(req)
  try {
    let items: AgendaItem[]
    if (session.demo) {
      if (rejectDemoOverlap(req, res, session, begin, end)) return
      const near = mockSlotsTooClose(demoStateOf(session), begin, end)
      if (near.length) {
        res.status(409).json({ error: msg(req).slotGap(SLOT_GAP_MINUTES) })
        return
      }
      items = mockCreateSlot(demoStateOf(session), { begin, end })
      saveSession()
    } else {
      const token = await validAccessToken(session)
      items = await createSlot(token, {
        userId: session.user.id,
        beginAt: begin.toISOString(),
        endAt: end.toISOString(),
      })
    }
    forgetPersonal(session.user.id)
    res.json({ ok: true, items })
  } catch (err) {
    sendIntraFailure(req, res, err, 'slots alta')
  }
})

/** DELETE /api/slots  { ids: [...] }  → borra bloques de slot propios. */
app.delete('/api/slots', requireSession, async (req, res) => {
  const raw = bodyOf(req).ids
  const ids = Array.isArray(raw) ? raw.map(Number) : []
  if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    res.status(400).json({ error: msg(req).slotIdsRequired })
    return
  }
  const session = sessionOf(req)
  try {
    if (session.demo) {
      mockDeleteSlots(demoStateOf(session), ids)
      saveSession()
    } else {
      await deleteSlots(await validAccessToken(session), ids)
    }
    forgetPersonal(session.user.id)
    res.json({ ok: true })
  } catch (err) {
    sendIntraFailure(req, res, err, 'slots baja')
  }
})

/**
 * GET /api/projects/:id/slots?from&to  → franjas libres de otros estudiantes
 * para corregir ese proyecto. Respuesta: { items } (type 'free').
 */
app.get('/api/projects/:id/slots', requireSession, async (req, res) => {
  const projectId = idParam(req)
  const now = new Date()
  const from = parseDate(req.query.from, now)
  const to = parseDate(req.query.to, new Date(now.getTime() + 30 * 86_400_000))
  if (projectId == null) {
    res.status(400).json({ error: msg(req).invalidProjectId })
    return
  }
  if (!from || !to || to <= from) {
    res.status(400).json({ error: msg(req).invalidRange })
    return
  }
  const session = sessionOf(req)
  if (session.demo) {
    res.json({ items: mockProjectSlots({ projectId, from, to }) })
    return
  }

  try {
    const token = await validAccessToken(session)
    const key = `pslots:${session.user.id}:${projectId}:${from.toISOString()}:${to.toISOString()}`
    const { value } = await cache.cached(key, { ttlMs: TTL_MS.freeSlots }, () =>
      fetchProjectSlots(token, { projectId, userId: session.user.id, from, to }),
    )
    res.json({ items: value })
  } catch (err) {
    sendIntraFailure(req, res, err, `slots libres ${projectId}`, {
      hint: msg(req).hintProjectSlots,
    })
  }
})

/**
 * POST /api/corrections  { projectId, teamId, beginAt, correctorId? }
 * → reserva una corrección del proyecto en ese instante.
 */
app.post('/api/corrections', requireSession, async (req, res) => {
  const body = bodyOf(req)
  const projectId = Number(body.projectId)
  const teamId = Number(body.teamId)
  const begin = parseDate(body.beginAt, null)
  const correctorId = body.correctorId ? Number(body.correctorId) : null
  if (!Number.isInteger(projectId) || projectId <= 0 || !Number.isInteger(teamId) || teamId <= 0 || !begin) {
    res.status(400).json({ error: msg(req).bookingParamsRequired })
    return
  }
  const session = sessionOf(req)
  try {
    let item: AgendaItem | null = null
    if (session.demo) {
      if (rejectDemoOverlap(req, res, session, begin, new Date(begin.getTime() + 30 * 60_000))) return
      item = mockBookCorrection(demoStateOf(session), { projectId, beginAt: begin })
      saveSession()
    } else {
      await bookCorrection(await validAccessToken(session), {
        projectId,
        teamId,
        beginAt: begin.toISOString(),
        correctorId,
      })
    }
    forgetPersonal(session.user.id)
    res.json({ ok: true, item })
  } catch (err) {
    sendIntraFailure(req, res, err, `corrección ${projectId}`, {
      hint: msg(req).hintBooking,
    })
  }
})

/**
 * POST   /api/exams/:id/subscription  → apuntarse al examen
 * DELETE /api/exams/:id/subscription  → borrarse del examen
 * Solo en el modo demo: la intra no deja a un estudiante inscribirse a
 * exámenes por la API mientras el staff no autorice la aplicación, así que con
 * una sesión real responde 403 con ese motivo.
 */
function setExamSubscription(req: Request, res: Response, subscribed: boolean): void {
  const examId = idParam(req)
  if (examId == null) {
    res.status(400).json({ error: msg(req).invalidExamId })
    return
  }
  const session = sessionOf(req)
  if (!session.demo) {
    res.status(403).json({ error: msg(req).examSignupDisabled })
    return
  }
  mockSetExamSubscription(demoStateOf(session), examId, subscribed)
  saveSession()
  forgetPersonal(session.user.id)
  res.json({ ok: true, subscribed, subscribers: null })
}

app.post('/api/exams/:id/subscription', requireSession, (req, res) => setExamSubscription(req, res, true))
app.delete('/api/exams/:id/subscription', requireSession, (req, res) => setExamSubscription(req, res, false))

app.post('/api/events/:id/subscription', requireSession, (req, res) => setSubscription(req, res, true))
app.delete('/api/events/:id/subscription', requireSession, (req, res) => setSubscription(req, res, false))

/**
 * GET /api/events/upcoming
 * Todos los eventos del campus desde hoy hasta dentro de un año, con las
 * inscripciones del usuario: la intra publica pocos y así la lista no depende
 * del mes. Eventos en caché compartida por campus; inscripciones por usuario.
 * Respuesta: { cache, items }
 */
app.get('/api/events/upcoming', requireSession, async (req, res) => {
  const session = sessionOf(req)
  const campusId = session.user.campusId ?? DEFAULT_CAMPUS_ID
  // Desde el inicio del día (clave de caché estable durante el día) a un año.
  const from = new Date()
  from.setUTCHours(0, 0, 0, 0)
  const to = new Date(from.getTime() + 365 * 86_400_000)

  if (session.demo) {
    const { items } = mockAgenda(demoStateOf(session), { from, to })
    res.json({ items: items.filter((it) => it.type === 'event') })
    return
  }

  const range = `${from.toISOString()}:${to.toISOString()}`
  try {
    const token = await validAccessToken(session)
    const [events, mine] = await Promise.all([
      cache.cached(`campus-events:${campusId}:${range}`, { ttlMs: TTL_MS.campus }, () =>
        fetchCampusEvents(token, { campusId, from, to }),
      ),
      cache.cached(`personal:${session.user.id}:events:${range}`, { ttlMs: TTL_MS.personal }, () =>
        fetchMyEventIds(token, { userId: session.user.id, from, to }).then((ids) => [...ids]),
      ),
    ])
    const myIds = new Set(mine.value)
    res.json({
      cache: { events: events.state, mine: mine.state },
      items: events.value.map((it) => ({ ...it, subscribed: myIds.has(it.eventId ?? -1) })),
    })
  } catch (err) {
    sendReadFailure(req, res, err, 'events/upcoming')
  }
})

// Compatibilidad con el nombre anterior.
app.get('/api/events', (req, res) => res.redirect(307, `/api/agenda${req.url.slice(req.path.length)}`))

// ---------------------------------------------------------------------------
// Frontend compilado (producción, p. ej. en Docker)
// ---------------------------------------------------------------------------

// Sin servidor de Vite delante, la API sirve también dist/ y devuelve
// index.html para las rutas de página (sin extensión y fuera de /api/), como
// pide una SPA; un fichero que no existe sigue dando 404.
const servesFrontend = process.env.NODE_ENV === 'production' && existsSync(join(DIST_DIR, 'index.html'))
if (servesFrontend) {
  app.use(express.static(DIST_DIR, { index: false }))
  app.get(/^(?!\/api\/)(?!.*\.[a-z0-9]+$).*/i, (_req, res) => res.sendFile(join(DIST_DIR, 'index.html')))
}

app.listen(PORT, () => {
  const mode = hasAppCredentials() ? 'OAuth con la intra y modo demo' : 'sin credenciales, solo modo demo'
  const what = servesFrontend ? 'Calendar42 (API y frontend)' : 'API'
  console.log(`${what} escuchando en http://localhost:${PORT} (${mode})`)
})

// Las sesiones se escriben agrupadas: al parar (docker stop, Ctrl+C) se
// vuelcan los cambios pendientes antes de salir.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    flushSessions()
    process.exit(0)
  })
}
