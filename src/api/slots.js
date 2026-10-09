async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

function failure(res, body, fallback) {
  const err = new Error(body.error ?? `${fallback} (${res.status})`)
  err.status = res.status
  return err
}

function withDates(item) {
  return { ...item, beginAt: new Date(item.beginAt), endAt: new Date(item.endAt) }
}

/** Abre un slot de corrección propio. Devuelve los bloques creados, fusionados. */
export async function createSlot({ beginAt, endAt }) {
  const res = await fetch('/api/slots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ beginAt: beginAt.toISOString(), endAt: endAt.toISOString() }),
  })
  const body = await readJson(res)
  if (!res.ok) throw failure(res, body, 'No se pudo crear el slot')
  return (body.items ?? []).map(withDates)
}

/** Borra los bloques (ids de la intra) de un slot propio. */
export async function deleteSlots(ids) {
  const res = await fetch('/api/slots', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  const body = await readJson(res)
  if (!res.ok) throw failure(res, body, 'No se pudo borrar el slot')
}

/**
 * Franjas libres de otros estudiantes para corregir un proyecto, con inicio
 * en [from, to). Elementos de tipo 'free' con fechas ya convertidas.
 */
export async function fetchProjectSlots(projectId, from, to, { signal } = {}) {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
  const res = await fetch(`/api/projects/${projectId}/slots?${params}`, { signal })
  const body = await readJson(res)
  if (!res.ok) throw failure(res, body, 'No se pudieron cargar los slots libres')
  return (body.items ?? []).map(withDates)
}

/** Reserva una corrección del proyecto en ese instante. */
export async function bookCorrection({ projectId, teamId, beginAt, correctorId = null }) {
  const res = await fetch('/api/corrections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, teamId, beginAt: beginAt.toISOString(), correctorId }),
  })
  const body = await readJson(res)
  if (!res.ok) throw failure(res, body, 'No se pudo reservar la corrección')
  return body.item ? withDates(body.item) : null
}
