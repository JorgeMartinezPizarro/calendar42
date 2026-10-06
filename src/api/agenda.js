/**
 * Pide al backend la agenda cuyo inicio cae en [from, to).
 * Devuelve { source, items, counts, warnings } con las fechas ya convertidas a Date.
 * items[].type: 'event' | 'exam' | 'slot' | 'correction'
 */
export async function fetchAgenda(from, to, { signal } = {}) {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
  const res = await fetch(`/api/agenda?${params}`, { signal })

  if (!res.ok) {
    let message = `Error ${res.status} al cargar la agenda`
    try {
      const body = await res.json()
      if (body.error) message = body.error
    } catch {
      // cuerpo no JSON: nos quedamos con el mensaje genérico
    }
    const err = new Error(message)
    err.status = res.status
    throw err
  }

  const data = await res.json()
  return {
    source: data.source,
    counts: data.counts ?? {},
    warnings: data.warnings ?? [],
    items: data.items.map((e) => ({
      ...e,
      beginAt: new Date(e.beginAt),
      endAt: new Date(e.endAt),
    })),
  }
}
