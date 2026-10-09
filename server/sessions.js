// Sesiones identificadas por una cookie httpOnly.
// Se guardan en memoria y se vuelcan a un fichero para sobrevivir a los
// reinicios: server/.sessions.json en desarrollo (está en .gitignore) o el que
// indique SESSIONS_FILE (en Docker, un volumen).

import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SESSION_COOKIE = 'c42_session'
export const STATE_COOKIE = 'c42_oauth_state'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const STORE_FILE =
  process.env.SESSIONS_FILE || join(dirname(fileURLToPath(import.meta.url)), '.sessions.json')

const sessions = loadSessions() // id -> { user, tokens, demo, expiresAt }

function loadSessions() {
  if (!existsSync(STORE_FILE)) return new Map()
  try {
    const entries = Object.entries(JSON.parse(readFileSync(STORE_FILE, 'utf8')))
    const now = Date.now()
    return new Map(entries.filter(([, s]) => s.expiresAt > now))
  } catch (err) {
    console.warn('[sessions] no se pudo leer el almacén, empezando vacío:', err.message)
    return new Map()
  }
}

function persist() {
  try {
    writeFileSync(STORE_FILE, JSON.stringify(Object.fromEntries(sessions)), 'utf8')
  } catch (err) {
    console.warn('[sessions] no se pudo guardar el almacén:', err.message)
  }
}

export function parseCookies(header = '') {
  const out = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (key) out[key] = decodeURIComponent(value)
  }
  return out
}

/**
 * La cookie solo lleva `Secure` cuando la app se sirve por https (APP_URL) o
 * si COOKIE_SECURE lo fuerza: en Docker sobre http://localhost no debe
 * llevarlo, o el navegador la descartaría.
 */
function cookieSecure() {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === '1'
  return (process.env.APP_URL ?? '').startsWith('https://')
}

export function setCookie(res, name, value, { maxAgeMs } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (maxAgeMs !== undefined) parts.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`)
  if (cookieSecure()) parts.push('Secure')
  res.append('Set-Cookie', parts.join('; '))
}

export function clearCookie(res, name) {
  setCookie(res, name, '', { maxAgeMs: 0 })
}

export function createSession(data) {
  const id = randomUUID()
  sessions.set(id, { ...data, expiresAt: Date.now() + SESSION_TTL_MS })
  persist()
  return id
}

export function getSession(id) {
  if (!id) return null
  const s = sessions.get(id)
  if (!s) return null
  if (s.expiresAt < Date.now()) {
    sessions.delete(id)
    persist()
    return null
  }
  return s
}

/** Guarda cambios hechos sobre una sesión existente (p. ej. tokens refrescados). */
export function saveSession() {
  persist()
}

export function destroySession(id) {
  if (id && sessions.delete(id)) persist()
}

/** Middleware: carga req.session y req.sessionId a partir de la cookie. */
export function sessionMiddleware(req, _res, next) {
  const cookies = parseCookies(req.headers.cookie)
  req.cookies = cookies
  req.sessionId = cookies[SESSION_COOKIE] ?? null
  req.session = getSession(req.sessionId)
  next()
}

/** Middleware: responde 401 si no hay sesión. */
export function requireSession(req, res, next) {
  if (!req.session) {
    return res.status(401).json({ error: 'No has iniciado sesión' })
  }
  next()
}
