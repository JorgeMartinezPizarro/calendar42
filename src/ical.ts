// Exportación de la agenda en iCalendar (RFC 5545, ficheros .ics): el formato
// que importan Google Calendar, Outlook y Apple Calendar.

import type { Item, ItemType } from './types.ts'

const CRLF = '\r\n'
// Longitud máxima de una línea en octetos, sin contar el salto (RFC 5545 §3.1).
const MAX_LINE_OCTETS = 75

const CATEGORIES: Record<ItemType, string> = {
  event: 'Evento',
  exam: 'Examen',
  slot: 'Slot de corrección',
  correction: 'Corrección',
  free: 'Slot libre',
}

/** Texto escapado para un valor TEXT: barra invertida, ';', ',' y saltos. */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Fecha en UTC con el formato de iCalendar: 20261011T080000Z. */
function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Parte una línea larga en varias de como mucho 75 octetos; las de
 * continuación empiezan por un espacio. Cuenta octetos UTF-8 y nunca corta un
 * carácter por la mitad.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  let octets = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    // La primera línea admite 75 octetos; las demás, 74 más el espacio inicial.
    const limit = parts.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1
    if (octets + size > limit) {
      parts.push(current)
      current = ''
      octets = 0
    }
    current += char
    octets += size
  }
  parts.push(current)
  return parts.join(`${CRLF} `)
}

/** Descripción en texto plano: la de la intra es Markdown, a veces con HTML. */
function plainDescription(item: Item): string {
  const text = (item.description ?? '').replace(/<[^>]+>/g, '').trim()
  const extra = item.signupUrl ? `Inscripción: ${item.signupUrl}` : ''
  return [text, extra].filter(Boolean).join('\n\n')
}

function eventLines(item: Item, stamp: string): string[] {
  const description = plainDescription(item)
  return [
    'BEGIN:VEVENT',
    // UID estable: al reimportar, el calendario actualiza en vez de duplicar.
    `UID:${item.id}@calendar42`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${utcStamp(item.beginAt)}`,
    `DTEND:${utcStamp(item.endAt)}`,
    `SUMMARY:${escapeText(item.name)}`,
    ...(item.location ? [`LOCATION:${escapeText(item.location)}`] : []),
    ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
    ...(item.signupUrl ? [`URL:${item.signupUrl}`] : []),
    `CATEGORIES:${escapeText(CATEGORIES[item.type])}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
  ]
}

/** Calendario iCalendar con los elementos dados, ordenados por inicio. */
export function toICalendar(items: Item[], now: Date = new Date()): string {
  const stamp = utcStamp(now)
  const sorted = [...items].sort((a, b) => a.beginAt.getTime() - b.beginAt.getTime())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calendar42//42 Madrid//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Calendar42',
    ...sorted.flatMap((item) => eventLines(item, stamp)),
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join(CRLF) + CRLF
}

/** Descarga el texto como fichero .ics desde el navegador. */
export function downloadICalendar(filename: string, ics: string): void {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Tras el clic el navegador ya tiene el fichero; se libera en el siguiente ciclo.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
