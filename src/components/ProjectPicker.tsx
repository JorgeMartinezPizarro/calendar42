import { useMemo, type ReactNode } from 'react'
import { t } from '../i18n/index.ts'
import type { FreeSlots, Loadable, Project } from '../types.ts'
import RefreshIcon from './RefreshIcon.tsx'
import './ProjectPicker.css'

// Grupos del desplegable, en este orden. Solo el primero es seleccionable.
const GROUPS: { key: 'closed' | 'open'; match: (p: Project) => boolean }[] = [
  { key: 'closed', match: (p) => p.closed },
  { key: 'open', match: (p) => !p.closed },
]

function describe(p: Project): string {
  const status = t.projects.status[p.status] ?? p.status
  if (p.closed) return `${status}.`
  return `${status}. ${t.projects.notClosedYet}`
}

function describeFreeSlots(freeSlots: FreeSlots): string {
  if (freeSlots.status === 'loading') return t.projects.searchingSlots
  if (freeSlots.error) return freeSlots.error
  const n = freeSlots.items.length
  const minutes = freeSlots.evaluationMinutes
  if (n === 0) return minutes ? t.projects.noFreeSlotsFor(minutes) : t.projects.noFreeSlots
  return t.projects.freeSlots(n, minutes)
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
  freeSlots?: FreeSlots | null
  /** Volver a buscar los slots libres en la intra (botón junto al resultado). */
  onRefreshFreeSlots?: () => void
  /** Si la búsqueda de slots está desactivada, su motivo (en lugar del resultado). */
  freeSlotsDisabledReason?: string | null
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
  onRefreshFreeSlots,
  freeSlotsDisabledReason = null,
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
    body = <p className="projects__empty">{t.common.loading}</p>
  } else if (listed.length === 0) {
    body = <p className="projects__empty">{t.projects.none}</p>
  } else {
    body = (
      <>
        <label className="projects__label" htmlFor="project-picker">
          {t.projects.pickLabel}
        </label>
        <select
          id="project-picker"
          className="projects__select"
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{closedCount ? t.projects.pick : t.projects.noneClosed}</option>
          {groups.map((g) => (
            <optgroup key={g.key} label={g.key === 'closed' ? t.projects.groupClosed : t.projects.groupOpen}>
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
              ? t.projects.closedCount(closedCount)
              : t.projects.closeOneHint}
        </p>
        {selected?.closed && freeSlotsDisabledReason && (
          <div className="projects__slots-row">
            <p className="projects__slots projects__slots--reason">{freeSlotsDisabledReason}</p>
          </div>
        )}
        {selected?.closed && !freeSlotsDisabledReason && freeSlots && (
          <div className="projects__slots-row">
            <p
              className={`projects__slots${freeSlots.error ? ' projects__slots--error' : ''}`}
              role={freeSlots.error ? 'alert' : undefined}
            >
              {describeFreeSlots(freeSlots)}
            </p>
            {onRefreshFreeSlots && (
              <button
                type="button"
                className={`projects__refresh${freeSlots.status === 'loading' ? ' projects__refresh--busy' : ''}`}
                onClick={onRefreshFreeSlots}
                disabled={freeSlots.status === 'loading'}
                title={t.projects.refresh}
                aria-label={t.projects.refresh}
              >
                <RefreshIcon />
              </button>
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <section className="projects" aria-label={t.projects.label}>
      <h2 className="projects__title">
        {t.projects.title}
        <span className="projects__count">{listed.length}</span>
      </h2>
      {body}
    </section>
  )
}

export default ProjectPicker
