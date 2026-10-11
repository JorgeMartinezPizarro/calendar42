import { useMemo, type ReactNode } from 'react'
import type { Item, Loadable, Project } from '../types.ts'
import './ProjectPicker.css'

const STATUS_LABELS: Record<string, string> = {
  waiting_for_correction: 'Cerrado, pendiente de corrección',
  in_progress: 'En curso',
  searching_a_group: 'Buscando grupo',
  creating_group: 'Creando grupo',
}

// Grupos del desplegable, en este orden. Solo el primero es seleccionable.
const GROUPS: { key: string; label: string; match: (p: Project) => boolean }[] = [
  { key: 'closed', label: 'Cerrados, listos para corrección', match: (p) => p.closed },
  { key: 'open', label: 'En curso, aún sin cerrar', match: (p) => !p.closed },
]

function describe(p: Project): string {
  const status = STATUS_LABELS[p.status] ?? p.status
  if (p.closed) return `${status}.`
  return `${status}. Hasta que cierres el proyecto no se puede agendar su corrección.`
}

function describeFreeSlots(freeSlots: Loadable<Item>): string {
  if (freeSlots.status === 'loading') return 'Buscando slots libres…'
  if (freeSlots.error) return freeSlots.error
  const n = freeSlots.items.length
  if (n === 0) return 'Ningún slot libre este mes para corregir este proyecto.'
  return `${n} franja${n === 1 ? '' : 's'} libre${n === 1 ? '' : 's'} este mes, en el calendario y en las horas del día. Pulsa una para agendar la corrección.`
}

interface ProjectPickerProps {
  /** Lo que devuelve /api/projects. */
  projects?: Project[]
  status: Loadable<Project>['status']
  /** Mensaje si falló la carga. */
  error?: string | null
  /** Proyecto elegido (id del projects_user). */
  selectedId?: number | null
  onSelect: (id: number | null) => void
  /** Slots libres del elegido, o null. */
  freeSlots?: Loadable<Item> | null
}

/**
 * Desplegable con los proyectos del alumno aún sin terminar. Solo se pueden
 * elegir los cerrados (pendientes de corrección); los que siguen en curso
 * aparecen desactivados. Los finalizados no se listan. Para el elegido, el
 * estado de sus slots libres.
 */
function ProjectPicker({
  projects = [],
  status,
  error = null,
  selectedId = null,
  onSelect,
  freeSlots = null,
}: ProjectPickerProps) {
  const listed = useMemo(() => projects.filter((p) => p.status !== 'finished'), [projects])
  const groups = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: listed.filter(g.match) })).filter((g) => g.items.length),
    [listed],
  )
  const selected = listed.find((p) => p.id === selectedId) ?? null
  const closedCount = listed.filter((p) => p.closed).length

  let body: ReactNode
  if (error) {
    body = <p className="projects__empty projects__empty--error">{error}</p>
  } else if (status === 'loading' && projects.length === 0) {
    body = <p className="projects__empty">Cargando…</p>
  } else if (listed.length === 0) {
    body = <p className="projects__empty">Ningún proyecto en curso en tu cursus</p>
  } else {
    body = (
      <>
        <label className="projects__label" htmlFor="project-picker">
          Proyecto cerrado para agendar su corrección
        </label>
        <select
          id="project-picker"
          className="projects__select"
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{closedCount ? 'Elige un proyecto…' : 'Ningún proyecto cerrado todavía'}</option>
          {groups.map((g) => (
            <optgroup key={g.key} label={g.label}>
              {g.items.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.closed}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="projects__detail">
          {selected
            ? describe(selected)
            : closedCount
              ? `${closedCount} proyecto${closedCount === 1 ? '' : 's'} cerrado${closedCount === 1 ? '' : 's'} a la espera de corrección.`
              : 'Cierra un proyecto en la intra y aparecerá aquí listo para agendar su corrección.'}
        </p>
        {selected?.closed && freeSlots && (
          <p
            className={`projects__slots${freeSlots.error ? ' projects__slots--error' : ''}`}
            role={freeSlots.error ? 'alert' : undefined}
          >
            {describeFreeSlots(freeSlots)}
          </p>
        )}
      </>
    )
  }

  return (
    <section className="projects" aria-label="Proyectos del alumno">
      <h2 className="projects__title">
        Correcciones
        <span className="projects__count">{listed.length}</span>
      </h2>
      {body}
    </section>
  )
}

export default ProjectPicker
