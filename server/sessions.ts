// Sesiones identificadas por una cookie httpOnly.
// Se guardan en memoria y se vuelcan a un fichero para sobrevivir a los
// reinicios: server/.sessions.json en desarrollo (está en .gitignore) o el que
// indique SESSIONS_FILE (en Docker, un volumen).

import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextFunction, Request, Response } from 'express'
import { asHttpError, type Session } from './types.ts'

export const SESSION_COOKIE = 'c42_session'
export const STATE_COOKIE = 'c42_oauth_state'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
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

function persist(): void {
  try {
    writeFileSync(STORE_FILE, JSON.stringify(Object.fromEntries(sessions)), 'utf8')
  } catch (err) {
    console.warn('[sessions] no se pudo guardar el almacén:', asHttpError(err).message)
  }
}

export function parseCookies(header = ''): Record<string, string> {
  const out: Record<string, string> = {}
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
function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === '1'
  return (process.env.APP_URL ?? '').startsWith('https://')
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

export function createSession(data: Omit<Session, 'expiresAt'>): string {
  const id = randomUUID()
  sessions.set(id, { ...data, expiresAt: Date.now() + SESSION_TTL_MS })
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
