// Copia local (localStorage) de lo último que se cargó: agenda por meses,
// próximos eventos y proyectos. Al recargar la página se pinta al momento con
// ella y se vuelve a pedir todo por detrás (como la caché del servidor, pero en
// el navegador). Es del usuario y de este navegador: se borra al cerrar sesión.

import type { AgendaItem } from '../shared/types.ts'
import type { Agenda } from './api/agenda.ts'
import { toItem } from './api/http.ts'
import type { Item, Project } from './types.ts'

/** Agenda guardada de un mes. `stale`: viene de la copia local, falta refrescarla. */
export type MonthAgenda = Pick<Agenda, 'items' | 'counts' | 'warnings'> & { stale?: boolean }

export interface Snapshot {
  months: Record<string, MonthAgenda>
  upcoming: Item[]
  projects: Project[]
}

// Cambiar la versión descarta las copias con una forma antigua.
const PREFIX = 'calendar42:cache:v1:'
// Una copia más vieja que esto no se enseña: mejor esperar a la API.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface Stored {
  savedAt: number
  months: Record<string, MonthAgenda>
  upcoming: Item[]
  projects: Project[]
}

/** Las fechas vuelven como cadenas ISO: se convierten otra vez en Date. */
function revive(items: unknown[]): Item[] {
  return items.map((it) => toItem(it as AgendaItem))
}

/** Copia guardada de este usuario ('demo' o su id), o null si no hay o no vale. */
export function loadSnapshot(userKey: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(PREFIX + userKey)
    if (!raw) return null
    const stored = JSON.parse(raw) as Stored
    if (!stored || Date.now() - stored.savedAt > MAX_AGE_MS) return null
    const months: Record<string, MonthAgenda> = {}
    for (const [key, month] of Object.entries(stored.months ?? {})) {
      months[key] = { ...month, items: revive(month.items), stale: true }
    }
    return { months, upcoming: revive(stored.upcoming ?? []), projects: stored.projects ?? [] }
  } catch {
    return null
  }
}

/** Guarda la copia (sin la marca `stale`). Si no cabe o no se puede, se omite. */
export function saveSnapshot(userKey: string, snapshot: Snapshot): void {
  try {
    const months = Object.fromEntries(
      Object.entries(snapshot.months).map(([key, { items, counts, warnings }]) => [key, { items, counts, warnings }]),
    )
    const stored: Stored = { savedAt: Date.now(), months, upcoming: snapshot.upcoming, projects: snapshot.projects }
    localStorage.setItem(PREFIX + userKey, JSON.stringify(stored))
  } catch {
    // Sin localStorage (navegación privada, cuota llena): la app sigue igual, sin copia.
  }
}

/** Borra todas las copias de este navegador (al cerrar o perder la sesión). */
export function clearSnapshots(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) localStorage.removeItem(key)
    }
  } catch {
    // Sin localStorage no hay nada que borrar.
  }
}
