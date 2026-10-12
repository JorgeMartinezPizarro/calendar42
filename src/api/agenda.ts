import type { AgendaPayload } from '../../shared/types.ts'
import type { AgendaCounts, AgendaWarning, Item } from '../types.ts'
import { t } from '../i18n/index.ts'
import { request, toItem } from './http.ts'

export interface Agenda {
  source: 'mock' | 'intra'
  items: Item[]
  counts: AgendaCounts
  warnings: AgendaWarning[]
}

/** Pide al backend la agenda cuyo inicio cae en [from, to), con fechas como Date. */
export async function fetchAgenda(
  from: Date,
  to: Date,
  { signal }: { signal?: AbortSignal } = {},
): Promise<Agenda> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
  const data = await request<AgendaPayload & { source: Agenda['source'] }>(`/api/agenda?${params}`, {
    signal,
    fallback: t.api.agenda,
  })
  return {
    source: data.source,
    counts: data.counts,
    warnings: data.warnings ?? [],
    items: data.items.map(toItem),
  }
}
