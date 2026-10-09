// Datos de ejemplo para el modo demo (sin credenciales de la intra).
// Se generan en relación al rango pedido para que siempre haya algo que ver.

// Las cuatro coaliciones clásicas de 42, con sus colores. En la intra cada
// campus tiene las suyas; aquí solo sirven para ver el distintivo de la cabecera.
export const DEMO_COALITIONS = [
  { id: 1, name: 'The Federation', slug: 'the-federation', color: '#00babc', image: null, cover: null },
  { id: 2, name: 'The Alliance', slug: 'the-alliance', color: '#4ebf8a', image: null, cover: null },
  { id: 3, name: 'The Order', slug: 'the-order', color: '#ff6950', image: null, cover: null },
  { id: 4, name: 'The Assembly', slug: 'the-assembly', color: '#a061d1', image: null, cover: null },
]

/** Una coalición al azar para cada sesión demo, así se ven los cuatro colores. */
export function mockCoalition() {
  return DEMO_COALITIONS[Math.floor(Math.random() * DEMO_COALITIONS.length)]
}

// Inscripciones cambiadas desde la app en modo demo (id de evento -> inscrito).
// Viven en memoria: se pierden al reiniciar el servidor, como el resto del demo.
const demoSubscriptions = new Map()

/** Apunta o borra al usuario demo de un evento. */
export function mockSetSubscription(eventId, subscribed) {
  demoSubscriptions.set(eventId, subscribed)
  return { subscribed }
}

// Proyectos de ejemplo: uno cerrado (se puede agendar corrección), otros en
// curso o ya finalizados.
const PROJECTS = [
  { id: 1, projectId: 1314, name: 'minishell', status: 'waiting_for_correction', finalMark: null, validated: null, teamId: 101 },
  { id: 2, projectId: 1315, name: 'cub3d', status: 'in_progress', finalMark: null, validated: null, teamId: 102 },
  { id: 3, projectId: 1334, name: 'NetPractice', status: 'in_progress', finalMark: null, validated: null, teamId: 103 },
  { id: 4, projectId: 1316, name: 'philosophers', status: 'finished', finalMark: 100, validated: true, teamId: 104 },
  { id: 5, projectId: 1283, name: 'push_swap', status: 'finished', finalMark: 84, validated: true, teamId: 105 },
  { id: 6, projectId: 1994, name: 'Born2beroot', status: 'finished', finalMark: 110, validated: true, teamId: 106 },
  { id: 7, projectId: 2004, name: 'Exam Rank 02', status: 'finished', finalMark: 0, validated: false, teamId: 107 },
]

export function mockProjects() {
  const now = new Date().toISOString()
  return PROJECTS.map((p) => ({
    id: p.id,
    projectId: p.projectId,
    name: p.name,
    slug: p.name.toLowerCase().replace(/\s+/g, '-'),
    status: p.status,
    closed: p.status === 'waiting_for_correction',
    finalMark: p.finalMark,
    validated: p.validated,
    markedAt: p.status === 'finished' ? now : null,
    updatedAt: now,
    teamId: p.teamId,
    occurrence: 0,
  }))
}

// Slots propios creados o borrados desde la app, correcciones reservadas: en
// memoria, como el resto del demo.
let demoNextId = 900_000
const demoCreatedSlots = [] // elementos tipo slot
const demoDeletedChunkIds = new Set()
const demoBookings = [] // elementos tipo correction

/** Abre un slot propio entre dos fechas; lo devuelve ya fusionado. */
export function mockCreateSlot({ begin, end }) {
  const chunks = Math.max(1, Math.round((end - begin) / 900_000))
  const ids = Array.from({ length: chunks }, () => demoNextId++)
  const item = {
    id: `slot-${ids[0]}`,
    type: 'slot',
    kind: 'slot',
    name: 'Slot de corrección abierto',
    description: `Disponible para corregir (${chunks} × 15 min)`,
    location: '',
    beginAt: begin.toISOString(),
    endAt: end.toISOString(),
    slotIds: ids,
  }
  demoCreatedSlots.push(item)
  return [item]
}

/** Borra bloques de slot propios (de ejemplo o creados en la sesión). */
export function mockDeleteSlots(ids) {
  for (const id of ids) demoDeletedChunkIds.add(id)
  for (let i = demoCreatedSlots.length - 1; i >= 0; i -= 1) {
    if (demoCreatedSlots[i].slotIds.some((id) => demoDeletedChunkIds.has(id))) demoCreatedSlots.splice(i, 1)
  }
}

const FREE_SLOTS = [
  { day: 11, start: 10, hours: 2, login: 'alice' },
  { day: 13, start: 15, hours: 1, login: 'bob' },
  { day: 16, start: 9, hours: 1.5, login: 'carol' },
  { day: 20, start: 16, hours: 2, login: 'alice' },
  { day: 27, start: 11, hours: 1, login: 'dave' },
]

/** Franjas libres de otros estudiantes para corregir un proyecto. */
export function mockProjectSlots({ projectId, from, to }) {
  const items = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  const push = (begin, hours, login, key) => {
    if (!inRange(begin, from, to)) return
    const chunks = Math.round((hours * 60) / 15)
    items.push({
      id: `free-${key}`,
      type: 'free',
      kind: 'free',
      name: `Slot libre · ${login}`,
      description: `Un estudiante puede corregirte en esta franja (${chunks} × 15 min).`,
      location: '',
      beginAt: begin.toISOString(),
      endAt: new Date(begin.getTime() + hours * 3_600_000).toISOString(),
      slotIds: Array.from({ length: chunks }, (_, k) => key * 10 + k),
      corrector: { id: 100 + (login.charCodeAt(0) % 10), login },
    })
  }
  while (cursor < to) {
    const y = cursor.getFullYear()
    const m = cursor.getMonth()
    const base = y * 10000 + m * 100
    FREE_SLOTS.forEach((t, i) => push(at(y, m, t.day, t.start), t.hours, t.login, base + 500 + i + projectId))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  // Una franja mañana por la mañana, para probar la reserva.
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  push(at(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10), 2, 'alice', 777_000 + projectId)
  items.sort((a, b) => a.beginAt.localeCompare(b.beginAt))
  return items
}

/** Reserva una corrección de ejemplo (30 min) del proyecto en ese instante. */
export function mockBookCorrection({ projectId, beginAt }) {
  const project = PROJECTS.find((p) => p.projectId === projectId)
  const item = {
    id: `correction-${demoNextId++}`,
    type: 'correction',
    kind: 'correction',
    name: `Corrección: ${project?.name ?? 'proyecto'}`,
    description: ['Te corrigen', 'Corrector: alice', 'Reservada desde Calendar42 (demo)'].join('\n'),
    location: '',
    beginAt: beginAt.toISOString(),
    endAt: new Date(beginAt.getTime() + 30 * 60_000).toISOString(),
    role: 'corrected',
    done: false,
    projectId,
  }
  demoBookings.push(item)
  return item
}

const EVENTS = [
  { day: 2, start: 10, hours: 2, name: 'Charla: Introducción a Docker', kind: 'conference', location: 'Auditorio' },
  { day: 5, start: 16, hours: 1.5, name: 'Rush 01 kick-off', kind: 'rush', location: 'Cluster 1' },
  { day: 9, start: 18, hours: 2, name: 'Meetup: Rust para C-devs', kind: 'meetup', location: 'Sala Ágora' },
  { day: 12, start: 9, hours: 8, name: 'Hackathon 42 Madrid', kind: 'hackathon', location: 'Campus' },
  { day: 12, start: 11, hours: 1, name: 'Taller: Git avanzado', kind: 'workshop', location: 'Sala 2' },
  { day: 17, start: 12, hours: 1, name: 'Piscina: sesión informativa', kind: 'event', location: 'Auditorio' },
  { day: 26, start: 19, hours: 3, name: 'Afterwork estudiantes', kind: 'extern', location: 'Cafetería' },
]

const EXAMS = [
  { day: 7, start: 17, hours: 3, name: 'Exam Rank 02', location: 'Cluster 3', projects: ['Exam Rank 02'] },
  { day: 21, start: 17, hours: 3, name: 'Exam Rank 04', location: 'Cluster 3', projects: ['Exam Rank 04'] },
]

const SLOTS = [
  { day: 6, start: 10, hours: 1.5 },
  { day: 14, start: 15, hours: 2 },
  { day: 22, start: 11, hours: 0.75 },
]

const CORRECTIONS = [
  { day: 8, start: 12, minutes: 30, project: 'minishell', role: 'corrector', corrector: 'demo', correcteds: ['alice', 'bob'] },
  { day: 15, start: 18.5, minutes: 45, project: 'cub3d', role: 'corrected', corrector: 'carol', correcteds: ['demo'] },
  { day: 23, start: 9, minutes: 30, project: 'philosophers', role: 'corrector', corrector: 'demo', correcteds: ['dave'] },
]

function at(year, month, day, hour) {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return new Date(year, month, day, h, m, 0)
}

function inRange(date, from, to) {
  return date >= from && date < to
}

export function mockAgenda({ from, to }) {
  const items = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  const now = new Date()

  while (cursor < to) {
    const y = cursor.getFullYear()
    const m = cursor.getMonth()
    const base = y * 10000 + m * 100

    EVENTS.forEach((t, i) => {
      const begin = at(y, m, t.day, t.start)
      if (!inRange(begin, from, to)) return
      const byDefault = i % 3 === 0
      const subscribed = demoSubscriptions.get(base + i) ?? byDefault
      items.push({
        id: `event-${base + i}`,
        eventId: base + i,
        type: 'event',
        subscribed,
        kind: t.kind,
        name: t.name,
        description:
          'Evento de ejemplo con **Markdown**, como los de la intra.\n\n- Trae tu portátil\n- Plazas limitadas\n\nMás información en [la intra](https://intra.42.fr).\n\nConfigura FT_CLIENT_ID y FT_CLIENT_SECRET para ver los de verdad.',
        location: t.location,
        beginAt: begin.toISOString(),
        endAt: new Date(begin.getTime() + t.hours * 3_600_000).toISOString(),
        maxPeople: 50,
        subscribers: 12 + Number(subscribed) - Number(byDefault),
        cancellationLimitHours: t.kind === 'hackathon' ? 24 : 0,
      })
    })

    EXAMS.forEach((t, i) => {
      const begin = at(y, m, t.day, t.start)
      if (!inRange(begin, from, to)) return
      items.push({
        id: `exam-${base + i}`,
        examId: base + i,
        type: 'exam',
        subscribed: i === 0,
        kind: 'exam',
        name: t.name,
        description: `Proyectos: ${t.projects.join(', ')}\nCursus: 42cursus`,
        location: t.location,
        beginAt: begin.toISOString(),
        endAt: new Date(begin.getTime() + t.hours * 3_600_000).toISOString(),
        maxPeople: 60,
        subscribers: 31,
      })
    })

    SLOTS.forEach((t, i) => {
      const begin = at(y, m, t.day, t.start)
      if (!inRange(begin, from, to)) return
      const chunks = Math.round((t.hours * 60) / 15)
      const slotIds = Array.from({ length: chunks }, (_, k) => base + i * 10 + k)
      if (slotIds.some((id) => demoDeletedChunkIds.has(id))) return
      items.push({
        id: `slot-${base + i}`,
        type: 'slot',
        kind: 'slot',
        name: 'Slot de corrección abierto',
        description: `Disponible para corregir (${chunks} × 15 min)`,
        location: '',
        beginAt: begin.toISOString(),
        endAt: new Date(begin.getTime() + t.hours * 3_600_000).toISOString(),
        slotIds,
      })
    })

    CORRECTIONS.forEach((t, i) => {
      const begin = at(y, m, t.day, t.start)
      if (!inRange(begin, from, to)) return
      items.push({
        id: `correction-${base + i}`,
        type: 'correction',
        kind: 'correction',
        name: `Corrección: ${t.project}`,
        description: [
          t.role === 'corrector' ? 'Tú corriges' : 'Te corrigen',
          `Corrector: ${t.corrector}`,
          `Corregidos: ${t.correcteds.join(', ')}`,
        ].join('\n'),
        location: '',
        beginAt: begin.toISOString(),
        endAt: new Date(begin.getTime() + t.minutes * 60_000).toISOString(),
        role: t.role,
        done: begin < now,
        projectId: null,
      })
    })

    // Un par de cosas hoy para probar la línea de hora actual.
    if (now.getFullYear() === y && now.getMonth() === m) {
      const d = now.getDate()
      const review = at(y, m, d, 15.5)
      if (inRange(review, from, to)) {
        const subscribed = demoSubscriptions.get(base + 99) ?? false
        items.push({
          id: `event-${base + 99}`,
          eventId: base + 99,
          type: 'event',
          subscribed,
          kind: 'event',
          name: 'Code review entre estudiantes',
          description: 'Evento de ejemplo generado para hoy.',
          location: 'Cluster 2',
          beginAt: review.toISOString(),
          endAt: at(y, m, d, 17).toISOString(),
          maxPeople: 20,
          subscribers: 7 + Number(subscribed),
          cancellationLimitHours: 0,
        })
      }
      const slot = at(y, m, d, 18)
      if (inRange(slot, from, to) && ![base + 990, base + 991, base + 992, base + 993].some((id) => demoDeletedChunkIds.has(id))) {
        items.push({
          id: `slot-${base + 99}`,
          type: 'slot',
          kind: 'slot',
          name: 'Slot de corrección abierto',
          description: 'Disponible para corregir (4 × 15 min)',
          location: '',
          beginAt: slot.toISOString(),
          endAt: at(y, m, d, 19).toISOString(),
          slotIds: [base + 990, base + 991, base + 992, base + 993],
        })
      }
    }

    cursor.setMonth(cursor.getMonth() + 1)
  }

  // Lo creado desde la app en esta sesión demo.
  for (const it of [...demoCreatedSlots, ...demoBookings]) {
    if (inRange(new Date(it.beginAt), from, to)) items.push(it)
  }

  items.sort((a, b) => a.beginAt.localeCompare(b.beginAt))
  const counts = { event: 0, exam: 0, slot: 0, correction: 0, myEvents: 0, myExams: 0 }
  for (const it of items) {
    counts[it.type] += 1
    if (it.type === 'event' && it.subscribed) counts.myEvents += 1
    if (it.type === 'exam' && it.subscribed) counts.myExams += 1
  }
  return { items, counts, warnings: [] }
}
