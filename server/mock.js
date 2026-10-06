// Datos de ejemplo para el modo demo (sin credenciales de la intra).
// Se generan en relación al rango pedido para que siempre haya algo que ver.

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
      items.push({
        id: `event-${base + i}`,
        type: 'event',
        subscribed: i % 3 === 0,
        kind: t.kind,
        name: t.name,
        description: 'Evento de ejemplo. Configura FT_CLIENT_ID y FT_CLIENT_SECRET para ver los de la intra.',
        location: t.location,
        beginAt: begin.toISOString(),
        endAt: new Date(begin.getTime() + t.hours * 3_600_000).toISOString(),
        maxPeople: 50,
        subscribers: 12,
      })
    })

    EXAMS.forEach((t, i) => {
      const begin = at(y, m, t.day, t.start)
      if (!inRange(begin, from, to)) return
      items.push({
        id: `exam-${base + i}`,
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
      items.push({
        id: `slot-${base + i}`,
        type: 'slot',
        kind: 'slot',
        name: 'Slot de corrección abierto',
        description: `Disponible para corregir (${chunks} × 15 min)`,
        location: '',
        beginAt: begin.toISOString(),
        endAt: new Date(begin.getTime() + t.hours * 3_600_000).toISOString(),
        slotIds: Array.from({ length: chunks }, (_, k) => base + i * 10 + k),
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
        items.push({
          id: `event-${base + 99}`,
          type: 'event',
          kind: 'event',
          name: 'Code review entre estudiantes',
          description: 'Evento de ejemplo generado para hoy.',
          location: 'Cluster 2',
          beginAt: review.toISOString(),
          endAt: at(y, m, d, 17).toISOString(),
          maxPeople: 20,
          subscribers: 7,
        })
      }
      const slot = at(y, m, d, 18)
      if (inRange(slot, from, to)) {
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

  items.sort((a, b) => a.beginAt.localeCompare(b.beginAt))
  const counts = { event: 0, exam: 0, slot: 0, correction: 0, myEvents: 0, myExams: 0 }
  for (const it of items) {
    counts[it.type] += 1
    if (it.type === 'event' && it.subscribed) counts.myEvents += 1
    if (it.type === 'exam' && it.subscribed) counts.myExams += 1
  }
  return { items, counts, warnings: [] }
}
