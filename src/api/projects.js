/**
 * Proyectos del usuario en su cursus, con su estado. Cada uno:
 * { id, projectId, name, slug, status, closed, finalMark, validated, markedAt,
 *   updatedAt, teamId, occurrence }. `closed` = cerrado y pendiente de
 * corrección, el único estado en el que se puede agendar una.
 */
export async function fetchProjects({ signal } = {}) {
  const res = await fetch('/api/projects', { signal })
  let body = {}
  try {
    body = await res.json()
  } catch {
    // sin cuerpo JSON: nos quedamos con el mensaje genérico
  }
  if (!res.ok) {
    const err = new Error(body.error ?? `Error ${res.status} al cargar los proyectos`)
    err.status = res.status
    throw err
  }
  return body.projects ?? []
}
