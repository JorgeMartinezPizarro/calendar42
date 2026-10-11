// Sesiones identificadas por una cookie httpOnly.
// Se guardan en memoria y se vuelcan a un fichero para sobrevivir a los
// reinicios: server/.sessions.json en desarrollo (está en .gitignore) o el que
// indique SESSIONS_FILE (en Docker, un volumen). El fichero contiene los tokens
// de la intra: solo lo puede leer el usuario del proceso.

import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextFunction, Request, Response } from 'express'
import { asHttpError, type Session } from './types.ts'

/**
 * La cookie solo lleva `Secure` cuando la app se sirve por https (APP_URL) o
 * si COOKIE_SECURE lo fuerza: en Docker sobre http://localhost no debe
 * llevarlo, o el navegador la descartaría.
 */
function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === '1'
  return (process.env.APP_URL ?? '').startsWith('https://')
}

// Con https, prefijo __Host-: el navegador solo acepta la cookie si la pone
// este mismo host (Secure, Path=/, sin Domain). Así otra web del mismo dominio
// (otro subdominio) no puede plantar su propia sesión en la nuestra.
const COOKIE_PREFIX = cookieSecure() ? '__Host-' : ''
export const SESSION_COOKIE = `${COOKIE_PREFIX}c42_session`
export const STATE_COOKIE = `${COOKIE_PREFIX}c42_oauth_state`

/** Duración de una sesión con la intra. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Duración de una sesión demo: sus datos son temporales. */
export const DEMO_SESSION_TTL_MS = 24 * 60 * 60 * 1000
// Entrar al demo no pide credenciales: se limita cuántas sesiones demo viven a
// la vez para que crearlas en bucle no llene la memoria ni el disco. Al pasar
// del límite se descarta la más antigua.
const MAX_DEMO_SESSIONS = 500
// Las sesiones caducadas se limpian cada hora, aunque nadie vuelva a usarlas.
const SWEEP_INTERVAL_MS = 60 * 60 * 1000
// Los cambios se escriben agrupados, como mucho uno por segundo.
const PERSIST_DELAY_MS = 1000

const STORE_FILE =
  process.env.SESSIONS_FILE || join(dirname(fileURLToPath(import.meta.url)), '.sessions.json')

const sessions: Map<string, Session> = loadSessions()

function loadSessions(): Map<string, Session> {
  if (!existsSync(STORE_FILE)) return new Map()
  try {
    const stored = JSON.parse(readFileSync(STORE_FILE, 'utf8')) as Record<string, Session>
    const now = Date.now()
    return new Map(Object.entries(stored).filter(([, s]) => s.expiresAt > now))
  } catch (err) {
    console.warn('[sessions] no se pudo leer el almacén, empezando vacío:', asHttpError(err).message)
    return new Map()
  }
}

/**
 * Escribe el almacén en un fichero temporal y lo renombra: un corte a mitad de
 * escritura no deja el fichero a medias (y a todos sin sesión).
 */
function writeStore(): void {
  try {
    const tmp = `${STORE_FILE}.tmp`
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(sessions)), { encoding: 'utf8', mode: 0o600 })
    renameSync(tmp, STORE_FILE)
  } catch (err) {
    console.warn('[sessions] no se pudo guardar el almacén:', asHttpError(err).message)
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

/** Programa una escritura del almacén (agrupa las que llegan seguidas). */
function persist(): void {
  if (persistTimer) return
  persistTimer = setTimeout(flushSessions, PERSIST_DELAY_MS)
  persistTimer.unref()
}

/** Escribe ya los cambios pendientes (al parar el servidor). */
export function flushSessions(): void {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = null
  writeStore()
}

function sweepExpired(): void {
  const now = Date.now()
  let removed = 0
  for (const [id, s] of sessions) {
    if (s.expiresAt <= now) {
      sessions.delete(id)
      removed++
    }
  }
  if (removed) persist()
}

setInterval(sweepExpired, SWEEP_INTERVAL_MS).unref()

/** Descarta las sesiones demo más antiguas por encima del límite. */
function capDemoSessions(): void {
  let demos = 0
  for (const s of sessions.values()) if (s.demo) demos++
  // El Map conserva el orden de alta: las primeras son las más antiguas.
  for (const [id, s] of sessions) {
    if (demos <= MAX_DEMO_SESSIONS) break
    if (s.demo) {
      sessions.delete(id)
      demos--
    }
  }
}

/** Cookies de la petición. Un valor mal codificado se queda tal cual. */
export function parseCookies(header = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (!key || key in out) continue
    try {
      out[key] = decodeURIComponent(value)
    } catch {
      out[key] = value
    }
  }
  return out
}

export function setCookie(
  res: Response,
  name: string,
  value: string,
  { maxAgeMs }: { maxAgeMs?: number } = {},
): void {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (maxAgeMs !== undefined) parts.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`)
  if (cookieSecure()) parts.push('Secure')
  res.append('Set-Cookie', parts.join('; '))
}

export function clearCookie(res: Response, name: string): void {
  setCookie(res, name, '', { maxAgeMs: 0 })
}

/** Crea una sesión que dura `ttlMs` y devuelve su id (el valor de la cookie). */
export function createSession(data: Omit<Session, 'expiresAt'>, ttlMs: number): string {
  const id = randomUUID()
  sessions.set(id, { ...data, expiresAt: Date.now() + ttlMs })
  if (data.demo) capDemoSessions()
  persist()
  return id
}

export function getSession(id: string | null): Session | null {
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
export function saveSession(): void {
  persist()
}

export function destroySession(id: string | null): void {
  if (id && sessions.delete(id)) persist()
}

/** Middleware: carga req.session y req.sessionId a partir de la cookie. */
export function sessionMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie)
  req.cookies = cookies
  req.sessionId = cookies[SESSION_COOKIE] ?? null
  req.session = getSession(req.sessionId)
  next()
}

/** Middleware: responde 401 si no hay sesión. */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (!req.session) {
    res.status(401).json({ error: 'No has iniciado sesión' })
    return
  }
  next()
}

/**
 * La sesión de una petición que ya pasó por requireSession. Evita comprobar
 * null en cada ruta protegida.
 */
export function sessionOf(req: Request): Session {
  if (!req.session) throw new Error('Ruta sin requireSession')
  return req.session
}
