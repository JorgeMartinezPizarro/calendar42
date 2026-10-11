import type { SessionUser } from '../types.ts'
import { readJson } from './http.ts'

/** Sesión iniciada (real o demo). */
export interface LoggedIn {
  user: SessionUser
  demo: boolean
  /** Scopes de la intra separados por espacio; null en demo. */
  scope: string | null
}

/** Sin sesión: qué formas de entrar ofrece el servidor. */
export interface LoggedOut {
  user: null
  authConfigured?: boolean
  demoAvailable?: boolean
}

export type Me = LoggedIn | LoggedOut

/** Usuario de la sesión actual, o qué formas de entrar hay si no hay sesión. */
export async function fetchMe(): Promise<Me> {
  const res = await fetch('/api/auth/me')
  const body = await readJson(res)
  if (res.status === 401) {
    return {
      user: null,
      authConfigured: Boolean(body.authConfigured),
      demoAvailable: Boolean(body.demoAvailable),
    }
  }
  if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `Error ${res.status}`)
  return {
    user: body.user as SessionUser,
    demo: Boolean(body.demo),
    scope: typeof body.scope === 'string' ? body.scope : null,
  }
}

/** Inicia sesión con la intra: redirige al flujo OAuth del backend. */
export function loginWith42(): void {
  window.location.assign('/api/auth/login')
}

export async function loginDemo(): Promise<LoggedIn> {
  const res = await fetch('/api/auth/demo', { method: 'POST' })
  const body = await readJson(res)
  if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `Error ${res.status}`)
  return { user: body.user as SessionUser, demo: true, scope: null }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
}
