async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

function withDates(item) {
  return { ...item, beginAt: new Date(item.beginAt), endAt: new Date(item.endAt) }
}

/**
 * Todos los eventos del campus desde hoy (hasta un año vista), con
 * `subscribed` según las inscripciones del usuario y fechas ya convertidas.
 */
export async function fetchUpcomingEvents({ signal } = {}) {
  const res = await fetch('/api/events/upcoming', { signal })
  const body = await readJson(res)
  if (!res.ok) {
    const err = new Error(body.error ?? `Error ${res.status} al cargar los eventos`)
    err.status = res.status
    throw err
  }
  return (body.items ?? []).map(withDates)
}

/**
 * Apunta (subscribed = true) o borra (false) al usuario de un evento.
 * Devuelve { subscribed, subscribers }; subscribers es null si el backend no
 * pudo releer el evento tras la operación.
 */
export async function setEventSubscription(eventId, subscribed) {
  const res = await fetch(`/api/events/${eventId}/subscription`, {
    method: subscribed ? 'POST' : 'DELETE',
  })
  const body = await readJson(res)
  if (!res.ok) {
    const err = new Error(body.error ?? `Error ${res.status}`)
    err.status = res.status
    throw err
  }
  return { subscribed: Boolean(body.subscribed), subscribers: body.subscribers ?? null }
}
