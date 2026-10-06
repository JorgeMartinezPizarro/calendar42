import 'dotenv/config'
import express from 'express'
import { randomUUID } from 'node:crypto'
import {
  OAUTH_SCOPES,
  authorizeUrl,
  exchangeCode,
  fetchAgenda,
  fetchMe,
  hasAppCredentials,
  refreshTokens,
} from './intra.js'
import { mockAgenda, mockCoalition } from './mock.js'
import {
  SESSION_COOKIE,
  STATE_COOKIE,
  clearCookie,
  createSession,
  destroySession,
  requireSession,
  saveSession,
  sessionMiddleware,
  setCookie,
} from './sessions.js'

const app = express()
const PORT = Number(process.env.PORT) || 3000
const DEFAULT_CAMPUS_ID = Number(process.env.FT_CAMPUS_ID) || 22 // 42 Madrid
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

app.use(express.json())
app.use(sessionMiddleware)

// Cache de agenda en memoria por usuario+rango. Los slots y correcciones son
// personales, así que la clave incluye el usuario.
const CACHE_TTL_MS = 2 * 60 * 1000
const agendaCache = new Map() // key -> { expiresAt, payload }
const agendaInFlight = new Map() // key -> Promise<payload>, evita cargas duplicadas simultáneas

function parseDate(value, fallback) {
  if (!value) return fallback
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Devuelve un access token válido para la sesión, refrescándolo si caducó. */
async function validAccessToken(session) {
  const { tokens } = session
  if (tokens.expiresAt > Date.now() + 30_000) return tokens.accessToken
  if (!tokens.refreshToken) throw Object.assign(new Error('Sesión caducada'), { status: 401 })
  session.tokens = await refreshTokens(tokens.refreshToken)
  saveSession()
  return session.tokens.accessToken
}

function sessionExpired(req, res) {
  destroySession(req.sessionId)
  clearCookie(res, SESSION_COOKIE)
  return res.status(401).json({ error: 'La sesión ha caducado, vuelve a iniciar sesión' })
}

// ---------------------------------------------------------------------------
// Estado / salud
// ---------------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    authConfigured: hasAppCredentials(),
    demoAvailable: !hasAppCredentials(),
    scopes: OAUTH_SCOPES,
  })
})

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

app.get('/api/auth/me', (req, res) => {
  if (!req.session) {
    return res.status(401).json({
      error: 'No has iniciado sesión',
      authConfigured: hasAppCredentials(),
      demoAvailable: !hasAppCredentials(),
    })
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
    return res
      .status(503)
      .json({ error: 'Faltan FT_CLIENT_ID y FT_CLIENT_SECRET en el servidor (.env)' })
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

  if (error) return res.redirect(`${APP_URL}/?auth_error=${encodeURIComponent(error)}`)
  if (!code || !state || state !== expectedState) {
    return res.redirect(`${APP_URL}/?auth_error=state`)
  }

  try {
    const tokens = await exchangeCode(code)
    const user = await fetchMe(tokens.accessToken)
    destroySession(req.sessionId)
    const id = createSession({ user, tokens, demo: false })
    setCookie(res, SESSION_COOKIE, id, { maxAgeMs: 7 * 24 * 60 * 60 * 1000 })
    res.redirect(`${APP_URL}/`)
  } catch (err) {
    console.error('[auth/callback]', err.message)
    res.redirect(`${APP_URL}/?auth_error=exchange`)
  }
})

// Modo demo: solo disponible si la app de 42 no está configurada.
app.post('/api/auth/demo', (req, res) => {
  if (hasAppCredentials()) {
    return res.status(403).json({ error: 'El modo demo está desactivado cuando hay credenciales' })
  }
  destroySession(req.sessionId)
  const user = {
    id: 0,
    login: 'demo',
    displayName: 'Estudiante demo',
    image: null,
    campusId: DEFAULT_CAMPUS_ID,
    coalition: mockCoalition(),
  }
  const id = createSession({ user, tokens: null, demo: true })
  setCookie(res, SESSION_COOKIE, id, { maxAgeMs: 24 * 60 * 60 * 1000 })
  res.json({ user, demo: true })
})

app.post('/api/auth/logout', (req, res) => {
  destroySession(req.sessionId)
  clearCookie(res, SESSION_COOKIE)
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

/**
 * GET /api/agenda?from=ISO&to=ISO
 * Todo lo que cae en [from, to) para el usuario: eventos y exámenes de su
 * campus, sus slots de corrección abiertos y sus correcciones planificadas.
 * Respuesta: { source, campusId, items, counts, warnings }
 */
app.get('/api/agenda', requireSession, async (req, res) => {
  const now = new Date()
  const from = parseDate(req.query.from, new Date(now.getTime() - 7 * 86_400_000))
  const to = parseDate(req.query.to, new Date(now.getTime() + 60 * 86_400_000))

  if (!from || !to) {
    return res.status(400).json({ error: 'Parámetros from/to inválidos (usa fechas ISO)' })
  }
  if (to <= from) {
    return res.status(400).json({ error: '"to" debe ser posterior a "from"' })
  }

  const session = req.session
  const campusId = session.user.campusId ?? DEFAULT_CAMPUS_ID
  const source = session.demo ? 'mock' : 'intra'
  const key = `${source}:${session.user.id}:${campusId}:${from.toISOString()}:${to.toISOString()}`
  const hit = agendaCache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return res.json({ source, campusId, ...hit.payload })
  }

  try {
    let pending = agendaInFlight.get(key)
    if (!pending) {
      pending = (async () => {
        if (session.demo) return mockAgenda({ from, to })
        const token = await validAccessToken(session)
        return fetchAgenda(token, { campusId, userId: session.user.id, from, to })
      })()
      agendaInFlight.set(key, pending)
      pending.finally(() => agendaInFlight.delete(key))
    }
    const payload = await pending
    // Si alguna fuente falló por un problema pasajero (intra caída, 429…), no
    // cacheamos: así una recarga vuelve a intentarlo enseguida.
    const hasTransientFailure = payload.warnings?.some((w) => w.code === 'transient_error')
    if (!hasTransientFailure) {
      agendaCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
    }
    res.json({ source, campusId, ...payload })
  } catch (err) {
    console.error('[agenda]', err.message)
    if (err.status === 401) return sessionExpired(req, res)
    res.status(502).json({ error: err.message })
  }
})

// Compatibilidad con el nombre anterior.
app.get('/api/events', (req, res) => res.redirect(307, `/api/agenda${req.url.slice(req.path.length)}`))

app.listen(PORT, () => {
  const mode = hasAppCredentials() ? 'OAuth con la intra' : 'sin credenciales, modo demo disponible'
  console.log(`API escuchando en http://localhost:${PORT} (${mode})`)
})
