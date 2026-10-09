/**
 * Apunta (subscribed = true) o borra (false) al usuario de un evento.
 * Devuelve { subscribed, subscribers }; subscribers es null si el backend no
 * pudo releer el evento tras la operación.
 */
export async function setEventSubscription(eventId, subscribed) {
  const res = await fetch(`/api/events/${eventId}/subscription`, {
    method: subscribed ? 'POST' : 'DELETE',
  })
  let body = {}
  try {
    body = await res.json()
  } catch {
    // sin cuerpo JSON: nos quedamos con el mensaje genérico
  }
  if (!res.ok) {
    const err = new Error(body.error ?? `Error ${res.status}`)
    err.status = res.status
    throw err
  }
  return { subscribed: Boolean(body.subscribed), subscribers: body.subscribers ?? null }
}
