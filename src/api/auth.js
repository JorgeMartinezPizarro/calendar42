async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

/**
 * Usuario de la sesión actual.
 * Devuelve { user, demo, scope } (scope: los de la intra separados por espacio,
 * null en demo) o, si no hay sesión, { user: null, authConfigured, demoAvailable }.
 */
export async function fetchMe() {
  const res = await fetch('/api/auth/me')
  const body = await readJson(res)
  if (res.status === 401) {
    return { user: null, authConfigured: body.authConfigured, demoAvailable: body.demoAvailable }
  }
  if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`)
  return { user: body.user, demo: body.demo, scope: body.scope ?? null }
}

/** Inicia sesión con la intra: redirige al flujo OAuth del backend. */
export function loginWith42() {
  window.location.assign('/api/auth/login')
}

export async function loginDemo() {
  const res = await fetch('/api/auth/demo', { method: 'POST' })
  const body = await readJson(res)
  if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`)
  return { user: body.user, demo: true, scope: null }
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' })
}
