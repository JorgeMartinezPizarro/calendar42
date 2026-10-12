import { t } from '../i18n/index.ts'
import type { Project } from '../types.ts'
import { request } from './http.ts'

/**
 * Proyectos del usuario en su cursus, con su estado. `closed` = cerrado y
 * pendiente de corrección, el único estado en el que se puede agendar una.
 */
export async function fetchProjects({ signal }: { signal?: AbortSignal } = {}): Promise<Project[]> {
  const body = await request<{ projects?: Project[] }>('/api/projects', {
    signal,
    fallback: t.api.projects,
  })
  return body.projects ?? []
}
